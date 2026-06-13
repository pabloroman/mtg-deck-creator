import { useMemo, useState } from 'react';
import { useCollection } from './data/useCollection';
import {
  parseQuery,
  appendTag,
  tagPrefixOf,
  typePrefixOf,
  keywordPrefixOf,
  keywordSlug,
} from './search/parseQuery';
import { filterCards, type ColorAxis, type ColorMatch } from './search/filterCards';
import { groupPrintings } from './search/groupPrintings';
import { scoreArchetypes } from './lib/synergy';
import { orderRarities } from './lib/rarity';
import type { ColorFilterKey } from './lib/mana';
import type { OwnedCard, TagIndexEntry } from './types';
import { SearchBar } from './components/SearchBar';
import { ColorFilter } from './components/ColorFilter';
import { CollectionFilters, type SortKey } from './components/CollectionFilters';
import { CardGrid } from './components/CardGrid';
import { CardModal } from './components/CardModal';
import { ResultSummary } from './components/ResultSummary';
import { ArchetypeDashboard } from './components/ArchetypeDashboard';
import { ArchetypeDetail } from './components/ArchetypeDetail';
import { CommanderGuide } from './components/CommanderGuide';

type View = 'browse' | 'decks' | 'commander';

export default function App() {
  const { data, loading, error } = useCollection();

  const [view, setView] = useState<View>('browse');
  const [archetypeId, setArchetypeId] = useState<string | null>(null);
  const [commander, setCommander] = useState<OwnedCard | null>(null);
  const [query, setQuery] = useState('');
  const [colors, setColors] = useState<ColorFilterKey[]>([]);
  const [axis, setAxis] = useState<ColorAxis>('identity');
  const [match, setMatch] = useState<ColorMatch>('subset');
  const [rarities, setRarities] = useState<string[]>([]);
  const [minQuantity, setMinQuantity] = useState(0);
  const [group, setGroup] = useState(true);
  const [sort, setSort] = useState<SortKey>('name');
  const [selected, setSelected] = useState<OwnedCard | null>(null);

  const parsed = useMemo(() => parseQuery(query), [query]);

  const tagMeta = useMemo(() => {
    const m = new Map<string, TagIndexEntry>();
    for (const t of data?.tags ?? []) m.set(t.slug, t);
    return m;
  }, [data]);

  const availableRarities = useMemo(
    () => orderRarities((data?.cards ?? []).map((c) => c.rarity)),
    [data],
  );

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

  const filtered = useMemo(() => {
    if (!data) return [];
    // 1. per-printing filters (tag, text, color, rarity)
    let list = filterCards(data.cards, {
      tagSlugs: parsed.tagSlugs,
      typeTerms: parsed.typeTerms,
      keywords: parsed.keywordSlugs,
      text: parsed.text,
      colors,
      axis,
      match,
      rarities,
    });
    // 2. optionally collapse printings of the same card (sums copies)
    if (group) list = groupPrintings(list);
    // 3. min-copies filter on the effective (per-printing or summed) quantity
    if (minQuantity > 0) list = list.filter((c) => c.quantity >= minQuantity);
    // 4. sort — cards arrive name-sorted; only re-sort for other orderings
    if (sort === 'owned') {
      list = [...list].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    } else if (sort === 'cmc') {
      list = [...list].sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));
    }
    return list;
  }, [data, parsed, colors, axis, match, rarities, group, minQuantity, sort]);

  const scores = useMemo(
    () => (data ? scoreArchetypes(data.cards, data.archetypes) : []),
    [data],
  );
  const selectedScore = useMemo(
    () => scores.find((s) => s.archetype.id === archetypeId) ?? null,
    [scores, archetypeId],
  );

  const hasFilters =
    parsed.tagSlugs.length > 0 ||
    parsed.typeTerms.length > 0 ||
    parsed.keywordSlugs.length > 0 ||
    parsed.text.length > 0 ||
    colors.length > 0 ||
    rarities.length > 0 ||
    minQuantity > 0;

  const toggleColor = (key: ColorFilterKey) =>
    setColors((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));

  const toggleRarity = (r: string) =>
    setRarities((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  // picking a tag (chip in the modal) always lands on the filtered browse view
  const addTag = (slug: string) => {
    setQuery((q) => appendTag(q, slug));
    setView('browse');
    setSelected(null);
  };

  const removeTag = (slug: string) =>
    setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = tagPrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === slug);
        })
        .join(' '),
    );

  const removeType = (term: string) =>
    setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = typePrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === term);
        })
        .join(' '),
    );

  const removeKeyword = (slug: string) =>
    setQuery((q) =>
      q
        .split(/\s+/)
        .filter((tok) => {
          const pref = keywordPrefixOf(tok);
          return !(pref && tok.slice(pref.length).toLowerCase() === slug);
        })
        .join(' '),
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
                  {(['browse', 'decks', 'commander'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setView(v);
                        if (v === 'decks') setArchetypeId(null);
                      }}
                      className={`rounded-md px-3 py-1 font-medium transition ${
                        view === v ? 'bg-sky-500/20 text-sky-200' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {v === 'browse' ? 'Browse' : v === 'decks' ? 'Decks' : 'Commander'}
                    </button>
                  ))}
                </div>
              </div>
              {data && view === 'browse' && (
                <ResultSummary filtered={filtered} totalCards={data.cards.length} hasFilters={hasFilters} />
              )}
            </div>

            {view === 'browse' && (
              <>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="lg:max-w-xl lg:flex-1">
                    <SearchBar
                      query={query}
                      setQuery={setQuery}
                      tags={data?.tags ?? []}
                      keywords={keywordIndex}
                    />
                  </div>
                  <ColorFilter
                    selected={colors}
                    onToggle={toggleColor}
                    axis={axis}
                    onAxisChange={setAxis}
                    match={match}
                    onMatchChange={setMatch}
                  />
                </div>

                <CollectionFilters
                  availableRarities={availableRarities}
                  rarities={rarities}
                  onToggleRarity={toggleRarity}
                  minQuantity={minQuantity}
                  onMinQuantity={setMinQuantity}
                  groupPrintings={group}
                  onToggleGroup={() => setGroup((g) => !g)}
                  sort={sort}
                  onSortChange={setSort}
                />

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

        {data && view === 'browse' && <CardGrid cards={filtered} onSelect={setSelected} />}

        {data &&
          view === 'decks' &&
          (selectedScore ? (
            <ArchetypeDetail
              score={selectedScore}
              cards={data.cards}
              onBack={() => setArchetypeId(null)}
              onSelectCard={setSelected}
            />
          ) : (
            <ArchetypeDashboard scores={scores} onSelect={setArchetypeId} />
          ))}

        {data && view === 'commander' && (
          <CommanderGuide
            cards={data.cards}
            archetypes={data.archetypes}
            commander={commander}
            onPickCommander={setCommander}
            onSelectCard={setSelected}
          />
        )}
      </main>

      {selected && data && (
        <CardModal
          card={selected}
          tagMeta={tagMeta}
          allCards={data.cards}
          archetypes={data.archetypes}
          onClose={() => setSelected(null)}
          onPickTag={addTag}
          onSelectCard={setSelected}
        />
      )}
    </div>
  );
}
