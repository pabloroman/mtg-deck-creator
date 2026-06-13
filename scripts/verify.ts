/** Sanity-check the SPA's pure search/filter logic against the generated data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { parseQuery } from '../src/search/parseQuery';
import { filterCards } from '../src/search/filterCards';
import type { OwnedCard } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cards: OwnedCard[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../public/data/cards.json'), 'utf8'),
);

const run = (raw: string, colors: ('W' | 'U' | 'B' | 'R' | 'G' | 'C')[] = []) => {
  const p = parseQuery(raw);
  return filterCards(cards, {
    tagSlugs: p.tagSlugs,
    text: p.text,
    colors,
    axis: 'identity',
    match: 'subset',
  });
};

// 1) otag:reanimate -> the 3 owned reanimate cards
const reanimate = run('otag:reanimate');
assert.strictEqual(reanimate.length, 3, `expected 3 reanimate, got ${reanimate.length}`);
console.log('otag:reanimate =>', reanimate.map((c) => `${c.name} [${c.set}]`).join(', '));

// 2) name search
const forest = run('forest');
assert.ok(forest.some((c) => c.name === 'Forest'), 'expected a Forest in name search');
console.log(`name "forest" => ${forest.length} cards`);

// 3) tag + color (subset, identity): reanimate cards whose identity ⊆ {B}
const reanimateB = run('otag:reanimate', ['B']);
console.log(
  `otag:reanimate + B (subset) => ${reanimateB.length}:`,
  reanimateB.map((c) => `${c.name} (${c.colorIdentity.join('') || 'C'})`).join(', '),
);
assert.ok(reanimateB.length <= reanimate.length, 'color filter should not add results');

// 4) two-tag AND narrows results
const single = run('otag:reanimate');
const two = run('otag:reanimate otag:nonexistent-tag-xyz');
assert.strictEqual(two.length, 0, 'unknown ANDed tag should yield 0');
console.log(`AND with unknown tag => ${two.length} (from ${single.length})`);

console.log('\nAll frontend-logic checks passed.');
