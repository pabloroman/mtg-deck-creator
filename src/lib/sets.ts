import type { OwnedCard, SetInfo } from '../types';

/** Aggregated ownership stats for one MTG set. */
export interface SetSummary {
  code: string; // card.set, e.g. "woe"
  name: string; // card.setName
  releasedAt: string; // YYYY-MM-DD ('' if unknown)
  unique: number; // distinct cards (oracle ids) owned in this set
  total: number; // distinct cards in the whole set (0 if unknown)
  distinct: number; // distinct printings owned in this set (rows)
  copies: number; // Σ quantity across those printings
  foils: number; // printings with at least one foil copy
  rarities: Record<string, number>; // distinct cards (oracle ids) owned per rarity
  rarityTotals: Record<string, number>; // distinct cards in the whole set per rarity
}

/**
 * Roll the collection up by set: one {@link SetSummary} per set code, sorted by
 * release date (newest first), then name. Each card row is a printing in exactly
 * one set, so `distinct` is the number of rows and `copies` sums their quantities.
 */
export function summarizeSets(cards: OwnedCard[], info: Record<string, SetInfo>): SetSummary[] {
  const map = new Map<string, SetSummary>();
  const seen = new Set<string>(); // "set|oracle" and "set|rarity|oracle" already counted
  for (const c of cards) {
    let s = map.get(c.set);
    if (!s) {
      const i = info[c.set];
      s = {
        code: c.set,
        name: c.setName,
        releasedAt: i?.releasedAt ?? '',
        unique: 0,
        total: i?.total ?? 0,
        distinct: 0,
        copies: 0,
        foils: 0,
        rarities: {},
        rarityTotals: i?.rarities ?? {},
      };
      map.set(c.set, s);
    }
    s.distinct += 1;
    s.copies += c.quantity;
    if (c.foil) s.foils += 1;
    const oid = c.oracleId || c.name;
    if (!seen.has(`${c.set}|${oid}`)) {
      seen.add(`${c.set}|${oid}`);
      s.unique += 1;
    }
    if (!seen.has(`${c.set}|${c.rarity}|${oid}`)) {
      seen.add(`${c.set}|${c.rarity}|${oid}`);
      s.rarities[c.rarity] = (s.rarities[c.rarity] ?? 0) + 1;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.name.localeCompare(b.name),
  );
}
