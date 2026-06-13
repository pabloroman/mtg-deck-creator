import type { OwnedCard } from '../types';

/**
 * Collapse multiple printings of the same card (same oracleId) into one entry,
 * summing owned quantity and OR-ing the foil flag. The first printing
 * encountered is kept as the representative (image/set/collector); the input is
 * already name-sorted. `printingCount` records how many printings were merged.
 */
export function groupPrintings(cards: OwnedCard[]): OwnedCard[] {
  const map = new Map<string, OwnedCard>();
  for (const c of cards) {
    const key = c.oracleId || c.id;
    const ex = map.get(key);
    if (!ex) {
      map.set(key, { ...c, printingCount: 1 });
    } else {
      ex.quantity += c.quantity;
      ex.foil = ex.foil || c.foil;
      ex.printingCount = (ex.printingCount ?? 1) + 1;
    }
  }
  return [...map.values()];
}
