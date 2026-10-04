import { useMemo, useState } from 'react';
import type { OwnedCard } from '../types';
import {
  type CardIndex,
  type Deck,
  type DeckFormat,
  type DeckIssue,
  type FormatRule,
  type ResolvedEntry,
  FORMAT_RULES,
  cardKey,
  copyCap,
  deckStats,
  deckToText,
  groupByType,
  manaCurve,
  manaStats,
  validateDeck,
} from '../lib/deck';
import { listCommanders } from '../lib/commander';
import { Segmented } from './Segmented';
import { IdentityDots } from './IdentityDots';
import { ManaCost } from './ManaCost';
import { ManaCurve, ManaSummary } from './ManaCurve';
import { SampleHand } from './SampleHand';

interface Props {
  deck: Deck;
  cards: OwnedCard[];
  index: CardIndex;
  isActive: boolean;
  onBack: () => void;
  onRename: (name: string) => void;
  onSetFormat: (format: DeckFormat) => void;
  onSetCommander: (oracleId: string | null) => void;
  onAdjust: (oracleId: string, delta: number, cap: number) => void;
  onSetActive: () => void;
  onDelete: () => void;
  onSelectCard: (card: OwnedCard) => void;
}

export function DeckEditor({
  deck,
  cards,
  index,
  isActive,
  onBack,
  onRename,
  onSetFormat,
  onSetCommander,
  onAdjust,
  onSetActive,
  onDelete,
  onSelectCard,
}: Props) {
  const [nameDraft, setNameDraft] = useState(deck.name);
  const [pickingCommander, setPickingCommander] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<OwnedCard | null>(null);
  const [sampling, setSampling] = useState(false);

  const isEmpty = deck.entries.length === 0 && !deck.commanderOracleId;
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(deckToText(deck, index));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context / denied)
    }
  };

  const stats = useMemo(() => deckStats(deck, index), [deck, index]);
  const issues = useMemo(() => validateDeck(deck, index), [deck, index]);
  const groups = useMemo(() => groupByType(deck, index), [deck, index]);
  const curve = useMemo(() => manaCurve(deck, index), [deck, index]);
  const mana = useMemo(() => manaStats(deck, index), [deck, index]);

  const issuesByOid = useMemo(() => {
    const m = new Map<string, DeckIssue[]>();
    for (const it of issues) {
      if (!it.oracleId) continue;
      const arr = m.get(it.oracleId);
      if (arr) arr.push(it);
      else m.set(it.oracleId, [it]);
    }
    return m;
  }, [issues]);

  const rule = FORMAT_RULES[deck.format];
  const commander = deck.commanderOracleId ? (index.get(deck.commanderOracleId) ?? null) : null;

  // Sidebar preview: the last hovered card, else the commander, else the first card.
  const shown = preview ?? commander ?? groups[0]?.cards.find((re) => re.card)?.card ?? null;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-sm text-zinc-400 hover:text-white"
        >
          ← My decks
        </button>
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => onRename(nameDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Deck name"
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-2xl font-bold text-white outline-none ring-1 ring-transparent focus:bg-white/5 focus:ring-white/10"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* meta sidebar (on top below lg) */}
        <aside className="space-y-3 rounded-2xl bg-[#13161e] p-4 ring-1 ring-white/10 lg:sticky lg:top-20 lg:order-last lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto scroll-thin">
          {shown?.image && (
            <img
              src={shown.image}
              alt={shown.name}
              className="hidden aspect-[5/7] w-full rounded-xl object-cover lg:block"
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={deck.format}
              onChange={onSetFormat}
              options={[
                { value: 'commander', label: 'Commander' },
                { value: 'standard', label: '60-card' },
              ]}
            />
            <span
              className={`text-sm font-semibold tabular-nums ${countTone(stats.totalWithCommander, rule)}`}
            >
              {stats.totalWithCommander} / {rule.targetCount}
              {rule.exactCount ? '' : '+'}
            </span>
            <IdentityDots identity={stats.colorIdentity} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyList}
              disabled={isEmpty}
              title="Copy a plain-text decklist to the clipboard"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? '✓ Copied' : 'Copy list'}
            </button>
            <button
              type="button"
              onClick={() => setSampling((v) => !v)}
              disabled={stats.mainCount < 7}
              aria-pressed={sampling}
              title="Draw sample opening hands"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                sampling
                  ? 'bg-sky-500/20 text-sky-200'
                  : 'bg-white/10 text-zinc-200 hover:bg-white/20'
              }`}
            >
              Sample hand
            </button>
            <button
              type="button"
              onClick={onSetActive}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive
                  ? 'bg-sky-500/20 text-sky-200'
                  : 'bg-white/10 text-zinc-200 hover:bg-white/20'
              }`}
            >
              {isActive ? '★ Active deck' : 'Set as active'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete “${deck.name}”?`)) onDelete();
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-red-500/20 hover:text-red-300"
            >
              Delete
            </button>
          </div>

          {deck.format === 'commander' && (
            <div onMouseEnter={() => commander && setPreview(commander)}>
              <CommanderBlock
                commander={commander}
                cards={cards}
                picking={pickingCommander}
                onTogglePick={() => setPickingCommander((v) => !v)}
                onPick={(oid) => {
                  onSetCommander(oid);
                  setPickingCommander(false);
                }}
                onSelectCard={onSelectCard}
              />
            </div>
          )}

          <ManaCurve curve={curve} />
          {mana && <ManaSummary stats={mana} />}

          <ValidationPanel issues={issues} />
        </aside>

        {/* card groups: flow into two columns, each group kept whole */}
        <div className="gap-8 md:columns-2">
          {sampling && stats.mainCount >= 7 && (
            <SampleHand key={deck.updatedAt} deck={deck} index={index} onPreview={setPreview} />
          )}
          {deck.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-zinc-500 [column-span:all]">
              No cards yet. Open a card in <span className="text-zinc-300">Browse</span> and use
              “Add to deck”.
              {isActive && ' Or hover any card and click the +.'}
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.type} className="mb-6 break-inside-avoid">
                <div className="mb-1 border-b border-white/10 pb-1">
                  <h3 className="text-base font-semibold text-zinc-100">{g.type}</h3>
                  <p className="text-xs tabular-nums text-zinc-500">Qty: {g.count}</p>
                </div>
                {g.cards.map((re) => (
                  <DeckRow
                    key={re.entry.oracleId}
                    re={re}
                    format={deck.format}
                    rowIssues={issuesByOid.get(re.entry.oracleId)}
                    onAdjust={onAdjust}
                    onSelectCard={onSelectCard}
                    onPreview={setPreview}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function countTone(count: number, rule: FormatRule): string {
  const ok = rule.exactCount ? count === rule.targetCount : count >= rule.targetCount;
  return ok ? 'text-emerald-300' : 'text-amber-300';
}

function DeckRow({
  re,
  format,
  rowIssues,
  onAdjust,
  onSelectCard,
  onPreview,
}: {
  re: ResolvedEntry;
  format: DeckFormat;
  rowIssues?: DeckIssue[];
  onAdjust: (oracleId: string, delta: number, cap: number) => void;
  onSelectCard: (card: OwnedCard) => void;
  onPreview: (card: OwnedCard) => void;
}) {
  const { entry, card, owned } = re;
  const error = rowIssues?.find((i) => i.severity === 'error');
  const cap = card ? copyCap(card, format, owned) : entry.quantity;
  const atCap = entry.quantity >= cap;
  const stepClass =
    'h-6 w-6 rounded text-sm leading-none text-zinc-500 hover:bg-white/10 hover:text-zinc-200';

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-2 py-1 ${
        error ? 'bg-red-500/5 ring-1 ring-red-500/40' : 'hover:bg-white/5'
      }`}
    >
      <button
        type="button"
        onClick={() => card && onSelectCard(card)}
        onMouseEnter={() => card && onPreview(card)}
        onFocus={() => card && onPreview(card)}
        disabled={!card}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-sm font-medium text-zinc-100">
          <span className="tabular-nums">{entry.quantity}</span>{' '}
          {card?.name ?? 'Unknown card (not in your collection)'}
        </span>
        {error && <span className="block truncate text-xs text-red-300">{error.message}</span>}
      </button>
      {card && <ManaCost cost={card.manaCost} />}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          aria-label="Remove one"
          onClick={() => onAdjust(entry.oracleId, -1, cap)}
          className={stepClass}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Add one"
          disabled={atCap}
          onClick={() => onAdjust(entry.oracleId, 1, cap)}
          className={`${stepClass} disabled:cursor-not-allowed disabled:opacity-30`}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Remove from deck"
          onClick={() => onAdjust(entry.oracleId, -entry.quantity, cap)}
          className="h-6 w-6 rounded text-sm leading-none text-zinc-500 hover:bg-red-500/20 hover:text-red-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function CommanderBlock({
  commander,
  cards,
  picking,
  onTogglePick,
  onPick,
  onSelectCard,
}: {
  commander: OwnedCard | null;
  cards: OwnedCard[];
  picking: boolean;
  onTogglePick: () => void;
  onPick: (oracleId: string | null) => void;
  onSelectCard: (card: OwnedCard) => void;
}) {
  const [q, setQ] = useState('');
  const commanders = useMemo(() => listCommanders(cards), [cards]);
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (
      text ? commanders.filter((c) => c.name.toLowerCase().includes(text)) : commanders
    ).slice(0, 40);
  }, [commanders, q]);

  return (
    <div className="rounded-xl bg-black/20 p-2.5 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        {commander ? (
          <button
            type="button"
            onClick={() => onSelectCard(commander)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {commander.image && (
              <img
                src={commander.image}
                alt=""
                className="h-12 w-9 shrink-0 rounded object-cover"
              />
            )}
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
                Commander
              </span>
              <span className="block truncate text-sm font-medium text-zinc-100">
                {commander.name}
              </span>
            </span>
          </button>
        ) : (
          <span className="flex-1 text-sm text-amber-300">No commander chosen.</span>
        )}
        {commander && <IdentityDots identity={commander.colorIdentity} />}
        <button
          type="button"
          onClick={onTogglePick}
          className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/20"
        >
          {picking ? 'Close' : commander ? 'Change' : 'Choose'}
        </button>
      </div>

      {picking && (
        <div className="mt-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter legendary creatures…"
            className="mb-2 w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto scroll-thin pr-1">
            {commander && (
              <button
                type="button"
                onClick={() => onPick(null)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-white/10"
              >
                Remove commander
              </button>
            )}
            {filtered.map((c) => (
              <button
                key={cardKey(c)}
                type="button"
                onClick={() => onPick(cardKey(c))}
                className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left ring-1 ring-white/10 hover:bg-white/5"
              >
                {c.image && (
                  <img
                    src={c.image}
                    alt=""
                    loading="lazy"
                    className="h-10 w-8 shrink-0 rounded object-cover"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{c.name}</span>
                <IdentityDots identity={c.colorIdentity} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationPanel({ issues }: { issues: DeckIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm font-medium text-emerald-300">✓ Looks legal.</p>;
  }
  const general = issues.filter((i) => !i.oracleId);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const hasCardIssues = issues.some((i) => i.oracleId);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {errorCount > 0 ? `${errorCount} issue${errorCount === 1 ? '' : 's'} to fix` : 'Notes'}
      </p>
      {general.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {general.map((it, idx) => (
            <span key={`${it.kind}-${idx}`} className={chipClass(it.severity)}>
              {it.message}
            </span>
          ))}
        </div>
      )}
      {hasCardIssues && (
        <p className="text-xs text-zinc-500">Cards with problems are highlighted below.</p>
      )}
    </div>
  );
}

function chipClass(severity: 'error' | 'warning'): string {
  return severity === 'error'
    ? 'rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/30'
    : 'rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30';
}
