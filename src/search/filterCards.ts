import type { OwnedCard } from '../types';
import type { ColorFilterKey } from '../lib/mana';
import { PLAYABLE_TAG } from '../lib/ontology';
import { keywordSlug, type IdentityTerm, type MvOp, type MvTerm } from './parseQuery';

export type ColorAxis = 'identity' | 'colors';
export type ColorMatch = 'subset' | 'any';

export interface FilterOptions {
  tagSlugs: string[];
  typeTerms: string[]; // type-line substrings, AND-ed together ([] = no type filter)
  keywords: string[]; // MTG keyword-ability slugs, AND-ed together ([] = no keyword filter)
  text: string;
  colors: ColorFilterKey[]; // selected color toggles ([] = no color filter)
  axis: ColorAxis;
  match: ColorMatch;
  rarities: string[]; // selected rarity values ([] = no rarity filter)
  setCodes: string[]; // set codes, OR-ed together ([] = no set filter)
  oracleTerms?: string[]; // lowercased rules-text substrings, AND-ed together
  mvTerms?: MvTerm[]; // mana-value comparisons, AND-ed together
  identityTerms?: IdentityTerm[]; // color-identity comparisons, AND-ed together
  pauperOnly?: boolean; // when true, keep only Pauper-legal cards
  playableOnly?: boolean; // when true, keep only cards on the build's pull list
}

const MV_COMPARE: Record<MvOp, (cmc: number, n: number) => boolean> = {
  '=': (cmc, n) => cmc === n,
  '<': (cmc, n) => cmc < n,
  '<=': (cmc, n) => cmc <= n,
  '>': (cmc, n) => cmc > n,
  '>=': (cmc, n) => cmc >= n,
};

/** Set comparison of a card's color identity against a term: <= subset, >= superset, = both. */
function matchesIdentity(identity: string[], { op, colors }: IdentityTerm): boolean {
  const within = identity.every((c) => colors.includes(c));
  const covers = colors.every((c) => identity.includes(c));
  if (op === '<=') return within;
  if (op === '>=') return covers;
  if (op === '=') return within && covers;
  return op === '<' ? within && !covers : covers && !within;
}

/** The color keys a card occupies on the chosen axis ('C' for colorless). */
export function cardColorKeys(card: OwnedCard, axis: ColorAxis): ColorFilterKey[] {
  const arr = axis === 'identity' ? card.colorIdentity : card.colors;
  return arr.length ? (arr as ColorFilterKey[]) : ['C'];
}

/** Pure filter: tag (AND) ∧ type (AND) ∧ keyword (AND) ∧ name substring ∧ color ∧ rarity ∧ set ∧ mana value ∧ color identity ∧ rules text. */
export function filterCards(cards: OwnedCard[], opts: FilterOptions): OwnedCard[] {
  const { tagSlugs, typeTerms, keywords, text, colors, axis, match, rarities, setCodes, pauperOnly,
    playableOnly, mvTerms = [], oracleTerms = [], identityTerms = [] } = opts;
  const colorSet = new Set(colors);
  const raritySet = new Set(rarities);
  const setCodeSet = new Set(setCodes);

  return cards.filter((card) => {
    if (pauperOnly && !card.pauperLegal) return false;
    if (playableOnly && !card.tags.includes(PLAYABLE_TAG)) return false;
    if (setCodeSet.size && !setCodeSet.has(card.set.toLowerCase())) return false;
    for (const t of mvTerms) if (!MV_COMPARE[t.op](card.cmc, t.value)) return false;
    for (const t of identityTerms) if (!matchesIdentity(card.colorIdentity, t)) return false;
    for (const slug of tagSlugs) {
      if (!card.tags.includes(slug)) return false;
    }
    if (typeTerms.length) {
      const typeLine = card.typeLine.toLowerCase();
      for (const term of typeTerms) if (!typeLine.includes(term)) return false;
    }
    if (keywords.length) {
      const cardKeywords = new Set(card.keywords.map(keywordSlug));
      for (const k of keywords) if (!cardKeywords.has(k)) return false;
    }
    if (oracleTerms.length) {
      const oracle = card.oracleText.toLowerCase();
      for (const term of oracleTerms) if (!oracle.includes(term)) return false;
    }
    if (text && !card.name.toLowerCase().includes(text)) return false;

    if (raritySet.size && !raritySet.has(card.rarity)) return false;

    if (colorSet.size) {
      const keys = cardColorKeys(card, axis);
      if (match === 'subset') {
        // card playable in a deck of exactly the selected colors
        for (const k of keys) if (!colorSet.has(k)) return false;
      } else {
        // shares at least one selected color
        if (!keys.some((k) => colorSet.has(k))) return false;
      }
    }
    return true;
  });
}
