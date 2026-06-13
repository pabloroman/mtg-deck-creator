import { useEffect, useMemo, useState } from 'react';
import type { OwnedCard, ResolvedArchetype, TagIndexEntry } from '../types';
import { synergyFor } from '../lib/synergy';
import { SynergyList } from './SynergyList';

interface Props {
  card: OwnedCard;
  tagMeta: Map<string, TagIndexEntry>;
  allCards: OwnedCard[];
  archetypes: ResolvedArchetype[];
  onClose: () => void;
  onPickTag: (slug: string) => void;
  onSelectCard: (card: OwnedCard) => void;
}

/** Strip markdown links like [text](url) -> text for plain rendering. */
function stripMd(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

export function CardModal({
  card,
  tagMeta,
  allCards,
  archetypes,
  onClose,
  onPickTag,
  onSelectCard,
}: Props) {
  const [showBack, setShowBack] = useState(false);

  const synergy = useMemo(
    () => synergyFor(card, allCards, archetypes, 8),
    [card, allCards, archetypes],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const img = showBack && card.imageBack ? card.imageBack : card.image;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-5 overflow-y-auto rounded-2xl bg-[#13161e] p-5 ring-1 ring-white/10 sm:flex-row scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col items-center gap-2 sm:w-72">
          {img ? (
            <img src={img} alt={card.name} className="w-64 rounded-xl shadow-lg" />
          ) : (
            <div className="flex h-80 w-64 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
              No image
            </div>
          )}
          {card.imageBack && (
            <button
              type="button"
              onClick={() => setShowBack((v) => !v)}
              className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
            >
              ⟳ Flip {showBack ? 'front' : 'back'}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">{card.name}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-zinc-300">{card.typeLine}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Field label="Mana cost" value={card.manaCost || '—'} />
            <Field label="CMC" value={String(card.cmc)} />
            <Field label="Set" value={`${card.setName} (${card.set.toUpperCase()})`} />
            <Field label="Collector #" value={card.collectorNumber} />
            <Field label="Rarity" value={card.rarity} />
            <Field label="Owned" value={`${card.quantity}${card.foil ? ' (foil)' : ''}`} />
            <Field
              label="Identity"
              value={card.colorIdentity.length ? card.colorIdentity.join('') : 'Colorless'}
            />
          </dl>

          <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Oracle tags ({card.tags.length})
          </h3>
          {card.tags.length === 0 ? (
            <p className="text-sm text-zinc-500">No oracle tags for this card.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {card.tags.map((slug) => {
                const meta = tagMeta.get(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => onPickTag(slug)}
                    title={meta?.description ? stripMd(meta.description) : `otag:${slug}`}
                    className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/25"
                  >
                    {slug}
                  </button>
                );
              })}
            </div>
          )}

          {synergy.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Synergizes with
              </h3>
              <SynergyList items={synergy} onSelect={onSelectCard} testId="synergy-list" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="truncate text-zinc-200" title={value}>
        {value}
      </dd>
    </>
  );
}
