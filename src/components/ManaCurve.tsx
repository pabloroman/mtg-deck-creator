import type { ManaStats } from '../lib/deck';
import { COLORS, COLOR_META } from '../lib/mana';

const BAR_MAX_PX = 48;

/** Colour-pip split, average mana value and land count vs. the suggested count. */
export function ManaSummary({ stats }: { stats: ManaStats }) {
  const { pips, pipTotal, avgMv, lands, recommendedLands } = stats;
  const landsOk = Math.abs(lands - recommendedLands) <= 1;
  return (
    <div className="space-y-1.5 text-sm">
      {pipTotal > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Colour pips</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {COLORS.filter((c) => pips[c] > 0).map((c) => (
              <span
                key={c}
                title={`${COLOR_META[c].name}: ${Math.round(pips[c])} pips`}
                className="flex items-center gap-1 tabular-nums text-zinc-200"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40"
                  style={{ backgroundColor: COLOR_META[c].bg }}
                />
                {Math.round((pips[c] / pipTotal) * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="flex justify-between text-zinc-400">
        Avg mana value
        <span className="tabular-nums text-zinc-100">{avgMv.toFixed(2)}</span>
      </p>
      <p
        className="flex justify-between text-zinc-400"
        title="Suggested by Frank Karsten's formula: rises with average mana value, drops with cheap ramp and card draw"
      >
        Lands
        <span className={`tabular-nums ${landsOk ? 'text-emerald-300' : 'text-amber-300'}`}>
          {lands} <span className="text-zinc-500">/ {recommendedLands} suggested</span>
        </span>
      </p>
    </div>
  );
}

/** Column chart of a deck's mana curve; `curve[i]` = nonland cards at mana value i (last = 7+). */
export function ManaCurve({ curve }: { curve: number[] }) {
  const max = Math.max(...curve);
  if (max === 0) return null;
  const label = (mv: number) => (mv === curve.length - 1 ? `${mv}+` : String(mv));

  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Mana curve · nonland</p>
      <div
        role="img"
        aria-label={`Mana curve: ${curve.map((n, mv) => `${n} at ${label(mv)}`).join(', ')}`}
        className="flex gap-0.5"
      >
        {curve.map((n, mv) => (
          <div
            key={mv}
            title={`Mana value ${label(mv)}: ${n} card${n === 1 ? '' : 's'}`}
            className="flex w-6 flex-col items-center"
          >
            <div className="flex h-16 w-full flex-col items-center justify-end border-b border-white/15">
              {n > 0 && <span className="text-[10px] tabular-nums leading-4 text-zinc-300">{n}</span>}
              <div
                className="w-full rounded-t bg-sky-500"
                style={{ height: Math.round((n / max) * BAR_MAX_PX) }}
              />
            </div>
            <span className="text-[10px] tabular-nums leading-4 text-zinc-500">{label(mv)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
