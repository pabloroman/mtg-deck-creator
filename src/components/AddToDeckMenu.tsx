import { useMemo, useState } from 'react';
import type { OwnedCard } from '../types';
import { type CardIndex, type Deck, FORMAT_RULES, cardKey, copyCap } from '../lib/deck';
import { identitySet, withinIdentity } from '../lib/commander';

interface Props {
  card: OwnedCard;
  decks: Deck[];
  activeDeckId: string | null;
  index: CardIndex;
  onAdd: (deckId: string, oracleId: string) => void;
  onRequestNewDeck: () => void;
}

/** "Add to deck ▾" dropdown shown inside the card modal. */
export function AddToDeckMenu({ card, decks, activeDeckId, index, onAdd, onRequestNewDeck }: Props) {
  const [open, setOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const oid = cardKey(card);
  const owned = index.get(oid)?.quantity ?? card.quantity;

  const rows = useMemo(
    () =>
      decks.map((deck) => {
        const inDeck = deck.entries.find((e) => e.oracleId === oid)?.quantity ?? 0;
        const isCommander = deck.commanderOracleId === oid;
        const cap = copyCap(card, deck.format, owned);
        const atCap = inDeck >= cap;
        let offIdentity = false;
        if (deck.format === 'commander' && deck.commanderOracleId) {
          const cmd = index.get(deck.commanderOracleId);
          if (cmd) offIdentity = !withinIdentity(card, identitySet(cmd));
        }
        return { deck, inDeck, isCommander, atCap, offIdentity };
      }),
    [decks, oid, card, owned, index],
  );

  const add = (deckId: string) => {
    onAdd(deckId, oid);
    setLastAdded(deckId);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-400"
      >
        + Add to deck
        <span className="text-xs opacity-70">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-xl bg-[#0c0e14] p-1.5 shadow-xl ring-1 ring-white/15 scroll-thin">
            {decks.length === 0 && (
              <p className="px-2 py-2 text-xs text-zinc-500">No decks yet — create one below.</p>
            )}
            {rows.map(({ deck, inDeck, isCommander, atCap, offIdentity }) => {
              const disabled = isCommander || atCap;
              return (
                <button
                  key={deck.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => add(deck.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-white/10'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-100">
                      {deck.id === activeDeckId && <span className="text-sky-400">★ </span>}
                      {deck.name}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {FORMAT_RULES[deck.format].label}
                      {inDeck > 0 && ` · ${inDeck} in deck`}
                      {isCommander && ' · is commander'}
                      {!isCommander && atCap && ` · max (${owned} owned)`}
                      {offIdentity && ' · off-identity'}
                    </span>
                  </span>
                  {lastAdded === deck.id && !disabled && (
                    <span className="shrink-0 text-emerald-400">✓</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRequestNewDeck();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-2 py-2 text-left text-sm font-medium text-sky-300 hover:bg-white/10"
            >
              + New deck…
            </button>
          </div>
        </>
      )}
    </div>
  );
}
