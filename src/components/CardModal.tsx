import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OwnedCard, ResolvedArchetype, TagIndexEntry } from '../types';
import type { CardIndex, Deck } from '../lib/deck';
import { relatedCards } from '../lib/synergy';
import { SynergyList } from './SynergyList';
import { AddToDeckMenu } from './AddToDeckMenu';

interface Props {
  card: OwnedCard;
  tagMeta: Map<string, TagIndexEntry>;
  allCards: OwnedCard[];
  archetypes: ResolvedArchetype[];
  onClose: () => void;
  onPickTag: (slug: string) => void;
  onSelectCard: (card: OwnedCard) => void;
  // Deck building — all optional; the menu only renders when wired up.
  decks?: Deck[];
  activeDeckId?: string | null;
  cardIndex?: CardIndex;
  onAddToDeck?: (deckId: string, oracleId: string) => void;
  onRequestNewDeck?: () => void;
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
  decks,
  activeDeckId,
  cardIndex,
  onAddToDeck,
  onRequestNewDeck,
}: Props) {
  const [showBack, setShowBack] = useState(false);

  const { engine, similar } = useMemo(
    () => relatedCards(card, allCards, archetypes, 8),
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

  // Related cards shown as two tabs; reset to the primary (engine) per card.
  const [tab, setTab] = useState<'engine' | 'similar'>('engine');
  useEffect(() => {
    setTab(engine.length ? 'engine' : 'similar');
  }, [card.id, engine.length]);
  const activeTab: 'engine' | 'similar' =
    tab === 'similar' && similar.length ? 'similar' : engine.length ? 'engine' : 'similar';
  const activeItems = activeTab === 'engine' ? engine : similar;
  const hasRelated = engine.length > 0 || similar.length > 0;
  // Pull-list tags are injected by the build, not sourced from Scryfall — keep them
  // out of the oracle-tag list so that heading stays truthful.
  const pullTags = card.tags.filter((t) => t.startsWith('playable'));
  const oracleTags = card.tags.filter((t) => !t.startsWith('playable'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-5 overflow-y-auto rounded-2xl bg-[#13161e] p-5 ring-1 ring-white/10 scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top: art + details */}
        <div className="flex flex-col gap-5 sm:flex-row">
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

            {decks && cardIndex && onAddToDeck && onRequestNewDeck && (
              <div className="mt-4">
                <AddToDeckMenu
                  card={card}
                  decks={decks}
                  activeDeckId={activeDeckId ?? null}
                  index={cardIndex}
                  onAdd={onAddToDeck}
                  onRequestNewDeck={onRequestNewDeck}
                />
              </div>
            )}

            {pullTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pullTags.map((slug) => {
                  const meta = tagMeta.get(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => onPickTag(slug)}
                      title={meta?.description ? stripMd(meta.description) : `otag:${slug}`}
                      className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25"
                    >
                      {slug}
                    </button>
                  );
                })}
              </div>
            )}

            <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Oracle tags ({oracleTags.length})
            </h3>
            {oracleTags.length === 0 ? (
              <p className="text-sm text-zinc-500">No oracle tags for this card.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {oracleTags.map((slug) => {
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
          </div>
        </div>

        {/* Related cards: engine partners vs. similar, as tabs */}
        {hasRelated && (
          <div className="border-t border-white/10 pt-4">
            <div
              role="tablist"
              className="inline-flex rounded-lg bg-white/5 p-0.5 text-sm ring-1 ring-white/10"
            >
              {engine.length > 0 && (
                <Tab active={activeTab === 'engine'} onClick={() => setTab('engine')}>
                  Engine partners <Count n={engine.length} />
                </Tab>
              )}
              {similar.length > 0 && (
                <Tab active={activeTab === 'similar'} onClick={() => setTab('similar')}>
                  Similar cards <Count n={similar.length} />
                </Tab>
              )}
            </div>
            <div className="mt-3">
              <SynergyList
                items={activeItems}
                onSelect={onSelectCard}
                showReason={false}
                testId={activeTab === 'engine' ? 'engine-list' : 'similar-list'}
              />
            </div>
          </div>
        )}
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

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-md px-3 py-1 font-medium transition ${
        active ? 'bg-sky-500/20 text-sky-200' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 tabular-nums opacity-60">{n}</span>;
}
