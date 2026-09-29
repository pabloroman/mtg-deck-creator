import { useMemo, useState } from 'react';
import type { SetSummary } from '../lib/sets';
import { Segmented } from './Segmented';
import { SetCard } from './SetCard';

interface Props {
  summaries: SetSummary[];
  onSelectSet: (code: string) => void;
}

type SetSort = 'date' | 'distinct' | 'copies' | 'name';

const SORT_OPTIONS: { value: SetSort; label: string }[] = [
  { value: 'date', label: 'Release date' },
  { value: 'distinct', label: 'Cards owned' },
  { value: 'copies', label: 'Copies' },
  { value: 'name', label: 'Name' },
];

export function SetsDashboard({ summaries, onSelectSet }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SetSort>('date');

  const totalDistinct = useMemo(() => summaries.reduce((n, s) => n + s.distinct, 0), [summaries]);
  const totalCopies = useMemo(() => summaries.reduce((n, s) => n + s.copies, 0), [summaries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? summaries.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      : summaries;
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'copies') {
      return [...list].sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name));
    }
    if (sort === 'distinct') {
      return [...list].sort((a, b) => b.distinct - a.distinct || a.name.localeCompare(b.name));
    }
    return list; // summaries arrive sorted by release date
  }, [summaries, query, sort]);

  // Release-date sort gets a header per year; other sorts are one untitled group.
  const groups = useMemo(() => {
    if (sort !== 'date') return [{ year: '', sets: shown }];
    const out: { year: string; sets: SetSummary[] }[] = [];
    for (const s of shown) {
      const year = s.releasedAt.slice(0, 4) || 'Unknown';
      if (out.at(-1)?.year !== year) out.push({ year, sets: [] });
      out.at(-1)!.sets.push(s);
    }
    return out;
  }, [shown, sort]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Your collection by set</h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          {summaries.length} sets · {totalDistinct} distinct cards · {totalCopies} total copies. Click
          a set to browse the cards you own from it.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a set…"
          spellCheck={false}
          autoComplete="off"
          className="w-full max-w-xs rounded-lg bg-[#11141c] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Sort</span>
          <Segmented value={sort} onChange={setSort} options={SORT_OPTIONS} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="py-16 text-center text-zinc-500">No sets match “{query}”.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.year}>
              {g.year && (
                <h3 className="mb-2 flex items-baseline gap-2 text-lg font-semibold text-white">
                  {g.year}
                  <span className="text-xs font-normal text-zinc-500">
                    {g.sets.length} {g.sets.length === 1 ? 'set' : 'sets'}
                  </span>
                </h3>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.sets.map((s) => (
                  <SetCard key={s.code} summary={s} onSelect={onSelectSet} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
