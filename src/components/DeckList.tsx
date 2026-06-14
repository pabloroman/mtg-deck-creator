import { type CardIndex, type Deck, FORMAT_RULES, deckStats, validateDeck } from '../lib/deck';
import { IdentityDots } from './IdentityDots';

interface Props {
  decks: Deck[];
  index: CardIndex;
  activeDeckId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSetActive: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function DeckList({ decks, index, activeDeckId, onOpen, onNew, onSetActive, onDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">My decks</h2>
          <p className="text-sm text-zinc-400">
            {decks.length} deck{decks.length === 1 ? '' : 's'} · saved in this browser
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-400"
        >
          + New deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-zinc-400">No decks yet.</p>
          <button
            type="button"
            onClick={onNew}
            className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Create your first deck
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const stats = deckStats(deck, index);
            const hasErrors = validateDeck(deck, index).some((i) => i.severity === 'error');
            const commander = deck.commanderOracleId ? index.get(deck.commanderOracleId) : null;
            const isActive = deck.id === activeDeckId;
            return (
              <div
                key={deck.id}
                className={`flex flex-col gap-3 rounded-2xl bg-[#13161e] p-4 ring-1 ${
                  isActive ? 'ring-sky-500/40' : 'ring-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpen(deck.id)} className="min-w-0 text-left">
                    <span className="block truncate text-base font-semibold text-white hover:text-sky-300">
                      {deck.name}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                        {FORMAT_RULES[deck.format].label}
                      </span>
                      <IdentityDots identity={stats.colorIdentity} />
                    </span>
                  </button>
                  <span
                    title={hasErrors ? 'Incomplete or invalid' : 'Looks legal'}
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      hasErrors ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                </div>

                {commander && (
                  <button
                    type="button"
                    onClick={() => onOpen(deck.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    {commander.image && (
                      <img
                        src={commander.image}
                        alt=""
                        loading="lazy"
                        className="h-10 w-8 rounded object-cover"
                      />
                    )}
                    <span className="truncate text-xs text-zinc-400">{commander.name}</span>
                  </button>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm tabular-nums text-zinc-300">
                    {stats.totalWithCommander} / {stats.target}
                    {FORMAT_RULES[deck.format].exactCount ? '' : '+'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSetActive(isActive ? null : deck.id)}
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        isActive
                          ? 'bg-sky-500/20 text-sky-200'
                          : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {isActive ? '★ Active' : 'Set active'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(deck.id)}
                      className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/20"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${deck.name}`}
                      onClick={() => {
                        if (window.confirm(`Delete “${deck.name}”?`)) onDelete(deck.id);
                      }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-red-500/20 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
