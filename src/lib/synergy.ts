import type {
  ArchetypeScore,
  Color,
  OwnedCard,
  ResolvedArchetype,
  SynergyHit,
} from '../types';
import { isCosmetic } from './ontology';

// --- tuning constants ---
const SURPLUS_W = 0.1; // surplus is only a minor tiebreaker; engine dominates
const COMPLEMENT_W = 3; // enabler <-> payoff of the same archetype (strongest signal)
const THEME_W = 1; // same role in the same archetype
const OVERLAP_CAP = 1.5; // max contribution from generic tag overlap
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
  return archetypes
    .map((a): ArchetypeScore => {
      const E = new Set(a.enablers);
      const P = new Set(a.payoffs);
      const eCards = new Set<string>();
      const pCards = new Set<string>();
      const colorCount = new Map<Color, number>();
      for (const card of cards) {
        const isE = hasAny(card.tags, E);
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

/**
 * Rank the owned cards that best synergize with `selected`, each with a short,
 * human reason. Curated enabler<->payoff relations dominate; weighted (TF-IDF)
 * overlap of non-cosmetic tags catches synergies the ontology doesn't name.
 */
export function synergyFor(
  selected: OwnedCard,
  cards: OwnedCard[],
  archetypes: ResolvedArchetype[],
  limit = 12,
): SynergyHit[] {
  // Precompute the selected card's archetype roles (as fast slug sets).
  const roles = cardRoles(selected, archetypes).map((r) => ({
    name: r.archetype.name,
    selEnabler: r.enabler,
    selPayoff: r.payoff,
    enablers: new Set(r.archetype.enablers),
    payoffs: new Set(r.archetype.payoffs),
  }));

  const selTags = new Set(selected.tags.filter((t) => !isCosmetic(t)));
  if (roles.length === 0 && selTags.size === 0) return [];

  // Document frequency over non-cosmetic tags, for idf weighting.
  const df = new Map<string, number>();
  for (const c of cards) {
    for (const t of c.tags) {
      if (!isCosmetic(t)) df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const N = cards.length;
  const idf = (t: string): number => Math.log(N / ((df.get(t) ?? 0) + 1));

  const selKey = cardKey(selected);
  const seen = new Set<string>([selKey]);
  const hits: SynergyHit[] = [];

  for (const cand of cards) {
    const key = cardKey(cand);
    if (seen.has(key)) continue; // de-dupe printings + skip self

    // 1) curated archetype relations
    let relScore = 0;
    let bestReason = '';
    let bestRel = 0;
    for (const r of roles) {
      const candE = hasAny(cand.tags, r.enablers);
      const candP = hasAny(cand.tags, r.payoffs);
      if (!candE && !candP) continue;
      const complement = (r.selEnabler && candP) || (r.selPayoff && candE);
      if (complement) {
        relScore += COMPLEMENT_W;
        if (COMPLEMENT_W > bestRel) {
          bestRel = COMPLEMENT_W;
          bestReason =
            r.selEnabler && candP ? `feeds your ${r.name} payoff` : `${r.name} enabler for this`;
        }
      } else {
        relScore += THEME_W;
        if (THEME_W > bestRel) {
          bestRel = THEME_W;
          bestReason = `shares the ${r.name} theme`;
        }
      }
    }

    // 2) weighted overlap of non-cosmetic tags
    let overlap = 0;
    let shared = 0;
    for (const t of cand.tags) {
      if (selTags.has(t)) {
        overlap += idf(t);
        shared++;
      }
    }
    const overlapScore = Math.min(overlap / 6, OVERLAP_CAP);

    const score = relScore + overlapScore + (colorCompatible(selected, cand) ? 0.3 : 0);
    if (score <= 0) continue;
    if (!bestReason) {
      if (shared === 0) continue; // nothing meaningful in common
      bestReason = `shares ${shared} tag${shared > 1 ? 's' : ''}`;
    }
    seen.add(key);
    hits.push({ card: cand, score, reason: bestReason });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
