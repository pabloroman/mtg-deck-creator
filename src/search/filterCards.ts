import type { OwnedCard } from '../types';
import type { ColorFilterKey } from '../lib/mana';
import { keywordSlug } from './parseQuery';

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
  pauperOnly?: boolean; // when true, keep only Pauper-legal cards
}

/** The color keys a card occupies on the chosen axis ('C' for colorless). */
export function cardColorKeys(card: OwnedCard, axis: ColorAxis): ColorFilterKey[] {
  const arr = axis === 'identity' ? card.colorIdentity : card.colors;
  return arr.length ? (arr as ColorFilterKey[]) : ['C'];
}

/** Pure filter: tag (AND) ∧ type (AND) ∧ keyword (AND) ∧ name substring ∧ color ∧ rarity. */
export function filterCards(cards: OwnedCard[], opts: FilterOptions): OwnedCard[] {
  const { tagSlugs, typeTerms, keywords, text, colors, axis, match, rarities, pauperOnly } = opts;
  const colorSet = new Set(colors);
  const raritySet = new Set(rarities);

  return cards.filter((card) => {
    if (pauperOnly && !card.pauperLegal) return false;
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
