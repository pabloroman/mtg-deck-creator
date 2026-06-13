export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

/** A single card the user owns, enriched with Scryfall data + oracle tags. */
export interface OwnedCard {
  id: string; // Scryfall printing UUID (default-cards id) — primary key
  oracleId: string; // oracle_id, used for tag lookup
  name: string;
  manaCost: string; // "" for lands / DFC backs
  cmc: number;
  typeLine: string;
  colors: Color[]; // [] = colorless
  colorIdentity: Color[]; // [] = colorless; primary filter axis
  rarity: string;
  set: string; // set code, e.g. "mkm"
  setName: string;
  collectorNumber: string;
  image: string; // normal-size URL (DFC -> front face)
  imageBack?: string; // back face for transform / modal_dfc
  layout: string;
  quantity: number; // total copies owned of this printing
  foil: boolean; // owns at least one foil copy
  tags: string[]; // oracle tag slugs ([] if untagged)
}

/** Metadata for a tag that appears in the collection. */
export interface TagIndexEntry {
  slug: string; // the otag:<slug> key
  label: string;
  description: string | null;
  aliases: string[];
  count: number; // number of owned distinct cards carrying this tag
}

export interface CollectionData {
  cards: OwnedCard[];
  tags: TagIndexEntry[];
}
