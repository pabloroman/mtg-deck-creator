const BAR_MAX_PX = 48;

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
