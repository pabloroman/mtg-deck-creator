import type {
  ArchetypeScore,
  Color,
  OwnedCard,
  ResolvedArchetype,
  SynergyHit,
} from '../types';
import { creatureSubtypes, isCosmetic, typeTokens } from './ontology';

// --- tuning constants ---
const SURPLUS_W = 0.1; // surplus is only a minor tiebreaker; engine dominates
const LOPSIDED_BALANCE = 0.34; // ratio below which an archetype is "lopsided"
const LOPSIDED_MIN = 60; // ...and only if the thin side is genuinely scarce

/** Collapse multiple printings of the same card to one logical card. */
const cardKey = (c: OwnedCard): string => c.oracleId || c.id;

const hasAny = (tags: string[], slugs: Set<string>): boolean => {
  for (const t of tags) if (slugs.has(t)) return true;
  return false;
};

/**
 * Score every archetype against the collection. Depth is driven by the *paired*
 * engine (min of enabler-cards and payoff-cards); a deep but unpaired bench only
 * nudges the score. Sorted best-first.
 */
export function scoreArchetypes(
  cards: OwnedCard[],
  archetypes: ResolvedArchetype[],
): ArchetypeScore[] {
  // Typal archetypes count MEMBERS by creature subtype, not by tag. Parse each
  // card's subtypes once (only when some archetype actually needs them).
  const anyTypal = archetypes.some((a) => a.subtypes?.length);
  const subCache = anyTypal
    ? new Map(cards.map((c) => [c, new Set(creatureSubtypes(c.typeLine))] as const))
    : null;

  return archetypes
    .map((a): ArchetypeScore => {
      const E = new Set(a.enablers);
      const P = new Set(a.payoffs);
      const subs = a.subtypes?.length ? new Set(a.subtypes) : null;
      const eCards = new Set<string>();
      const pCards = new Set<string>();
      const colorCount = new Map<Color, number>();
      for (const card of cards) {
        let isMember = false;
        if (subs && subCache) {
          const cs = subCache.get(card);
          if (cs) for (const s of subs) if (cs.has(s)) { isMember = true; break; }
        }
        const isE = isMember || hasAny(card.tags, E);
        const isP = hasAny(card.tags, P);
        if (!isE && !isP) continue;
        const key = cardKey(card);
        if (isE) eCards.add(key);
        if (isP) pCards.add(key);
        for (const col of card.colorIdentity) {
          colorCount.set(col, (colorCount.get(col) ?? 0) + 1);
        }
      }
      const e = eCards.size;
      const p = pCards.size;
      const engine = Math.min(e, p);
      const surplus = Math.max(e, p) - engine;
      const score = engine + SURPLUS_W * surplus;
      const balance = e + p === 0 ? 0 : Math.min(e, p) / Math.max(e, p);
      const colors = [...colorCount.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 2)
        .map(([c]) => c);
      return { archetype: a, e, p, engine, surplus, score, balance, colors };
    })
    .sort((a, b) => b.score - a.score);
}

/** Which side of an archetype is too thin to function, if any. */
export function lopsidedSide(s: ArchetypeScore): 'enablers' | 'payoffs' | null {
  // Typal archetypes are members + a shared anthem pool — "thin on payoffs" is
  // expected and not actionable, so don't flag them.
  if (s.archetype.subtypes?.length) return null;
  if (s.balance >= LOPSIDED_BALANCE || Math.min(s.e, s.p) >= LOPSIDED_MIN) return null;
  return s.e > s.p ? 'payoffs' : 'enablers'; // the THIN side
}

export interface CardArchetypeRole {
  archetype: ResolvedArchetype;
  enabler: boolean;
  payoff: boolean;
}

/** The archetypes a card participates in, and in which role(s). */
export function cardRoles(
  card: OwnedCard,
  archetypes: ResolvedArchetype[],
): CardArchetypeRole[] {
  const out: CardArchetypeRole[] = [];
  for (const a of archetypes) {
    const enabler = a.enablers.some((s) => card.tags.includes(s));
    const payoff = a.payoffs.some((s) => card.tags.includes(s));
    if (enabler || payoff) out.push({ archetype: a, enabler, payoff });
  }
  return out;
}

/** Two cards are colour-compatible if they could share a deck's identity. */
function colorCompatible(a: OwnedCard, b: OwnedCard): boolean {
  if (a.colorIdentity.length === 0 || b.colorIdentity.length === 0) return true;
  const set = new Set(a.colorIdentity);
  return b.colorIdentity.some((c) => set.has(c));
}

/** Cards related to a selected card, split by the kind of relationship. */
export interface RelatedCards {
  /** Complementary combo pieces: they fill the role the selected card sets up
   *  (an outlet's death-trigger payoffs, a payoff's enablers, …). */
  engine: SynergyHit[];
  /** Functional substitutes: cards with overlapping effects / the same role. */
  similar: SynergyHit[];
}

const COLOR_BONUS = 0.3; // minor tiebreak: cards that could share a deck identity
const TYPE_W = 0.5; // type/subtype agreement as a similarity factor (balanced nudge)
const TYPE_IDF_CAP = 4.0; // clamp per-token idf so a lone exotic subtype can't dominate

/**
 * Find the owned cards related to `selected`, split into two lists:
 *
 *  - `engine`  — the curated enabler<->payoff complement: cards that fill the
 *    *opposite* role the selected card sets up (e.g. a sacrifice outlet's
 *    death-trigger payoffs). Cards that merely duplicate the selected card's
 *    *own* role are deliberately excluded here — they're substitutes, not an
 *    engine. Ranked by idf-weighted strength of the complementary tags, so a
 *    real payoff beats one that only carries a common, generic payoff tag.
 *  - `similar` — functional substitutes: weighted (TF-IDF) overlap of
 *    non-cosmetic tags, catching same-effect cards the ontology doesn't name.
 *
 * A card appears in at most one list (engine wins). Each list is best-first and
 * capped at `limit`.
 */
export function relatedCards(
  selected: OwnedCard,
  cards: OwnedCard[],
  archetypes: ResolvedArchetype[],
  limit = 12,
): RelatedCards {
  // Precompute the selected card's archetype roles (as fast slug sets). Typal
  // archetypes are a dashboard-only concept (members + a shared anthem pool), so
  // they're excluded here to avoid leaking generic anthems into related cards.
  const synArchetypes = archetypes.filter((a) => !a.subtypes?.length);
  const roles = cardRoles(selected, synArchetypes).map((r) => ({
    name: r.archetype.name,
    selEnabler: r.enabler,
    selPayoff: r.payoff,
    enablers: new Set(r.archetype.enablers),
    payoffs: new Set(r.archetype.payoffs),
  }));

  const selTags = new Set(selected.tags.filter((t) => !isCosmetic(t)));
  if (roles.length === 0 && selTags.size === 0) return { engine: [], similar: [] };

  // Document frequency over non-cosmetic tags AND type tokens, for idf weighting.
  // Type tokens are parsed once per card here and cached for the candidate loop.
  const df = new Map<string, number>();
  const typeDf = new Map<string, number>();
  const typeCache = new Map<OwnedCard, string[]>();
  for (const c of cards) {
    for (const t of c.tags) {
      if (!isCosmetic(t)) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const tt = typeTokens(c.typeLine);
    typeCache.set(c, tt);
    for (const t of tt) typeDf.set(t, (typeDf.get(t) ?? 0) + 1);
  }
  const N = cards.length;
  const idf = (t: string): number => Math.log(N / ((df.get(t) ?? 0) + 1));
  const typeIdf = (t: string): number => Math.log(N / ((typeDf.get(t) ?? 0) + 1));
  const selTypes = new Set(typeCache.get(selected) ?? typeTokens(selected.typeLine));

  const seen = new Set<string>([cardKey(selected)]);
  const engine: SynergyHit[] = [];
  const similar: SynergyHit[] = [];

  for (const cand of cards) {
    const key = cardKey(cand);
    if (seen.has(key)) continue; // de-dupe printings + skip self

    // 1) curated archetype relations: is the candidate a complement (opposite
    //    role) and/or a duplicate of the selected card's own role?
    let complementStrength = 0; // idf-weighted sum of complementary tags
    let sharesRole = false; // candidate fills the SAME role as selected
    let reason = '';
    let bestComp = 0;
    for (const r of roles) {
      const candE = hasAny(cand.tags, r.enablers);
      const candP = hasAny(cand.tags, r.payoffs);
      if ((r.selEnabler && candE) || (r.selPayoff && candP)) sharesRole = true;
      // The complement of an enabler is a payoff, and vice versa. Weight each
      // matching tag by idf so a distinctive payoff outranks a generic one.
      const complementTags = r.selEnabler && candP ? r.payoffs : r.selPayoff && candE ? r.enablers : null;
      if (complementTags) {
        let s = 0;
        for (const t of cand.tags) if (complementTags.has(t)) s += idf(t);
        if (s > 0) {
          complementStrength += s;
          if (s > bestComp) {
            bestComp = s;
            reason = r.selEnabler ? `feeds your ${r.name} payoff` : `${r.name} enabler for this`;
          }
        }
      }
    }

    // 2) weighted overlap of non-cosmetic tags (the substitute signal)
    let overlap = 0;
    let shared = 0;
    for (const t of cand.tags) {
      if (selTags.has(t)) {
        overlap += idf(t);
        shared++;
      }
    }

    // 3) type/subtype agreement: two equipments are more alike than an equipment
    //    and a plain artifact. idf-weighted (distinctive subtypes outweigh generic
    //    types), capped so a lone exotic subtype can't outweigh the effect overlap.
    let typeBonus = 0;
    for (const t of typeCache.get(cand)!) {
      if (selTypes.has(t)) typeBonus += Math.min(typeIdf(t), TYPE_IDF_CAP);
    }
    typeBonus *= TYPE_W;

    const colorBonus = colorCompatible(selected, cand) ? COLOR_BONUS : 0;

    if (complementStrength > 0 && !sharesRole) {
      seen.add(key);
      engine.push({ card: cand, score: complementStrength + colorBonus, reason });
    } else if (shared > 0) {
      seen.add(key);
      similar.push({
        card: cand,
        score: overlap + typeBonus + colorBonus,
        reason: `similar effect · shares ${shared} tag${shared > 1 ? 's' : ''}`,
      });
    }
  }

  const rank = (a: SynergyHit, b: SynergyHit): number =>
    b.score - a.score ||
    b.card.quantity - a.card.quantity ||
    a.card.name.localeCompare(b.card.name);
  engine.sort(rank);
  similar.sort(rank);
  return { engine: engine.slice(0, limit), similar: similar.slice(0, limit) };
}
