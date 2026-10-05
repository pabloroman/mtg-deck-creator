import { useMemo, useState } from 'react';
import { VIEWS, useRoute } from './lib/route';
import { useCollection } from './data/useCollection';
import { useDecks } from './data/useDecks';
import {
  parseQuery,
  appendTag,
  tagPrefixOf,
  typePrefixOf,
  keywordPrefixOf,
  setPrefixOf,
  keywordSlug,
} from './search/parseQuery';
import { useCollectionFilters, applyCollectionFilters } from './search/useCollectionFilters';
import { scoreArchetypes } from './lib/synergy';
import { orderRarities } from './lib/rarity';
import { summarizeSets } from './lib/sets';
import { buildCardIndex, cardKey, copyCap } from './lib/deck';
import type { OwnedCard, TagIndexEntry } from './types';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { CardGrid } from './components/CardGrid';
import { CardModal } from './components/CardModal';
import { ResultSummary } from './components/ResultSummary';
import { ArchetypeDashboard } from './components/ArchetypeDashboard';
import { ArchetypeDetail } from './components/ArchetypeDetail';
import { CommanderGuide } from './components/CommanderGuide';
import { DeckList } from './components/DeckList';
import { DeckEditor } from './components/DeckEditor';
import { NewDeckDialog } from './components/NewDeckDialog';
import { SetsDashboard } from './components/SetsDashboard';

export default function App() {
  const { data, loading, error } = useCollection();

  // Navigation lives in the URL hash, so back/forward, reload and bookmarks all work.
  const [route, go] = useRoute();
  const { view } = route;
  const archetypeId = view === 'decks' ? route.id : null;
  const openDeckId = view === 'build' ? route.id : null;
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const decks = useDecks();
  const f = useCollectionFilters();

  const parsed = useMemo(() => parseQuery(f.query), [f.query]);

  // oracleId -> representative card (with total owned quantity); drives deck building.
  const cardIndex = useMemo(
    () => (data ? buildCardIndex(data.cards) : new Map<string, OwnedCard>()),
    [data],
  );

  const commander =
    (view === 'commander' && route.id ? cardIndex.get(route.id) : undefined) ?? null;

  // The card open in the modal. A grouped card shows its total owned across printings.
  const selected = useMemo(() => {
    const printing = route.card ? data?.cards.find((c) => c.id === route.card) : undefined;
    if (!printing) return null;
    const all = route.grouped ? cardIndex.get(cardKey(printing)) : undefined;
    return all
      ? { ...printing, quantity: all.quantity, foil: all.foil, printingCount: all.printingCount }
      : printing;
  }, [data, cardIndex, route.card, route.grouped]);
  const selectCard = (card: OwnedCard) =>
    go({ card: card.id, grouped: card.printingCount != null });

  const openDeck = useMemo(
    () => decks.decks.find((d) => d.id === openDeckId) ?? null,
    [decks.decks, openDeckId],
  );

  // Add a card to a deck, capped at the copies owned (and the format limit).
  const addCardToDeck = (deckId: string, oracleId: string) => {
    const deck = decks.decks.find((d) => d.id === deckId);
    const card = cardIndex.get(oracleId);
    if (!deck || !card) return;
    decks.addCard(deckId, oracleId, { cap: copyCap(card, deck.format, card.quantity) });
  };

  const quickAdd = (card: OwnedCard) => {
    if (decks.activeDeckId) addCardToDeck(decks.activeDeckId, cardKey(card));
  };

  const handleCreateDeck = (input: Parameters<typeof decks.createDeck>[0]) => {
    const id = decks.createDeck(input);
    // Created from a card's "+ New deck…": drop that card straight in.
    if (selected) addCardToDeck(id, cardKey(selected));
    setNewDeckOpen(false);
    if (view === 'build') go({ id });
  };

  const tagMeta = useMemo(() => {
    const m = new Map<string, TagIndexEntry>();
    for (const t of data?.tags ?? []) m.set(t.slug, t);
    return m;
  }, [data]);

  const availableRarities = useMemo(
    () => orderRarities((data?.cards ?? []).map((c) => c.rarity)),
    [data],
  );

  // Per-set ownership rollup; drives the Sets page and the set: autocomplete/chips.
  const setSummaries = useMemo(() => summarizeSets(data?.cards ?? [], data?.sets ?? {}), [data]);

  // Sets shaped as TagIndexEntry so the search box reuses rankTags + TagAutocomplete
  // (slug = set code, label = set name, count = distinct cards owned).
  const setIndex = useMemo<TagIndexEntry[]>(
    () =>
      setSummaries.map((s) => ({
        slug: s.code,
        label: s.name,
        description: null,
        aliases: [],
        count: s.distinct,
      })),
    [setSummaries],
  );

  const setMeta = useMemo(() => {
    const m = new Map<string, TagIndexEntry>();
    for (const s of setIndex) m.set(s.slug, s);
    return m;
  }, [setIndex]);

  // Keyword-ability index derived from the loaded cards, shaped as TagIndexEntry so the
  // search box can reuse rankTags + TagAutocomplete. count = distinct owning cards (oracleId).
  const keywordIndex = useMemo<TagIndexEntry[]>(() => {
    const acc = new Map<string, { label: string; oids: Set<string> }>();
    for (const c of data?.cards ?? []) {
      for (const kw of c.keywords) {
        const slug = keywordSlug(kw);
        let e = acc.get(slug);
        if (!e) {
          e = { label: kw, oids: new Set() };
          acc.set(slug, e);
        }
        e.oids.add(c.oracleId);
      }
    }
    return [...acc.entries()]
      .map(([slug, { label, oids }]) => ({
        slug,
        label,
        description: null,
        aliases: [],
        count: oids.size,
      }))
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  }, [data]);

  const keywordMeta = useMemo(() => {
    const m = new Map<string, TagIndexEntry>();
    for (const k of keywordIndex) m.set(k.slug, k);
    return m;
  }, [keywordIndex]);

  // One filtered list drives both views. Browse renders it directly; the
  // Archetypes view scores and draws its card grids from the same pool, so every
  // filter — the text search included — re-ranks the dashboard and narrows each
  // archetype's Members/Payoffs lists (e.g. t:creature to see only creatures).
  const filtered = useMemo(
    () => (data ? applyCollectionFilters(data.cards, f, parsed) : []),
    [data, parsed, f.colors, f.axis, f.match, f.rarities, f.pauperOnly, f.playableOnly, f.group,
      f.minQuantity, f.sort],
  );

  const scores = useMemo(
    () => (data ? scoreArchetypes(filtered, data.archetypes) : []),
    [data, filtered],
  );
  const selectedScore = useMemo(
    () => scores.find((s) => s.archetype.id === archetypeId) ?? null,
    [scores, archetypeId],
  );

  const hasFilters =
    parsed.tagSlugs.length > 0 ||
    parsed.typeTerms.length > 0 ||
    parsed.keywordSlugs.length > 0 ||
    parsed.setCodes.length > 0 ||
    parsed.mvTerms.length > 0 ||
    parsed.identityTerms.length > 0 ||
    parsed.oracleTerms.length > 0 ||
    parsed.text.length > 0 ||
    f.colors.length > 0 ||
    f.rarities.length > 0 ||
    f.pauperOnly ||
    f.playableOnly ||
    f.minQuantity > 0;

  // picking a tag (chip in the modal) always lands on the filtered browse view
  const addTag = (slug: string) => {
    f.setQuery((q) => appendTag(q, slug));
    go({ view: 'browse', id: null, card: null });
  };

  const removeTag = (slug: string) =>
    f.setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = tagPrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === slug);
        })
        .join(' '),
    );

  const removeType = (term: string) =>
    f.setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = typePrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === term);
        })
        .join(' '),
    );

  const removeKeyword = (slug: string) =>
    f.setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = keywordPrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === slug);
        })
        .join(' '),
    );

  const removeSet = (code: string) =>
    f.setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = setPrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === code);
        })
        .join(' '),
    );

  // The search box and its active-filter chips are shared by Browse and the
  // Archetypes view, so both can narrow cards by tag, type, keyword or name.
  const searchLeading = (
    <div className="lg:max-w-xl lg:flex-1">
      <SearchBar
        query={f.query}
        setQuery={f.setQuery}
        tags={data?.tags ?? []}
        keywords={keywordIndex}
        sets={setIndex}
      />
    </div>
  );

  const filterChips = (
    <>
      {parsed.tagSlugs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.tagSlugs.map((slug) => {
            const meta = tagMeta.get(slug);
            const known = meta !== undefined;
            return (
              <span
                key={slug}
                title={!known ? 'No card in your collection has this tag' : meta?.description ?? ''}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  known
                    ? 'bg-sky-500/15 text-sky-300 ring-sky-500/30'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                }`}
              >
                otag:{slug}
                {known && <span className="text-zinc-500">· {meta!.count}</span>}
                <button
                  type="button"
                  onClick={() => removeTag(slug)}
                  className="ml-0.5 text-zinc-400 hover:text-white"
                  aria-label={`Remove ${slug}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {parsed.typeTerms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.typeTerms.map((term) => (
            <span
              key={term}
              className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-300 ring-1 ring-violet-500/30"
            >
              t:{term}
              <button
                type="button"
                onClick={() => removeType(term)}
                className="ml-0.5 text-zinc-400 hover:text-white"
                aria-label={`Remove type ${term}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {parsed.keywordSlugs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.keywordSlugs.map((slug) => {
            const meta = keywordMeta.get(slug);
            const known = meta !== undefined;
            return (
              <span
                key={slug}
                title={!known ? 'No card in your collection has this keyword' : ''}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  known
                    ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                }`}
              >
                kw:{slug}
                {known && <span className="text-zinc-500">· {meta!.count}</span>}
                <button
                  type="button"
                  onClick={() => removeKeyword(slug)}
                  className="ml-0.5 text-zinc-400 hover:text-white"
                  aria-label={`Remove keyword ${slug}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {parsed.setCodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.setCodes.map((code) => {
            const meta = setMeta.get(code);
            const known = meta !== undefined;
            return (
              <span
                key={code}
                title={
                  known ? `${meta!.count} cards owned` : 'No card in your collection is from this set'
                }
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  known
                    ? 'bg-teal-500/15 text-teal-300 ring-teal-500/30'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                }`}
              >
                set:{code}
                {known && <span className="text-zinc-500">· {meta!.label}</span>}
                <button
                  type="button"
                  onClick={() => removeSet(code)}
                  className="ml-0.5 text-zinc-400 hover:text-white"
                  aria-label={`Remove set ${code}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0f14]/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold text-white">
                  MTG Collection <span className="text-sky-400">Browser</span>
                </h1>
                <div className="inline-flex rounded-lg bg-white/5 p-0.5 text-sm ring-1 ring-white/10">
                  {VIEWS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => go({ view: v, id: null })}
                      className={`rounded-md px-3 py-1 font-medium transition ${
                        view === v ? 'bg-sky-500/20 text-sky-200' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {v === 'browse'
                        ? 'Browse'
                        : v === 'decks'
                          ? 'Archetypes'
                          : v === 'sets'
                            ? 'Sets'
                            : v === 'commander'
                              ? 'Commander'
                              : 'My Decks'}
                    </button>
                  ))}
                </div>
              </div>
              {data && view === 'browse' && (
                <ResultSummary filtered={filtered} totalCards={data.cards.length} hasFilters={hasFilters} />
              )}
            </div>

            {(view === 'browse' || view === 'decks') && (
              <>
                <FilterBar
                  filters={f}
                  availableRarities={availableRarities}
                  leading={searchLeading}
                  colorLabel={view === 'decks' ? 'Buildable in:' : undefined}
                />
                {filterChips}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        {loading && <div className="py-24 text-center text-zinc-500">Loading collection…</div>}
        {error && (
          <div className="py-24 text-center text-red-400">
            Failed to load collection data: {error}
            <div className="mt-2 text-sm text-zinc-500">Did you run <code>npm run preprocess</code>?</div>
          </div>
        )}

        {data && view === 'browse' && (
          <CardGrid
            cards={filtered}
            onSelect={selectCard}
            onQuickAdd={decks.activeDeckId ? quickAdd : undefined}
          />
        )}

        {data &&
          view === 'decks' &&
          (selectedScore ? (
            <ArchetypeDetail
              score={selectedScore}
              cards={filtered}
              onBack={() => go({ id: null })}
              onSelectCard={selectCard}
            />
          ) : (
            <ArchetypeDashboard scores={scores} onSelect={(id) => go({ id })} />
          ))}

        {data && view === 'sets' && (
          <SetsDashboard
            summaries={setSummaries}
            onSelectSet={(code) => {
              f.setQuery(`set:${code} `);
              go({ view: 'browse', id: null });
            }}
          />
        )}

        {data && view === 'commander' && (
          <CommanderGuide
            cards={data.cards}
            archetypes={data.archetypes}
            commander={commander}
            onPickCommander={(card) => go({ id: card ? cardKey(card) : null })}
            onSelectCard={selectCard}
          />
        )}

        {data &&
          view === 'build' &&
          (openDeck ? (
            <DeckEditor
              key={openDeck.id}
              deck={openDeck}
              cards={data.cards}
              index={cardIndex}
              isActive={decks.activeDeckId === openDeck.id}
              onBack={() => go({ id: null })}
              onRename={(name) => decks.renameDeck(openDeck.id, name)}
              onSetFormat={(format) => decks.setFormat(openDeck.id, format)}
              onSetCommander={(oid) => decks.setCommander(openDeck.id, oid)}
              onAdjust={(oid, delta, cap) => decks.addCard(openDeck.id, oid, { delta, cap })}
              onSetActive={() =>
                decks.setActiveDeck(decks.activeDeckId === openDeck.id ? null : openDeck.id)
              }
              onDelete={() => {
                decks.deleteDeck(openDeck.id);
                go({ id: null });
              }}
              onSelectCard={selectCard}
            />
          ) : (
            <DeckList
              decks={decks.decks}
              index={cardIndex}
              activeDeckId={decks.activeDeckId}
              onOpen={(id) => go({ id })}
              onNew={() => setNewDeckOpen(true)}
              onSetActive={decks.setActiveDeck}
              onDelete={decks.deleteDeck}
            />
          ))}
      </main>

      {selected && data && (
        <CardModal
          card={selected}
          tagMeta={tagMeta}
          allCards={data.cards}
          archetypes={data.archetypes}
          onClose={() => go({ card: null })}
          onPickTag={addTag}
          onSelectCard={selectCard}
          decks={decks.decks}
          activeDeckId={decks.activeDeckId}
          cardIndex={cardIndex}
          onAddToDeck={addCardToDeck}
          onRequestNewDeck={() => setNewDeckOpen(true)}
        />
      )}

      {newDeckOpen && data && (
        <NewDeckDialog
          cards={data.cards}
          onCancel={() => setNewDeckOpen(false)}
          onCreate={handleCreateDeck}
        />
      )}
    </div>
  );
}
