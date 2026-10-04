import type { Color, OwnedCard } from '../types';
import { groupPrintings } from '../search/groupPrintings';
import { identitySet, withinIdentity, isCommander } from './commander';

/** A user-built deck. 'standard' = generic 60-card constructed. */
export type DeckFormat = 'commander' | 'standard';

/** One logical card in a deck, keyed by oracleId, with the in-deck copy count. */
export interface DeckEntry {
  oracleId: string; // cardKey of the owned card (logical card, not a printing)
  quantity: number; // copies IN the deck (>= 1); distinct from copies owned
}

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  commanderOracleId: string | null; // commander format only; never also in `entries`
  entries: DeckEntry[];
  createdAt: number;
  updatedAt: number;
}

/** Logical-card key, mirroring groupPrintings so owned/deck counts line up. */
export const cardKey = (c: OwnedCard): string => c.oracleId || c.id;

/** oracleId|id -> one representative (grouped) card; `.quantity` = total owned. */
export type CardIndex = Map<string, OwnedCard>;

export function buildCardIndex(cards: OwnedCard[]): CardIndex {
  const map: CardIndex = new Map();
  for (const c of groupPrintings(cards)) map.set(cardKey(c), c);
  return map;
}

// --- format rules ---------------------------------------------------------

export interface FormatRule {
  label: string;
  targetCount: number; // commander: exactly this; standard: minimum
  exactCount: boolean;
  copyLimit: number; // per non-basic logical card
  requiresCommander: boolean;
  enforcesColorIdentity: boolean;
}

export const FORMAT_RULES: Record<DeckFormat, FormatRule> = {
  commander: {
    label: 'Commander',
    targetCount: 100,
    exactCount: true,
    copyLimit: 1,
    requiresCommander: true,
    enforcesColorIdentity: true,
  },
  standard: {
    label: '60-card',
    targetCount: 60,
    exactCount: false,
    copyLimit: 4,
    requiresCommander: false,
    enforcesColorIdentity: false,
  },
};

// --- card predicates ------------------------------------------------------

export function isLand(card: OwnedCard): boolean {
  return card.typeLine.toLowerCase().includes('land');
}

export function isBasicLand(card: OwnedCard): boolean {
  const t = card.typeLine.toLowerCase();
  return t.includes('basic') && t.includes('land');
}

/**
 * Max copies of `card` a `format` deck may hold, capped at the copies owned
 * ("cap at owned" — decks are strictly buildable from the collection). Basic
 * lands ignore the format copy-limit but are still bounded by what you own.
 */
export function copyCap(card: OwnedCard, format: DeckFormat, owned: number): number {
  const limit = isBasicLand(card) ? owned : Math.min(FORMAT_RULES[format].copyLimit, owned);
  return Math.max(0, limit);
}

// --- grouping by card type (for the editor) -------------------------------

export type CardTypeGroup =
  | 'Creature'
  | 'Planeswalker'
  | 'Instant'
  | 'Sorcery'
  | 'Artifact'
  | 'Enchantment'
  | 'Battle'
  | 'Land'
  | 'Other';

// Display order in the editor.
const TYPE_ORDER: CardTypeGroup[] = [
  'Creature',
  'Planeswalker',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Battle',
  'Land',
  'Other',
];

/**
 * The single bucket a card belongs to. Classification priority differs from
 * display order: lands win (so creature-lands group under Lands), then creatures
 * (so artifact/enchantment creatures group under Creatures), then the rest.
 */
export function primaryType(card: OwnedCard): CardTypeGroup {
  const t = card.typeLine.toLowerCase();
  if (t.includes('land')) return 'Land';
  if (t.includes('creature')) return 'Creature';
  if (t.includes('planeswalker')) return 'Planeswalker';
  if (t.includes('instant')) return 'Instant';
  if (t.includes('sorcery')) return 'Sorcery';
  if (t.includes('artifact')) return 'Artifact';
  if (t.includes('enchantment')) return 'Enchantment';
  if (t.includes('battle')) return 'Battle';
  return 'Other';
}

export interface ResolvedEntry {
  entry: DeckEntry;
  card: OwnedCard | null; // null = no longer in the collection
  owned: number; // total copies owned (0 if unresolved)
}

export interface DeckGroup {
  type: CardTypeGroup;
  cards: ResolvedEntry[];
  count: number; // sum of in-deck quantities in this group
}

/** Resolve + bucket a deck's entries by card type; empty groups omitted. */
export function groupByType(deck: Deck, index: CardIndex): DeckGroup[] {
  const buckets = new Map<CardTypeGroup, ResolvedEntry[]>();
  for (const entry of deck.entries) {
    const card = index.get(entry.oracleId) ?? null;
    const owned = card?.quantity ?? 0;
    const type: CardTypeGroup = card ? primaryType(card) : 'Other';
    const re: ResolvedEntry = { entry, card, owned };
    const arr = buckets.get(type);
    if (arr) arr.push(re);
    else buckets.set(type, [re]);
  }

  const groups: DeckGroup[] = [];
  for (const type of TYPE_ORDER) {
    const cards = buckets.get(type);
    if (!cards || cards.length === 0) continue;
    cards.sort((a, b) => (a.card?.name ?? '').localeCompare(b.card?.name ?? ''));
    const count = cards.reduce((n, c) => n + c.entry.quantity, 0);
    groups.push({ type, cards, count });
  }
  return groups;
}

// --- stats ----------------------------------------------------------------

export interface DeckStats {
  mainCount: number; // sum of entry quantities (excludes the commander)
  totalWithCommander: number; // mainCount + (commander ? 1 : 0)
  target: number;
  colorIdentity: Color[]; // union across entries + commander
  nonLandCount: number;
}

export function deckStats(deck: Deck, index: CardIndex): DeckStats {
  const rule = FORMAT_RULES[deck.format];
  const idSet = new Set<Color>();
  let mainCount = 0;
  let nonLandCount = 0;

  for (const entry of deck.entries) {
    mainCount += entry.quantity;
    const card = index.get(entry.oracleId);
    if (!card) continue;
    if (!isLand(card)) nonLandCount += entry.quantity;
    for (const col of card.colorIdentity) idSet.add(col);
  }

  const hasCommander = deck.format === 'commander' && deck.commanderOracleId != null;
  const commanderCard = hasCommander ? index.get(deck.commanderOracleId as string) : undefined;
  if (commanderCard) for (const col of commanderCard.colorIdentity) idSet.add(col);

  const order: Color[] = ['W', 'U', 'B', 'R', 'G'];
  return {
    mainCount,
    totalWithCommander: mainCount + (hasCommander ? 1 : 0),
    target: rule.targetCount,
    colorIdentity: order.filter((c) => idSet.has(c)),
    nonLandCount,
  };
}

/**
 * Nonland cards per mana value, weighted by in-deck copies: index = mana value, the
 * last bucket is 7+. The commander counts; cards missing from the collection don't.
 */
export function manaCurve(deck: Deck, index: CardIndex): number[] {
  const curve = new Array<number>(8).fill(0);
  const add = (oracleId: string, quantity: number) => {
    const card = index.get(oracleId);
    if (card && !isLand(card)) curve[Math.min(Math.floor(card.cmc), 7)] += quantity;
  };
  for (const entry of deck.entries) add(entry.oracleId, entry.quantity);
  if (deck.format === 'commander' && deck.commanderOracleId) add(deck.commanderOracleId, 1);
  return curve;
}

// --- export ---------------------------------------------------------------

/**
 * Plain-text decklist ("<qty> <name>" per line) for clipboard export. Import-safe
 * across Moxfield / Archidekt / Arena / Scryfall: no headers, just lines. The
 * commander (if any) leads, separated by a blank line. Cards are ordered by the
 * editor's type grouping; unresolved entries keep a placeholder so counts hold.
 */
export function deckToText(deck: Deck, index: CardIndex): string {
  const lines: string[] = [];
  if (deck.format === 'commander' && deck.commanderOracleId) {
    const cmd = index.get(deck.commanderOracleId);
    lines.push(`1 ${cmd?.name ?? 'Unknown commander'}`);
    lines.push('');
  }
  for (const group of groupByType(deck, index)) {
    for (const re of group.cards) {
      lines.push(`${re.entry.quantity} ${re.card?.name ?? 'Unknown card'}`);
    }
  }
  return lines.join('\n');
}

// --- validation -----------------------------------------------------------

export type DeckIssueKind =
  | 'count-under'
  | 'count-over'
  | 'copy-limit'
  | 'identity'
  | 'no-commander'
  | 'commander-not-legendary'
  | 'unresolved';

export interface DeckIssue {
  kind: DeckIssueKind;
  severity: 'error' | 'warning';
  message: string;
  oracleId?: string; // set for per-card issues (highlights the row)
}

const plural = (n: number) => (n === 1 ? '' : 's');

/** Format-legality check; returns every issue found (table-driven per format). */
export function validateDeck(deck: Deck, index: CardIndex): DeckIssue[] {
  const rule = FORMAT_RULES[deck.format];
  const issues: DeckIssue[] = [];
  const stats = deckStats(deck, index);

  // Commander presence / legality, and derive the identity set for entry checks.
  let idSet: Set<Color> | null = null;
  if (rule.requiresCommander) {
    if (!deck.commanderOracleId) {
      issues.push({ kind: 'no-commander', severity: 'error', message: 'No commander chosen.' });
    } else {
      const cmd = index.get(deck.commanderOracleId);
      if (!cmd) {
        issues.push({
          kind: 'unresolved',
          severity: 'warning',
          message: 'Commander is no longer in your collection.',
          oracleId: deck.commanderOracleId,
        });
      } else if (!isCommander(cmd)) {
        issues.push({
          kind: 'commander-not-legendary',
          severity: 'error',
          message: `${cmd.name} can’t be a commander.`,
          oracleId: deck.commanderOracleId,
        });
      } else {
        idSet = identitySet(cmd);
      }
    }
  }

  // Count.
  const count = stats.totalWithCommander;
  if (count < rule.targetCount) {
    const need = rule.targetCount - count;
    issues.push({
      kind: 'count-under',
      severity: 'error',
      message: `${need} more card${plural(need)} needed (${count}/${rule.targetCount}${rule.exactCount ? '' : ' min'}).`,
    });
  } else if (rule.exactCount && count > rule.targetCount) {
    const over = count - rule.targetCount;
    issues.push({
      kind: 'count-over',
      severity: 'error',
      message: `${over} card${plural(over)} over the ${rule.targetCount}-card limit.`,
    });
  }

  // Per-entry checks.
  for (const entry of deck.entries) {
    const card = index.get(entry.oracleId);
    if (!card) {
      issues.push({
        kind: 'unresolved',
        severity: 'warning',
        message: 'This card is no longer in your collection.',
        oracleId: entry.oracleId,
      });
      continue;
    }
    if (deck.commanderOracleId && entry.oracleId === deck.commanderOracleId) {
      issues.push({
        kind: 'copy-limit',
        severity: 'error',
        message: `${card.name} is your commander and can’t also be in the 99.`,
        oracleId: entry.oracleId,
      });
    }
    if (!isBasicLand(card) && entry.quantity > rule.copyLimit) {
      const msg =
        rule.copyLimit === 1
          ? `${card.name}: singleton — only 1 copy allowed (have ${entry.quantity}).`
          : `${card.name}: max ${rule.copyLimit} copies (have ${entry.quantity}).`;
      issues.push({ kind: 'copy-limit', severity: 'error', message: msg, oracleId: entry.oracleId });
    }
    if (rule.enforcesColorIdentity && idSet && !withinIdentity(card, idSet)) {
      issues.push({
        kind: 'identity',
        severity: 'error',
        message: `${card.name} is outside the commander’s colour identity.`,
        oracleId: entry.oracleId,
      });
    }
  }

  return issues;
}
