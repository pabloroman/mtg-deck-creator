import { useMemo, useState } from 'react';
import { useCollection } from './data/useCollection';
import { parseQuery, appendTag, tagPrefixOf } from './search/parseQuery';
import { filterCards, type ColorAxis, type ColorMatch } from './search/filterCards';
import type { ColorFilterKey } from './lib/mana';
import type { OwnedCard, TagIndexEntry } from './types';
import { SearchBar } from './components/SearchBar';
import { ColorFilter } from './components/ColorFilter';
import { CardGrid } from './components/CardGrid';
import { CardModal } from './components/CardModal';
import { ResultSummary } from './components/ResultSummary';

export default function App() {
  const { data, loading, error } = useCollection();

  const [query, setQuery] = useState('');
  const [colors, setColors] = useState<ColorFilterKey[]>([]);
  const [axis, setAxis] = useState<ColorAxis>('identity');
  const [match, setMatch] = useState<ColorMatch>('subset');
  const [selected, setSelected] = useState<OwnedCard | null>(null);

  const parsed = useMemo(() => parseQuery(query), [query]);

  const tagMeta = useMemo(() => {
    const m = new Map<string, TagIndexEntry>();
    for (const t of data?.tags ?? []) m.set(t.slug, t);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterCards(data.cards, {
      tagSlugs: parsed.tagSlugs,
      text: parsed.text,
      colors,
      axis,
      match,
    });
  }, [data, parsed, colors, axis, match]);

  const hasFilters = parsed.tagSlugs.length > 0 || parsed.text.length > 0 || colors.length > 0;

  const toggleColor = (key: ColorFilterKey) =>
    setColors((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));

  const addTag = (slug: string) => {
    setQuery((q) => appendTag(q, slug));
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

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0f14]/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="text-lg font-bold text-white">
                MTG Collection <span className="text-sky-400">Browser</span>
              </h1>
              {data && <ResultSummary filtered={filtered} totalCards={data.cards.length} hasFilters={hasFilters} />}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="lg:max-w-xl lg:flex-1">
                <SearchBar query={query} setQuery={setQuery} tags={data?.tags ?? []} />
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
        {data && <CardGrid cards={filtered} onSelect={setSelected} />}
      </main>

      {selected && (
        <CardModal
          card={selected}
          tagMeta={tagMeta}
          onClose={() => setSelected(null)}
          onPickTag={addTag}
        />
      )}
    </div>
  );
}
