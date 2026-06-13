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
    name: 'Combat / Attackers',
    description: 'Push evasive, buffed attackers and cash in attack triggers.',
    enablers: ['evasion', 'gives-double-strike', 'gives-first-strike', 'gives-menace', 'combat-ramp'],
    payoffs: ['attack-trigger', 'attacking-matters', 'attacking-matters-self'],
  },
  {
    id: 'landfall',
    name: 'Landfall / Lands',
    description: 'Drop extra lands and trigger landfall and lands-matter payoffs.',
    enablers: ['land-ramp', 'multi-land-ramp', 'play-additional-land', 'extra-land'],
    payoffs: ['landfall', 'lands-matter', 'differently-named-lands-matter'],
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
