import type { OwnedCard } from '../types';

/** Aggregated ownership stats for one MTG set. */
export interface SetSummary {
  code: string; // card.set, e.g. "woe"
  name: string; // card.setName
  distinct: number; // distinct printings owned in this set (rows)
  copies: number; // Σ quantity across those printings
  foils: number; // printings with at least one foil copy
  rarities: Record<string, number>; // distinct printings per rarity
}

/**
 * Roll the collection up by set: one {@link SetSummary} per set code, sorted by
 * distinct cards owned (desc), then name. Each card row is a printing in exactly
 * one set, so `distinct` is the number of rows and `copies` sums their quantities.
 */
export function summarizeSets(cards: OwnedCard[]): SetSummary[] {
  const map = new Map<string, SetSummary>();
  for (const c of cards) {
    let s = map.get(c.set);
    if (!s) {
      s = { code: c.set, name: c.setName, distinct: 0, copies: 0, foils: 0, rarities: {} };
      map.set(c.set, s);
    }
    s.distinct += 1;
    s.copies += c.quantity;
    if (c.foil) s.foils += 1;
    s.rarities[c.rarity] = (s.rarities[c.rarity] ?? 0) + 1;
  }
  return [...map.values()].sort((a, b) => b.distinct - a.distinct || a.name.localeCompare(b.name));
}
