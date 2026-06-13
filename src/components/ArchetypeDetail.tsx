import { useMemo } from 'react';
import type { ArchetypeScore, Color, OwnedCard } from '../types';
import { COLOR_META } from '../lib/mana';
import { lopsidedSide } from '../lib/synergy';
import { creatureSubtypes } from '../lib/ontology';
import { CardGrid } from './CardGrid';

interface Props {
  score: ArchetypeScore;
  cards: OwnedCard[];
  onBack: () => void;
  onSelectCard: (card: OwnedCard) => void;
}

/** Collapse multiple printings of the same card to one tile. */
function dedupe(list: OwnedCard[]): OwnedCard[] {
  const seen = new Set<string>();
  const out: OwnedCard[] = [];
  for (const c of list) {
    const k = c.oracleId || c.id;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

export function ArchetypeDetail({ score, cards, onBack, onSelectCard }: Props) {
  const a = score.archetype;
  const E = useMemo(() => new Set(a.enablers), [a]);
  const P = useMemo(() => new Set(a.payoffs), [a]);
  // Typal archetypes match members by creature subtype rather than enabler tags.
  const subs = useMemo(() => (a.subtypes?.length ? new Set(a.subtypes) : null), [a]);
  const thin = lopsidedSide(score);

  // `cards` arrive already color-filtered — the Archetypes page owns the color filter.
  const { enablers, payoffs } = useMemo(() => {
    const en: OwnedCard[] = [];
    const pa: OwnedCard[] = [];
    for (const c of cards) {
      const isMember = subs
        ? creatureSubtypes(c.typeLine).some((s) => subs.has(s))
        : c.tags.some((t) => E.has(t));
      if (isMember) en.push(c);
      if (c.tags.some((t) => P.has(t))) pa.push(c);
    }
    return { enablers: dedupe(en), payoffs: dedupe(pa) };
  }, [cards, E, P, subs]);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm text-sky-400 hover:text-sky-300"
      >
        ← All archetypes
      </button>

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-white">{a.name}</h2>
          <div className="flex gap-1">
            {score.colors.map((c: Color) => (
              <span
                key={c}
                title={COLOR_META[c].name}
                className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40"
                style={{ backgroundColor: COLOR_META[c].bg }}
              />
            ))}
          </div>
        </div>
        <p className="max-w-2xl text-sm text-zinc-400">{a.description}</p>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300">{score.e}</span> {subs ? 'members' : 'enablers'} ·{' '}
          <span className="text-zinc-300">{score.p}</span> payoffs ·{' '}
          <span className="text-zinc-300">{score.engine}</span> paired engine pieces
          {thin && (
            <span className="ml-2 font-medium text-amber-300">
              — deep in {thin === 'payoffs' ? 'enablers' : 'payoffs'}, thin on {thin}
            </span>
          )}
        </p>
      </div>

      <RoleSection
        title={subs ? 'Members' : 'Enablers'}
        hint={subs ? 'the tribe' : 'produce the resource'}
        cards={enablers}
        onSelectCard={onSelectCard}
      />
      <RoleSection
        title="Payoffs"
        hint={subs ? 'anthems & lords' : 'reward it'}
        cards={payoffs}
        onSelectCard={onSelectCard}
      />
    </div>
  );
}

function RoleSection({
  title,
  hint,
  cards,
  onSelectCard,
}: {
  title: string;
  hint: string;
  cards: OwnedCard[];
  onSelectCard: (c: OwnedCard) => void;
}) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {title}
        <span className="text-xs font-normal normal-case text-zinc-500">
          {cards.length} · {hint}
        </span>
      </h3>
      <CardGrid cards={cards} onSelect={onSelectCard} />
    </section>
  );
}
