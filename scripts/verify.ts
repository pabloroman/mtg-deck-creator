/** Sanity-check the SPA's pure search/filter logic against the generated data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { parseQuery } from '../src/search/parseQuery';
import { filterCards } from '../src/search/filterCards';
import { scoreArchetypes, synergyFor, lopsidedSide } from '../src/lib/synergy';
import type { OwnedCard, ResolvedArchetype } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, p), 'utf8'));
const cards: OwnedCard[] = read('../public/data/cards.json');
const archetypes: ResolvedArchetype[] = read('../public/data/archetypes.json');

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

// ---- synergy engine ----
console.log('\n--- synergy engine ---');
const scores = scoreArchetypes(cards, archetypes);
console.log(
  'archetype ranking:',
  scores.map((s) => `${s.archetype.id}(${s.score.toFixed(0)})`).join(' > '),
);

const byId = new Map(scores.map((s) => [s.archetype.id, s]));
const aristo = byId.get('aristocrats')!;
const reanim = byId.get('reanimator')!;
const life = byId.get('lifegain')!;
assert.ok(aristo && reanim && life, 'expected aristocrats, reanimator, lifegain archetypes');

// 5) deep two-sided archetype outranks a thinner one
assert.ok(aristo.score > reanim.score, 'aristocrats should outrank reanimator');

// 6) lifegain is lopsided (enablers >> payoffs); reanimator is NOT (127 payoffs is plenty)
assert.strictEqual(lopsidedSide(life), 'payoffs', 'lifegain should be thin on payoffs');
assert.strictEqual(lopsidedSide(reanim), null, 'reanimator should not be flagged lopsided');
console.log(
  `lifegain e=${life.e} p=${life.p} -> lopsided:${lopsidedSide(life)};`,
  `reanimator e=${reanim.e} p=${reanim.p} -> lopsided:${lopsidedSide(reanim)}`,
);

// 7) synergyFor on a sacrifice outlet surfaces an aristocrats payoff via a complement
const aristoDef = archetypes.find((a) => a.id === 'aristocrats')!;
const enablerSet = new Set(aristoDef.enablers);
const sacOutlet = cards.find((c) => c.tags.some((t) => enablerSet.has(t)));
assert.ok(sacOutlet, 'expected at least one aristocrats enabler in the collection');
const hits = synergyFor(sacOutlet!, cards, archetypes);
assert.ok(hits.length > 0, 'synergyFor should return hits for an enabler');
const complement = hits.find((h) => h.reason.includes('Aristocrats'));
assert.ok(complement, 'expected an Aristocrats complement among synergy hits');
console.log(
  `synergyFor("${sacOutlet!.name}") top:`,
  hits.slice(0, 3).map((h) => `${h.card.name} [${h.reason}]`).join(', '),
);

console.log('\nAll frontend-logic checks passed.');
