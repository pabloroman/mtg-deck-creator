import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Deck, DeckEntry, DeckFormat } from '../lib/deck';

const STORAGE_KEY = 'mtg-deck-creator:decks:v1';

interface PersistShape {
  decks: Deck[];
  activeDeckId: string | null;
}

const EMPTY: PersistShape = { decks: [], activeDeckId: null };

/** Read decks from localStorage; never throws (corrupt storage -> empty). */
function load(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistShape> | null;
    if (!parsed || !Array.isArray(parsed.decks)) return EMPTY;
    const decks = parsed.decks.filter(
      (d): d is Deck =>
        !!d && typeof d.id === 'string' && typeof d.name === 'string' && Array.isArray(d.entries),
    );
    const activeDeckId =
      typeof parsed.activeDeckId === 'string' && decks.some((d) => d.id === parsed.activeDeckId)
        ? parsed.activeDeckId
        : null;
    return { decks, activeDeckId };
  } catch {
    return EMPTY;
  }
}

export interface DecksApi {
  decks: Deck[];
  activeDeckId: string | null;
  activeDeck: Deck | null;
  setActiveDeck: (id: string | null) => void;
  createDeck: (input: {
    name: string;
    format: DeckFormat;
    commanderOracleId?: string | null;
  }) => string;
  renameDeck: (id: string, name: string) => void;
  deleteDeck: (id: string) => void;
  setFormat: (id: string, format: DeckFormat) => void;
  setCommander: (id: string, commanderOracleId: string | null) => void;
  /** Add/remove copies. Clamps to [0, cap] when `cap` given; 0 removes the entry. */
  addCard: (deckId: string, oracleId: string, opts?: { delta?: number; cap?: number }) => void;
  setQuantity: (deckId: string, oracleId: string, quantity: number, cap?: number) => void;
  removeCard: (deckId: string, oracleId: string) => void;
}

/** Deck state owner. localStorage-backed; mirrors the app's hooks-only convention. */
export function useDecks(): DecksApi {
  const [state, setState] = useState<PersistShape>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable / over quota — keep working in-memory
    }
  }, [state]);

  // Immutably replace one deck and bump its updatedAt.
  const mutateDeck = useCallback((deckId: string, fn: (d: Deck) => Deck) => {
    setState((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === deckId ? { ...fn(d), updatedAt: Date.now() } : d)),
    }));
  }, []);

  const setActiveDeck = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeDeckId: id }));
  }, []);

  const createDeck = useCallback<DecksApi['createDeck']>((input) => {
    const id = crypto.randomUUID();
    const ts = Date.now();
    const deck: Deck = {
      id,
      name: input.name.trim() || 'Untitled deck',
      format: input.format,
      commanderOracleId: input.format === 'commander' ? input.commanderOracleId ?? null : null,
      entries: [],
      createdAt: ts,
      updatedAt: ts,
    };
    setState((s) => ({ decks: [deck, ...s.decks], activeDeckId: id }));
    return id;
  }, []);

  const renameDeck = useCallback(
    (id: string, name: string) => mutateDeck(id, (d) => ({ ...d, name: name.trim() || d.name })),
    [mutateDeck],
  );

  const deleteDeck = useCallback((id: string) => {
    setState((s) => ({
      decks: s.decks.filter((d) => d.id !== id),
      activeDeckId: s.activeDeckId === id ? null : s.activeDeckId,
    }));
  }, []);

  const setFormat = useCallback(
    (id: string, format: DeckFormat) =>
      mutateDeck(id, (d) => ({
        ...d,
        format,
        // Dropping commander format clears the commander; it's meaningless there.
        commanderOracleId: format === 'commander' ? d.commanderOracleId : null,
      })),
    [mutateDeck],
  );

  const setCommander = useCallback(
    (id: string, commanderOracleId: string | null) =>
      mutateDeck(id, (d) => {
        if (d.format !== 'commander') return d;
        return {
          ...d,
          commanderOracleId,
          // The commander is never also one of the 99.
          entries: commanderOracleId
            ? d.entries.filter((e) => e.oracleId !== commanderOracleId)
            : d.entries,
        };
      }),
    [mutateDeck],
  );

  const addCard = useCallback<DecksApi['addCard']>(
    (deckId, oracleId, opts) => {
      const delta = opts?.delta ?? 1;
      const cap = opts?.cap;
      mutateDeck(deckId, (d) => {
        if (d.commanderOracleId === oracleId) return d; // can't stack the commander
        const entries = [...d.entries];
        const i = entries.findIndex((e) => e.oracleId === oracleId);
        const current = i >= 0 ? entries[i].quantity : 0;
        let next = current + delta;
        if (cap !== undefined) next = Math.min(next, cap);
        next = Math.max(0, next);
        if (next === 0) {
          if (i >= 0) entries.splice(i, 1);
        } else if (i >= 0) {
          entries[i] = { ...entries[i], quantity: next };
        } else {
          entries.push({ oracleId, quantity: next });
        }
        return { ...d, entries };
      });
    },
    [mutateDeck],
  );

  const setQuantity = useCallback<DecksApi['setQuantity']>(
    (deckId, oracleId, quantity, cap) => {
      mutateDeck(deckId, (d) => {
        if (d.commanderOracleId === oracleId) return d;
        let q = Math.max(0, Math.floor(quantity));
        if (cap !== undefined) q = Math.min(q, cap);
        const i = d.entries.findIndex((e) => e.oracleId === oracleId);
        const entries = [...d.entries];
        if (q <= 0) {
          if (i >= 0) entries.splice(i, 1);
        } else if (i >= 0) {
          entries[i] = { ...entries[i], quantity: q } satisfies DeckEntry;
        } else {
          entries.push({ oracleId, quantity: q });
        }
        return { ...d, entries };
      });
    },
    [mutateDeck],
  );

  const removeCard = useCallback(
    (deckId: string, oracleId: string) =>
      mutateDeck(deckId, (d) => ({ ...d, entries: d.entries.filter((e) => e.oracleId !== oracleId) })),
    [mutateDeck],
  );

  const activeDeck = useMemo(
    () => state.decks.find((d) => d.id === state.activeDeckId) ?? null,
    [state.decks, state.activeDeckId],
  );

  return {
    decks: state.decks,
    activeDeckId: state.activeDeckId,
    activeDeck,
    setActiveDeck,
    createDeck,
    renameDeck,
    deleteDeck,
    setFormat,
    setCommander,
    addCard,
    setQuantity,
    removeCard,
  };
}
