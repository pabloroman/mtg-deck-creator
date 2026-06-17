import type { SetSummary } from '../lib/sets';
import { orderRarities, rarityMeta } from '../lib/rarity';

interface Props {
  summary: SetSummary;
  onSelect: (code: string) => void;
}

export function SetCard({ summary, onSelect }: Props) {
  const rarities = orderRarities(Object.keys(summary.rarities));

  return (
    <button
      type="button"
      onClick={() => onSelect(summary.code)}
      title={`Browse cards from ${summary.name}`}
      className="group flex flex-col gap-2 rounded-xl bg-[#13161e] p-4 text-left ring-1 ring-white/10 transition hover:ring-sky-500/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight text-white">{summary.name}</h3>
        <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 ring-1 ring-white/10">
          {summary.code}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-white">{summary.distinct}</span>
        <span className="text-xs text-zinc-500">cards owned</span>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          <span className="text-zinc-200">{summary.copies}</span> copies
        </span>
        {summary.foils > 0 && (
          <span>
            <span className="text-zinc-200">{summary.foils}</span> foil
          </span>
        )}
      </div>

      {rarities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {rarities.map((r) => {
            const meta = rarityMeta(r);
            return (
              <span
                key={r}
                title={`${summary.rarities[r]} ${r}`}
                className="flex h-5 items-center gap-1 rounded px-1 text-[11px] font-semibold ring-1 ring-white/10"
                style={{ backgroundColor: meta.bg, color: meta.text }}
              >
                {meta.label}
                <span className="opacity-80">{summary.rarities[r]}</span>
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}
