export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

/** A single card the user owns, enriched with Scryfall data + oracle tags. */
export interface OwnedCard {
  id: string; // Scryfall printing UUID (default-cards id) — primary key
  oracleId: string; // oracle_id, used for tag lookup
  name: string;
  manaCost: string; // "" for lands / DFC backs
  cmc: number;
  typeLine: string;
  oracleText: string; // rules text; DFC faces joined with "//" ('' if none)
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
  keywords: string[]; // MTG keyword abilities, raw Scryfall display strings ([] if none)
  pauperLegal: boolean; // legal in the Pauper format (legalities.pauper === 'legal')
  edhrecRank?: number; // EDHREC popularity rank (lower = more played); absent if unranked
  printingCount?: number; // set only when printings are grouped (see groupPrintings)
}

/** Metadata for a tag that appears in the collection. */
export interface TagIndexEntry {
  slug: string; // the otag:<slug> key
  label: string;
  description: string | null;
  aliases: string[];
  count: number; // number of owned distinct cards carrying this tag
}

/** A curated deck archetype as an enabler -> payoff pairing. Role values are tag
 *  slugs referenced *before* DAG expansion (hub slug = its whole subtree). */
export interface ArchetypeDef {
  id: string;
  name: string;
  description: string;
  enablers: string[]; // hub or exact slugs (expanded at build time)
  payoffs: string[];
  subtypes?: string[]; // typal archetypes: a card is a MEMBER (counts as an enabler) if
  //                      its creature type line includes one of these (e.g. ['goblin'])
}

/** An archetype after build-time DAG expansion: roles are concrete slugs that
 *  actually appear in the collection. This is what ships in archetypes.json. */
export interface ResolvedArchetype {
  id: string;
  name: string;
  description: string;
  enablers: string[]; // concrete in-collection slugs
  payoffs: string[];
  subtypes?: string[]; // typal archetypes: members matched by creature subtype (see ArchetypeDef)
}

export type SynergyRole = 'enabler' | 'payoff';

/** How well the collection supports one archetype (computed client-side). */
export interface ArchetypeScore {
  archetype: ResolvedArchetype;
  e: number; // distinct owned cards matching an enabler slug
  p: number; // distinct owned cards matching a payoff slug
  engine: number; // min(e, p) — the paired, functional core
  surplus: number; // max(e, p) - engine — unpaired heavy side
  score: number; // engine*2 + surplus*0.5
  balance: number; // min(e,p)/max(e,p) in [0,1]; low = lopsided
  colors: Color[]; // dominant colors among matched cards (display only)
}

/** A recommended synergy partner for a given card. */
export interface SynergyHit {
  card: OwnedCard;
  score: number;
  reason: string;
}

/** A card placed into a commander deck skeleton, with its synergy signal. */
export interface ScoredCard {
  card: OwnedCard;
  score: number; // synergy score with the commander (0 if no synergy signal)
  reason: string; // short human reason, or '' for plain functional picks
}

/** One role bucket of a commander deck skeleton (lands, ramp, draw, …). */
export interface DeckSection {
  id: string;
  name: string;
  target: number; // recommended number of cards for this role
  picks: ScoredCard[]; // chosen cards, best-first, capped at target
  poolCount: number; // legal owned cards that fit this role (>= picks.length)
}

/** Whole-set facts from Scryfall (not just owned cards). Ships in sets.json keyed by set code. */
export interface SetInfo {
  releasedAt: string; // YYYY-MM-DD ('' if unknown)
  total: number; // distinct cards (oracle ids) in the set
}

export interface CollectionData {
  cards: OwnedCard[];
  tags: TagIndexEntry[];
  archetypes: ResolvedArchetype[];
  sets: Record<string, SetInfo>;
}
