import type { ArchetypeDef } from '../types';

/**
 * Curated synergy ontology. Each archetype is an enabler -> payoff pairing:
 * an *enabler* produces a resource or condition (a sacrifice outlet, self-mill,
 * a token maker) and a *payoff* rewards it (death triggers, reanimation, anthems).
 *
 * Role values are tag slugs that the build step (scripts/preprocess.ts) expands
 * through the Scryfall oracle-tag DAG to every descendant slug, then intersects
 * with the slugs actually present in the collection. Reference a *hub* slug
 * (e.g. 'sacrifice-outlet') to pull its whole subtree, or an exact leaf slug.
 *
 * Every slug below was verified against the collection's real tag vocabulary;
 * the build warns on any reference that resolves to zero owned cards, so the
 * ontology stays honest as the data changes.
 */
export const ARCHETYPES: ArchetypeDef[] = [
  {
    id: 'aristocrats',
    name: 'Aristocrats',
    description: 'Sacrifice your own creatures for value and drain opponents as they die.',
    enablers: ['sacrifice-outlet', 'repeatable-creature-tokens', 'synergy-token-creature'],
    payoffs: [
      'death-trigger',
      'death-trigger-self',
      'morbid',
      'drain-life',
      'drain-creature',
      'blood-artist-ability',
      'opponent-loses-life',
      'life-and-death-trigger-self',
    ],
  },
  {
    id: 'counters',
    name: '+1/+1 Counters',
    description: 'Pile +1/+1 counters onto creatures and reward going tall.',
    enablers: ['gives-pp-counters', 'repeatable-pp-counters'],
    payoffs: ['gains-pp-counters', 'pp-counters-matter', 'counters-matter'],
  },
  {
    id: 'reanimator',
    name: 'Reanimator / Graveyard',
    description: 'Fill your graveyard, then cheat powerful cards back into play.',
    enablers: ['mill-self', 'discard-outlet', 'graveyard-fuel', 'surveil', 'mulch'],
    payoffs: ['reanimate', 'delve'],
  },
  {
    id: 'spellslinger',
    name: 'Spellslinger',
    description: 'Chain cheap instants and sorceries to trigger cast payoffs.',
    enablers: ['cantrip', 'single-target-instant-sorcery'],
    payoffs: ['cast-trigger-you', 'cast-trigger-self', 'cast-trigger', 'second-spell-matters'],
  },
  {
    id: 'lifegain',
    name: 'Lifegain',
    description: 'Gain life repeatedly and turn that life total into an advantage.',
    enablers: ['lifegain'],
    payoffs: ['lifegain-matters'],
  },
  {
    id: 'tokens',
    name: 'Tokens / Go-wide',
    description: 'Flood the board with tokens and pump the whole team.',
    enablers: [
      'repeatable-creature-tokens',
      'repeatable-artifact-tokens',
      'synergy-token-creature',
      'temporary-token',
    ],
    payoffs: ['keyword-anthem', 'anthem', 'attacking-matters'],
  },
  {
    id: 'combat',
    name: 'Combat / Aggro',
    description: 'Push evasive, hasty, buffed attackers and cash in attack triggers.',
    enablers: [
      'evasion',
      'gives-double-strike',
      'gives-first-strike',
      'gives-menace',
      'combat-ramp',
      'gives-haste',
      'gains-haste',
      'synergy-haste',
    ],
    payoffs: ['attack-trigger', 'attacking-matters', 'attacking-matters-self'],
  },
  {
    id: 'landfall',
    name: 'Landfall / Lands',
    description: 'Drop extra lands and trigger landfall and lands-matter payoffs.',
    enablers: ['land-ramp', 'multi-land-ramp', 'play-additional-land', 'extra-land'],
    payoffs: ['landfall', 'lands-matter', 'differently-named-lands-matter'],
  },
  {
    id: 'artifacts',
    name: 'Artifacts',
    description: 'Churn out artifacts and treasures, then cash in artifacts-matter payoffs.',
    enablers: ['repeatable-artifact-tokens', 'repeatable-treasures'],
    payoffs: [
      'synergy-artifact',
      'artifactfall',
      'synergy-artifact-creature',
      'improvise',
      'metalcraft',
    ],
  },
  {
    id: 'vehicles',
    name: 'Vehicles / Crew',
    description: 'Crew powerful Vehicles and lean into vehicle synergies.',
    enablers: ['alternative-crewing', 'bring-your-own-crew', 'animate-vehicle'],
    payoffs: ['synergy-vehicle'],
  },
  {
    id: 'equipment',
    name: 'Equipment / Voltron',
    description: 'Suit up one creature with Equipment and push it through for the win.',
    enablers: [
      'synergy-equipment',
      'french-vanilla-equipment',
      'cost-reducer-equipment',
      'tutor-artifact-equipment',
    ],
    payoffs: ['evasion', 'gives-trample', 'gives-double-strike', 'unblockable'],
  },
  {
    id: 'enchantments',
    name: 'Enchantments',
    description: 'Build around enchantments and auras and their constellation-style payoffs.',
    enablers: ['cost-reducer-enchantment', 'impulse-enchantment'],
    payoffs: [
      'synergy-enchantment',
      'enchantmentfall',
      'synergy-enchantment-creature',
      'synergy-aura',
    ],
  },
  {
    id: 'madness',
    name: 'Discard / Madness',
    description: 'Discard your own cards as a resource and reward it with madness and value.',
    enablers: ['discard-outlet', 'free-discard-outlet', 'discard-outlet-creature', 'instant-speed-discard'],
    payoffs: ['madness', 'self-discard-matters', 'discarded-type-matters'],
  },
  {
    id: 'duress',
    name: 'Hand Disruption',
    description:
      'Strip the opponent’s hand with targeted discard. (A disruption package — the payoff side is small.)',
    enablers: ['thoughtseize', 'hate-discard', 'discard'],
    payoffs: ['opponent-discard-matters', 'self-discard-matters'],
  },
  {
    id: 'blink',
    name: 'Blink / Flicker',
    description: 'Flicker your creatures to re-use their enter- and leave-the-battlefield triggers.',
    enablers: ['flicker-creature', 'flicker-slow', 'flicker-permanent', 'flicker-artifact', 'bounce-self'],
    payoffs: ['enters-and-leaves-trigger-self', 'leaves-battlefield-trigger', 'leaves-trigger-self'],
  },
];

/**
 * Cosmetic / structural tags that describe a card in isolation and carry no
 * synergy signal (the loudest tags in this collection are these). Excluded from
 * the card-to-card TF-IDF similarity in synergy.ts. Note: a few of these (e.g.
 * 'single-target-instant-sorcery') are still used as *explicit* archetype
 * enablers above — that is intentional curation, separate from generic overlap.
 */
export const COSMETIC_TAGS = new Set<string>([
  'alliteration',
  'single-english-word-name',
  'two-english-word-name',
  'namesake-spell',
  'unique-type-line',
  'intervening-if-clause',
  'french-vanilla',
  'virtual-french-vanilla',
  'virtual-vanilla',
  'vanilla',
  'hand-neutral',
  'hand-positive',
  'drawback',
  'cheaper-than-mv',
  'more-expensive-than-mv',
  'card-names',
  'triggered-ability',
  'activated-ability',
  'single-target-instant-sorcery',
  'unique-french-vanilla',
]);

/** True if a tag is cosmetic/structural (exact match or a known noisy pattern). */
export function isCosmetic(slug: string): boolean {
  return (
    COSMETIC_TAGS.has(slug) ||
    slug.includes('vanilla') ||
    slug.startsWith('cycle-') ||
    slug.endsWith('-errata') ||
    slug.startsWith('draft-')
  );
}

/** Supertypes carry no card-to-card similarity signal — every legendary isn't
 *  "similar" to every other. Excluded from {@link typeTokens}. Note: 'kindred'
 *  (formerly 'tribal') is a real card *type*, not a supertype — keep it. */
const SUPERTYPES = new Set<string>([
  'legendary',
  'basic',
  'snow',
  'world',
  'ongoing',
  'host',
  'elite',
]);

const EM_DASH = '—'; // U+2014, separates types from subtypes in a type line

/**
 * Similarity tokens parsed from a Scryfall type line, namespaced by tier so a
 * card type ('t:') and a subtype ('st:') never collide with each other or with
 * an oracle tag of the same word:
 *
 *   'Artifact — Equipment'              -> ['t:artifact', 'st:equipment']
 *   'Legendary Artifact Creature — …'   -> 't:artifact', 't:creature' (no 'legendary')
 *   'Instant'                           -> ['t:instant']  (no subtype)
 *
 * Handles DFC faces (' // '), multiple pre-dash types, and supertype exclusion.
 */
export function typeTokens(typeLine: string): string[] {
  const out = new Set<string>();
  for (const face of typeLine.split(' // ')) {
    const [pre, post = ''] = face.split(EM_DASH);
    for (const w of pre.trim().toLowerCase().split(/\s+/)) {
      if (w && !SUPERTYPES.has(w)) out.add(`t:${w}`);
    }
    for (const w of post.trim().toLowerCase().split(/\s+/)) {
      if (w) out.add(`st:${w}`);
    }
  }
  return [...out];
}

/**
 * The creature subtypes (tribes) on a type line, e.g.
 *   'Legendary Creature — Goblin Warrior' -> ['goblin', 'warrior']
 *   'Artifact — Equipment'                -> []  (not a creature face)
 * Only subtypes from creature/kindred faces count, so equipment/aura/land
 * subtypes aren't mistaken for tribes. Used to drive typal archetypes.
 */
export function creatureSubtypes(typeLine: string): string[] {
  const out = new Set<string>();
  for (const face of typeLine.split(' // ')) {
    const [pre, post = ''] = face.split(EM_DASH);
    if (!/\b(creature|kindred)\b/i.test(pre)) continue;
    for (const w of post.trim().toLowerCase().split(/\s+/)) {
      if (w) out.add(w);
    }
  }
  return [...out];
}
