import type { OwnedCard } from '../types';
import type { ColorFilterKey } from '../lib/mana';

export type ColorAxis = 'identity' | 'colors';
export type ColorMatch = 'subset' | 'any';

export interface FilterOptions {
  tagSlugs: string[];
  text: string;
  colors: ColorFilterKey[]; // selected color toggles ([] = no color filter)
  axis: ColorAxis;
  match: ColorMatch;
}

/** The color keys a card occupies on the chosen axis ('C' for colorless). */
export function cardColorKeys(card: OwnedCard, axis: ColorAxis): ColorFilterKey[] {
  const arr = axis === 'identity' ? card.colorIdentity : card.colors;
  return arr.length ? (arr as ColorFilterKey[]) : ['C'];
}

/** Pure filter: tag (AND) ∧ name substring ∧ color. */
export function filterCards(cards: OwnedCard[], opts: FilterOptions): OwnedCard[] {
  const { tagSlugs, text, colors, axis, match } = opts;
  const colorSet = new Set(colors);

  return cards.filter((card) => {
    for (const slug of tagSlugs) {
      if (!card.tags.includes(slug)) return false;
    }
    if (text && !card.name.toLowerCase().includes(text)) return false;

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
