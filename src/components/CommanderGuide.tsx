import { useMemo, useState } from 'react';
import type { Color, DeckSection, OwnedCard, ResolvedArchetype } from '../types';
import { COLOR_META } from '../lib/mana';
import { cardRoles } from '../lib/synergy';
import { buildSkeleton, listCommanders } from '../lib/commander';
import { CardGrid } from './CardGrid';
import { SynergyList } from './SynergyList';

interface Props {
  cards: OwnedCard[];
  archetypes: ResolvedArchetype[];
  commander: OwnedCard | null;
  onPickCommander: (card: OwnedCard | null) => void;
  onSelectCard: (card: OwnedCard) => void;
}

export function CommanderGuide({
  cards,
  archetypes,
  commander,
  onPickCommander,
  onSelectCard,
}: Props) {
  if (!commander) {
    return <CommanderPicker cards={cards} onPick={onPickCommander} />;
  }
  return (
    <CommanderSkeleton
      commander={commander}
      cards={cards}
      archetypes={archetypes}
      onChange={() => onPickCommander(null)}
      onSelectCard={onSelectCard}
    />
  );
}

// --- picker ---------------------------------------------------------------

function CommanderPicker({
  cards,
  onPick,
}: {
  cards: OwnedCard[];
  onPick: (card: OwnedCard) => void;
}) {
  const [q, setQ] = useState('');
  const commanders = useMemo(() => listCommanders(cards), [cards]);
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return text ? commanders.filter((c) => c.name.toLowerCase().includes(text)) : commanders;
  }, [commanders, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-white">Pick a commander</h2>
        <p className="text-sm text-zinc-400">
          {commanders.length} legendary creature{commanders.length === 1 ? '' : 's'} in your
          collection. Choose one to see the cards that fit its colours and synergize with it.
        </p>
      </div>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name…"
        className="w-full max-w-md rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      <CardGrid cards={filtered} onSelect={onPick} />
    </div>
  );
}

// --- skeleton -------------------------------------------------------------

function CommanderSkeleton({
  commander,
  cards,
  archetypes,
  onChange,
  onSelectCard,
}: {
  commander: OwnedCard;
  cards: OwnedCard[];
  archetypes: ResolvedArchetype[];
  onChange: () => void;
  onSelectCard: (card: OwnedCard) => void;
}) {
  const sections = useMemo(
    () => buildSkeleton(commander, cards, archetypes),
    [commander, cards, archetypes],
  );
  const themes = useMemo(
    () => cardRoles(commander, archetypes).map((r) => r.archetype.name),
    [commander, archetypes],
  );

  const chosen = sections.reduce((n, s) => n + s.picks.length, 0);

  return (
    <div className="space-y-6">
      {/* commander header */}
      <div className="flex flex-col gap-4 rounded-2xl bg-[#13161e] p-4 ring-1 ring-white/10 sm:flex-row">
        {commander.image ? (
          <img src={commander.image} alt={commander.name} className="w-28 shrink-0 self-center rounded-xl shadow sm:self-start" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-white">{commander.name}</h2>
              <p className="text-sm text-zinc-300">{commander.typeLine}</p>
              {commander.oracleText && (
                <p className="mt-1 max-w-prose whitespace-pre-line text-sm leading-snug text-zinc-400">
                  {commander.oracleText}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onChange}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
            >
              Change commander
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Identity</span>
              <IdentityDots identity={commander.colorIdentity} />
            </div>
            <span className="text-sm text-zinc-400">
              {chosen + 1} / 100 cards · {chosen} from your collection
            </span>
          </div>
          {themes.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Themes</span>
              {themes.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* role sections */}
      {sections.map((section) => (
        <Section key={section.id} section={section} onSelectCard={onSelectCard} />
      ))}
    </div>
  );
}

function Section({
  section,
  onSelectCard,
}: {
  section: DeckSection;
  onSelectCard: (card: OwnedCard) => void;
}) {
  const filled = section.picks.length;
  const short = section.target - section.poolCount;
  const extra = section.poolCount - section.target;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {section.name}
        </h3>
        <span className="text-sm text-zinc-400">
          {filled} / {section.target}
        </span>
        {short > 0 ? (
          <span className="text-[11px] font-medium text-amber-300">short {short} in these colours</span>
        ) : extra > 0 ? (
          <span className="text-[11px] text-zinc-500">+{extra} more in your pool</span>
        ) : null}
      </div>

      {section.picks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing in your collection fills this role in {section.name === 'Lands' ? 'these' : 'the commander’s'} colours.
        </p>
      ) : section.id === 'synergy' ? (
        <SynergyList items={section.picks} onSelect={onSelectCard} />
      ) : (
        <CardGrid cards={section.picks.map((p) => p.card)} onSelect={onSelectCard} />
      )}
    </section>
  );
}

function IdentityDots({ identity }: { identity: Color[] }) {
  if (identity.length === 0) {
    const m = COLOR_META.C;
    return (
      <span title={m.name} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40" style={{ backgroundColor: m.bg }} />
    );
  }
  return (
    <span className="flex gap-1">
      {identity.map((c) => {
        const m = COLOR_META[c];
        return (
          <span
            key={c}
            title={m.name}
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40"
            style={{ backgroundColor: m.bg }}
          />
        );
      })}
    </span>
  );
}
