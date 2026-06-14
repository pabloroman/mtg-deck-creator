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
  validateDeck,
} from '../lib/deck';
import { listCommanders } from '../lib/commander';
import { Segmented } from './Segmented';
import { IdentityDots } from './IdentityDots';

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
  const commander = deck.commanderOracleId ? index.get(deck.commanderOracleId) ?? null : null;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="space-y-3 rounded-2xl bg-[#13161e] p-4 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="text-sm text-zinc-400 hover:text-white">
            ← My decks
          </button>
          <div className="flex items-center gap-2">
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
              onClick={onSetActive}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive ? 'bg-sky-500/20 text-sky-200' : 'bg-white/10 text-zinc-200 hover:bg-white/20'
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
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => onRename(nameDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            aria-label="Deck name"
            className="w-full max-w-md rounded-lg bg-transparent px-1 text-2xl font-bold text-white outline-none ring-1 ring-transparent focus:bg-white/5 focus:ring-white/10"
          />
          <div className="flex items-center gap-3">
            <Segmented
              value={deck.format}
              onChange={onSetFormat}
              options={[
                { value: 'commander', label: 'Commander' },
                { value: 'standard', label: '60-card' },
              ]}
            />
            <span className={`text-sm font-semibold tabular-nums ${countTone(stats.totalWithCommander, rule)}`}>
              {stats.totalWithCommander} / {rule.targetCount}
              {rule.exactCount ? '' : '+'}
            </span>
            <IdentityDots identity={stats.colorIdentity} />
          </div>
        </div>

        {deck.format === 'commander' && (
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
        )}

        <ValidationPanel issues={issues} />
      </div>

      {/* card groups */}
      {deck.entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-zinc-500">
          No cards yet. Open a card in <span className="text-zinc-300">Browse</span> and use “Add to
          deck”.
          {isActive && ' Or hover any card and click the +.'}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.type}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{g.type}</h3>
              <span className="text-sm tabular-nums text-zinc-500">{g.count}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
              {g.cards.map((re) => (
                <DeckRow
                  key={re.entry.oracleId}
                  re={re}
                  format={deck.format}
                  rowIssues={issuesByOid.get(re.entry.oracleId)}
                  onAdjust={onAdjust}
                  onSelectCard={onSelectCard}
                />
              ))}
            </div>
          </section>
        ))
      )}
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
}: {
  re: ResolvedEntry;
  format: DeckFormat;
  rowIssues?: DeckIssue[];
  onAdjust: (oracleId: string, delta: number, cap: number) => void;
  onSelectCard: (card: OwnedCard) => void;
}) {
  const { entry, card, owned } = re;
  const error = rowIssues?.find((i) => i.severity === 'error');
  const cap = card ? copyCap(card, format, owned) : entry.quantity;
  const atCap = entry.quantity >= cap;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-1.5 ring-1 ${
        error ? 'bg-red-500/5 ring-red-500/40' : 'ring-white/10'
      }`}
    >
      <button
        type="button"
        onClick={() => card && onSelectCard(card)}
        disabled={!card}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {card?.image ? (
          <img src={card.image} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
            ?
          </div>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-100">
            {card?.name ?? 'Unknown card'}
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {card ? card.typeLine : 'Not in your collection'}
            {card && ` · own ${owned}`}
          </span>
          {error && <span className="block truncate text-xs text-red-300">{error.message}</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Remove one"
          onClick={() => onAdjust(entry.oracleId, -1, cap)}
          className="h-6 w-6 rounded bg-white/10 text-sm font-bold leading-none text-zinc-200 hover:bg-white/20"
        >
          −
        </button>
        <span className="w-6 text-center text-sm tabular-nums text-zinc-100">{entry.quantity}</span>
        <button
          type="button"
          aria-label="Add one"
          disabled={atCap}
          onClick={() => onAdjust(entry.oracleId, 1, cap)}
          className="h-6 w-6 rounded bg-white/10 text-sm font-bold leading-none text-zinc-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Remove from deck"
          onClick={() => onAdjust(entry.oracleId, -entry.quantity, cap)}
          className="ml-0.5 h-6 w-6 rounded text-sm text-zinc-500 hover:bg-red-500/20 hover:text-red-300"
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
    return (text ? commanders.filter((c) => c.name.toLowerCase().includes(text)) : commanders).slice(
      0,
      40,
    );
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
              <img src={commander.image} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
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
                  <img src={c.image} alt="" loading="lazy" className="h-10 w-8 shrink-0 rounded object-cover" />
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
