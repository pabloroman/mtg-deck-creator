import type { Color, DeckSection, OwnedCard, ResolvedArchetype, ScoredCard } from '../types';
import { groupPrintings } from '../search/groupPrintings';
import { relatedCards } from './synergy';

/** Collapse multiple printings of the same card to one logical card. */
const cardKey = (c: OwnedCard): string => c.oracleId || c.id;

/** A legendary creature — the only thing that can head a deck here. */
export function isCommander(card: OwnedCard): boolean {
  const t = card.typeLine.toLowerCase();
  return t.includes('legendary') && t.includes('creature');
}

/** The legendary creatures owned, one entry per card, name-sorted. */
export function listCommanders(cards: OwnedCard[]): OwnedCard[] {
  return groupPrintings(cards.filter(isCommander)).sort((a, b) => a.name.localeCompare(b.name));
}

/** The commander's colour identity as a set (empty = colourless). */
export function identitySet(commander: OwnedCard): Set<Color> {
  return new Set(commander.colorIdentity);
}

/** EDH legality: a card is playable iff its colour identity ⊆ the commander's. */
export function withinIdentity(card: OwnedCard, idSet: Set<Color>): boolean {
  return card.colorIdentity.every((c) => idSet.has(c));
}

const isLand = (card: OwnedCard): boolean => card.typeLine.toLowerCase().includes('land');
const hasAny = (card: OwnedCard, slugs: Set<string>): boolean =>
  card.tags.some((t) => slugs.has(t));

/**
 * Deck-role ontology. Concrete tag slugs (verified present in the collection) +
 * the type line for lands. Targets sum to 99 (+ commander = 100). Listed in the
 * order they're displayed; `roleOf` applies a fixed assignment priority so each
 * card lands in exactly one bucket regardless of this order.
 */
interface RoleDef {
  id: string;
  name: string;
  target: number;
  slugs?: string[]; // tag match (omitted for lands, matched by type line)
}

const ROLES: RoleDef[] = [
  { id: 'synergy', name: 'Synergy & payoffs', target: 32 },
  {
    id: 'ramp',
    name: 'Ramp',
    target: 10,
    slugs: [
      'ramp', 'land-ramp', 'multi-land-ramp', 'combat-ramp', 'ramp-with-set-s-mechanic',
      'mana-dork', 'mana-rock', 'utility-mana-rock', 'mana-rock-with-set-s-mechanic', 'mana-producer',
    ],
  },
  {
    id: 'draw',
    name: 'Card draw',
    target: 10,
    slugs: [
      'pure-draw', 'repeatable-pure-draw', 'draw-engine', 'burst-draw', 'cantrip',
      'card-advantage', 'impulsive-draw', 'repeatable-impulsive-draw', 'draw-matters',
    ],
  },
  {
    id: 'removal',
    name: 'Removal & interaction',
    target: 10,
    slugs: [
      'spot-removal', 'removal-creature', 'removal-destroy', 'removal-exile', 'removal-bounce',
      'repeatable-removal', 'multi-removal', 'removal-nonland', 'removal-artifact',
      'removal-enchantment', 'removal-planeswalker', 'sweeper', 'sweeper-one-sided',
      'counterspell-soft', 'counterspell-with-set-mechanic',
    ],
  },
  { id: 'lands', name: 'Lands', target: 37 },
];

// Fixed assignment priority: the first role a card qualifies for wins. Lands are
// matched by type line; the rest by tag. Anything left over is theme ('synergy').
const slugSets = new Map<string, Set<string>>(
  ROLES.filter((r) => r.slugs).map((r) => [r.id, new Set(r.slugs)] as const),
);
const ASSIGN_ORDER = ['ramp', 'removal', 'draw'] as const;

export function roleOf(card: OwnedCard): string {
  if (isLand(card)) return 'lands';
  for (const id of ASSIGN_ORDER) {
    if (hasAny(card, slugSets.get(id)!)) return id;
  }
  return 'synergy';
}

/**
 * Build a ~100-card deck skeleton for `commander` from the legal owned pool:
 * cards whose colour identity is a subset of the commander's. Cards are ranked
 * for synergy, then bucketed into deck roles (one bucket each) and capped at each
 * role's target. The skeleton is purely advisory — `poolCount` vs `target` shows
 * where the collection is deep or thin for this commander.
 */
export function buildSkeleton(
  commander: OwnedCard,
  cards: OwnedCard[],
  archetypes: ResolvedArchetype[],
): DeckSection[] {
  const idSet = identitySet(commander);
  const ckey = cardKey(commander);
  const pool = cards.filter((c) => withinIdentity(c, idSet) && cardKey(c) !== ckey);

  // Synergy ranking over the legal pool (relatedCards dedupes printings by
  // oracleId). True engine partners (the commander's payoffs / fodder) are
  // boosted above mere substitutes so the deck favours payoffs over redundant
  // copies of an effect; `similar` keeps the bucket populated for commanders
  // whose theme isn't in the curated ontology.
  const ENGINE_BOOST = 100;
  const rel = relatedCards(commander, pool, archetypes, pool.length);
  const sig = new Map<string, { score: number; reason: string }>();
  for (const h of rel.similar) sig.set(cardKey(h.card), { score: h.score, reason: h.reason });
  for (const h of rel.engine) {
    sig.set(cardKey(h.card), { score: ENGINE_BOOST + h.score, reason: h.reason });
  }

  const scored = (c: OwnedCard): ScoredCard => {
    const s = sig.get(cardKey(c));
    return { card: c, score: s?.score ?? 0, reason: s?.reason ?? '' };
  };

  // One logical card per oracleId, then bucket into exactly one role.
  const buckets = new Map<string, ScoredCard[]>(ROLES.map((r) => [r.id, []] as const));
  for (const c of groupPrintings(pool)) buckets.get(roleOf(c))!.push(scored(c));

  return ROLES.map((r): DeckSection => {
    let members = buckets.get(r.id)!;
    // The theme bucket only recommends cards with a real synergy signal.
    if (r.id === 'synergy') members = members.filter((m) => m.score > 0);
    members.sort(
      (a, b) =>
        b.score - a.score ||
        b.card.quantity - a.card.quantity ||
        a.card.name.localeCompare(b.card.name),
    );
    return { id: r.id, name: r.name, target: r.target, poolCount: members.length, picks: members.slice(0, r.target) };
  });
}
