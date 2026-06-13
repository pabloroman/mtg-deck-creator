/** Sanity-check the SPA's pure search/filter logic against the generated data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { parseQuery } from '../src/search/parseQuery';
import { filterCards } from '../src/search/filterCards';
import { scoreArchetypes, relatedCards, lopsidedSide } from '../src/lib/synergy';
import {
  isCommander,
  withinIdentity,
  identitySet,
  listCommanders,
  buildSkeleton,
} from '../src/lib/commander';
import type { Color, OwnedCard, ResolvedArchetype } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, p), 'utf8'));
const cards: OwnedCard[] = read('../public/data/cards.json');
const archetypes: ResolvedArchetype[] = read('../public/data/archetypes.json');

const run = (raw: string, colors: ('W' | 'U' | 'B' | 'R' | 'G' | 'C')[] = []) => {
  const p = parseQuery(raw);
  return filterCards(cards, {
    tagSlugs: p.tagSlugs,
    typeTerms: p.typeTerms,
    keywords: p.keywordSlugs,
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

// 2b) keyword search: kw:flying -> only cards carrying the Flying keyword
const flyers = run('kw:flying');
assert.ok(flyers.length > 0, 'expected some Flying cards via kw:flying');
assert.ok(
  flyers.every((c) => c.keywords.includes('Flying')),
  'every kw:flying result must have the Flying keyword',
);
console.log(`kw:flying => ${flyers.length} cards`);

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

// 7) relatedCards on a pure sacrifice outlet: engine partners are its aristocrats
//    payoffs (opposite role), similar cards are other outlets; the lists are disjoint
const reap = cards.find((c) => c.name === "Altar's Reap");
assert.ok(reap, "expected Altar's Reap (a pure sacrifice outlet) in the collection");
const { engine, similar } = relatedCards(reap!, cards, archetypes);
assert.ok(engine.length > 0, 'engine partners expected for a sacrifice outlet');
assert.ok(
  engine.every((h) => h.reason.includes('Aristocrats')),
  'engine partners of an outlet should be Aristocrats complements',
);
// an outlet's engine partners must not themselves be the same kind of outlet
assert.ok(
  engine.every((h) => !h.card.tags.includes('sacrifice-outlet-creature')),
  'engine partners must fill the opposite role, not duplicate the outlet',
);
const eKeys = new Set(engine.map((h) => h.card.oracleId || h.card.id));
assert.ok(
  similar.every((h) => !eKeys.has(h.card.oracleId || h.card.id)),
  'engine and similar lists must be disjoint',
);
console.log(
  `relatedCards("Altar's Reap") engine:`,
  engine.slice(0, 3).map((h) => h.card.name).join(', '),
  '| similar:',
  similar.slice(0, 3).map((h) => h.card.name).join(', '),
);

// ---- commander guide ----
console.log('\n--- commander guide ---');
const commanders = listCommanders(cards);
assert.ok(commanders.length > 0, 'expected at least one legendary creature');
assert.ok(commanders.every(isCommander), 'listed commanders must be legendary creatures');

// prefer a 1–2 colour commander so the identity check has teeth
const cmd =
  commanders.find((c) => c.colorIdentity.length >= 1 && c.colorIdentity.length <= 2) ??
  commanders[0];
const idSet = identitySet(cmd);

// an off-identity card is rejected (when the commander isn't 5-colour)
if (idSet.size < 5) {
  const allColors: Color[] = ['W', 'U', 'B', 'R', 'G'];
  const missing = allColors.find((col) => !idSet.has(col))!;
  const offColor = cards.find((c) => c.colorIdentity.includes(missing));
  assert.ok(offColor, 'expected some card outside the commander identity');
  assert.ok(!withinIdentity(offColor!, idSet), 'off-identity card must be rejected');
}

const skeleton = buildSkeleton(cmd, cards, archetypes);
const lands = skeleton.find((s) => s.id === 'lands')!;
assert.ok(lands.picks.length > 0, 'lands bucket should have picks');

const allPicks = skeleton.flatMap((s) => s.picks.map((p) => p.card));
assert.ok(allPicks.every((c) => withinIdentity(c, idSet)), 'every pick must be colour-legal');
const cmdKey = cmd.oracleId || cmd.id;
assert.ok(allPicks.every((c) => (c.oracleId || c.id) !== cmdKey), 'commander excluded from picks');
const keys = allPicks.map((c) => c.oracleId || c.id);
assert.strictEqual(new Set(keys).size, keys.length, 'a card appears in at most one bucket');

console.log(
  `commander "${cmd.name}" (${cmd.colorIdentity.join('') || 'C'}) =>`,
  skeleton.map((s) => `${s.name}:${s.picks.length}/${s.target}`).join('  '),
);

console.log('\nAll frontend-logic checks passed.');
