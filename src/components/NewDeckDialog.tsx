import { useEffect, useMemo, useState } from 'react';
import type { OwnedCard } from '../types';
import { type DeckFormat, cardKey } from '../lib/deck';
import { listCommanders } from '../lib/commander';
import { Segmented } from './Segmented';
import { IdentityDots } from './IdentityDots';

interface Props {
  cards: OwnedCard[];
  onCancel: () => void;
  onCreate: (input: { name: string; format: DeckFormat; commanderOracleId: string | null }) => void;
}

export function NewDeckDialog({ cards, onCancel, onCreate }: Props) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [commanderId, setCommanderId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const commanders = useMemo(() => listCommanders(cards), [cards]);
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const list = text ? commanders.filter((c) => c.name.toLowerCase().includes(text)) : commanders;
    return list.slice(0, 60);
  }, [commanders, q]);

  const needsCommander = format === 'commander';
  const canCreate = name.trim().length > 0 && (!needsCommander || commanderId != null);

  const submit = () => {
    if (!canCreate) return;
    onCreate({ name: name.trim(), format, commanderOracleId: needsCommander ? commanderId : null });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-[#13161e] p-5 ring-1 ring-white/10 scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New deck</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Name</span>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) submit();
            }}
            placeholder="My deck"
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Format</span>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: 'commander', label: 'Commander' },
              { value: 'standard', label: '60-card' },
            ]}
          />
          <p className="mt-1 text-xs text-zinc-500">
            {format === 'commander'
              ? '100 cards · singleton · colour-identity locked'
              : 'Minimum 60 cards · up to 4 copies each'}
          </p>
        </div>

        {needsCommander && (
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
              Commander{' '}
              {commanders.length === 0 && (
                <span className="text-amber-300">(no legendary creatures owned)</span>
              )}
            </span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter legendary creatures…"
              className="mb-2 w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto scroll-thin pr-1">
              {filtered.map((c) => {
                const id = cardKey(c);
                const selected = id === commanderId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCommanderId(id)}
                    className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-left ring-1 transition ${
                      selected ? 'bg-sky-500/20 ring-sky-500/50' : 'ring-white/10 hover:bg-white/5'
                    }`}
                  >
                    {c.image ? (
                      <img
                        src={c.image}
                        alt=""
                        loading="lazy"
                        className="h-12 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-9 shrink-0 rounded bg-zinc-800" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-400">{c.typeLine}</span>
                    </span>
                    <IdentityDots identity={c.colorIdentity} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canCreate}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create deck
          </button>
        </div>
      </div>
    </div>
  );
}
