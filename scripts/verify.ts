/** Sanity-check the SPA's pure search/filter logic against the generated data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { parseQuery } from '../src/search/parseQuery';
import { filterCards } from '../src/search/filterCards';
import { scoreArchetypes, relatedCards, lopsidedSide } from '../src/lib/synergy';
import { creatureSubtypes, isCosmetic, typeTokens } from '../src/lib/ontology';
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

// 2c) pauper-legal filter narrows to only Pauper-legal cards, and never adds results
const allCards = filterCards(cards, {
  tagSlugs: [], typeTerms: [], keywords: [], text: '',
  colors: [], axis: 'identity', match: 'subset', rarities: [],
});
const pauper = filterCards(cards, {
  tagSlugs: [], typeTerms: [], keywords: [], text: '',
  colors: [], axis: 'identity', match: 'subset', rarities: [], pauperOnly: true,
});
assert.ok(pauper.length > 0, 'expected some Pauper-legal cards');
assert.ok(pauper.length < allCards.length, 'pauperOnly should exclude some cards');
assert.ok(pauper.every((c) => c.pauperLegal), 'every pauperOnly result must be Pauper-legal');
console.log(`pauperOnly => ${pauper.length}/${allCards.length} cards`);

const playable = filterCards(cards, {
  tagSlugs: [], typeTerms: [], keywords: [], text: '',
  colors: [], axis: 'identity', match: 'subset', rarities: [], playableOnly: true,
});
assert.ok(playable.length > 0, 'expected some cards on the pull list');
assert.ok(playable.length < allCards.length, 'playableOnly should exclude some cards');
assert.ok(
  playable.every((c) => c.tags.includes('playable')),
  'every playableOnly result must carry the playable tag',
);
// The synthetic tags must stay out of synergy scoring, or 2k cards share a tag.
assert.ok(isCosmetic('playable'), 'playable tags must be cosmetic (excluded from synergy)');
console.log(`playableOnly => ${playable.length}/${allCards.length} cards`);

// 2d) edhrec_rank is captured for the bulk of the collection (drives the EDHREC sort)
const ranked = cards.filter((c) => typeof c.edhrecRank === 'number');
assert.ok(ranked.length > cards.length / 2, 'expected most cards to carry an edhrecRank');
assert.ok(ranked.every((c) => c.edhrecRank! >= 0), 'edhrecRank must be a non-negative number');
console.log(`edhrecRank present on ${ranked.length}/${cards.length} cards`);

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

// 8) typeTokens parsing (deterministic, data-independent)
assert.deepStrictEqual(typeTokens('Artifact — Equipment').sort(), [
  'st:equipment',
  't:artifact',
]);
assert.deepStrictEqual(typeTokens('Legendary Artifact Creature — Equipment Octopus').sort(), [
  'st:equipment',
  'st:octopus',
  't:artifact',
  't:creature',
]); // 'legendary' supertype excluded
assert.deepStrictEqual(typeTokens('Instant'), ['t:instant']); // no subtype
assert.ok(
  typeTokens('Creature — Human Shaman // Enchantment — Aura Curse').includes('st:aura'),
  'DFC back-face subtypes are parsed',
);

// 9) type-awareness: among an Equipment's similar cards, a fellow Equipment outranks a
//    plain Artifact (asserted only when both appear — robust, never vacuously failing)
const equip = cards.find(
  (c) => c.typeLine.includes('— Equipment') && c.tags.some((t) => !isCosmetic(t)),
);
assert.ok(equip, 'expected an Equipment with a non-cosmetic tag');
const eqSimilar = relatedCards(equip!, cards, archetypes).similar;
const iEquip = eqSimilar.findIndex((h) => h.card.typeLine.includes('— Equipment'));
const iArtifact = eqSimilar.findIndex((h) => h.card.typeLine === 'Artifact');
if (iEquip !== -1 && iArtifact !== -1) {
  assert.ok(iEquip < iArtifact, 'a fellow Equipment should outrank a plain Artifact');
}
console.log(
  `relatedCards("${equip!.name}") similar:`,
  eqSimilar.slice(0, 3).map((h) => `${h.card.name} [${h.card.typeLine}]`).join(', '),
);

// 10) creatureSubtypes parsing (deterministic, data-independent)
assert.deepStrictEqual(
  creatureSubtypes('Legendary Creature — Goblin Warrior').sort(),
  ['goblin', 'warrior'],
);
assert.deepStrictEqual(creatureSubtypes('Artifact — Equipment'), []); // not a creature face
assert.ok(
  creatureSubtypes('Enchantment Creature — Elf Druid // Land').includes('elf'),
  'creature-face subtypes parsed even on a DFC',
);

// 11) typal archetypes: tribes are generated, members counted, and never flagged lopsided
const allScores = scoreArchetypes(cards, archetypes);
const typalScores = allScores.filter((s) => s.archetype.subtypes?.length);
assert.ok(typalScores.length >= 5, `expected ≥5 typal archetypes, got ${typalScores.length}`);
const goblins = typalScores.find((s) => s.archetype.subtypes?.includes('goblin'));
assert.ok(goblins, 'expected a Goblins tribe');
assert.ok(goblins!.e > 0, 'Goblins tribe should have members (e > 0)');
assert.ok(
  typalScores.every((s) => lopsidedSide(s) === null),
  'typal archetypes must not be flagged lopsided',
);
console.log(
  'typal archetypes:',
  typalScores.map((s) => `${s.archetype.name}(${s.e})`).join(', '),
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
