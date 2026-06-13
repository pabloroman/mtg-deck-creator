/** Standard MTG rarities, low → high. Other Scryfall rarities (special, bonus)
 *  fall through and are appended after these when present in a collection. */
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'] as const;

/** Display chip per rarity: short label + the classic rarity colors. */
export const RARITY_META: Record<string, { label: string; bg: string; text: string }> = {
  common: { label: 'C', bg: '#1f1f24', text: '#d4d4d8' },
  uncommon: { label: 'U', bg: '#5a6b78', text: '#eef3f7' },
  rare: { label: 'R', bg: '#b6922e', text: '#1a1407' },
  mythic: { label: 'M', bg: '#c4491f', text: '#ffffff' },
};

/** Fallback chip for any rarity not in RARITY_META (e.g. "special", "bonus"). */
export const RARITY_FALLBACK = { label: '?', bg: '#3f3f46', text: '#e4e4e7' };

export function rarityMeta(rarity: string) {
  return RARITY_META[rarity] ?? { ...RARITY_FALLBACK, label: rarity.charAt(0).toUpperCase() };
}

/** Distinct rarities present in the collection, standard ones first (in order),
 *  then any extras alphabetically. */
export function orderRarities(present: Iterable<string>): string[] {
  const set = new Set(present);
  const ordered = RARITY_ORDER.filter((r) => set.has(r));
  const extras = [...set].filter((r) => !(RARITY_ORDER as readonly string[]).includes(r)).sort();
  return [...ordered, ...extras];
}
