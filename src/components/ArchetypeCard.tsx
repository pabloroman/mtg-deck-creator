import type { ArchetypeScore, Color } from '../types';
import { COLOR_META } from '../lib/mana';
import { lopsidedSide } from '../lib/synergy';

interface Props {
  score: ArchetypeScore;
  max: number;
  onSelect: (id: string) => void;
}

export function ArchetypeCard({ score, max, onSelect }: Props) {
  const a = score.archetype;
  const pct = max > 0 ? Math.max(4, Math.round((score.score / max) * 100)) : 0;
  const thin = lopsidedSide(score); // the THIN side, or null

  return (
    <button
      type="button"
      onClick={() => onSelect(a.id)}
      className="group flex flex-col gap-2 rounded-xl bg-[#13161e] p-4 text-left ring-1 ring-white/10 transition hover:ring-sky-500/40"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{a.name}</h3>
        <div className="flex gap-1">
          {score.colors.map((c) => (
            <ColorDot key={c} c={c} />
          ))}
        </div>
      </div>

      <p className="line-clamp-2 min-h-[2rem] text-xs text-zinc-400">{a.description}</p>

      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">
          enablers·<span className="text-zinc-200">{score.e}</span>{'  '}
          payoffs·<span className="text-zinc-200">{score.p}</span>
        </span>
        <span className="text-zinc-500">{score.engine} paired</span>
      </div>

      {thin && (
        <span className="text-[11px] font-medium text-amber-300">
          Deep in {thin === 'payoffs' ? 'enablers' : 'payoffs'}, thin on {thin}
        </span>
      )}
    </button>
  );
}

function ColorDot({ c }: { c: Color }) {
  const m = COLOR_META[c];
  return (
    <span
      title={m.name}
      className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40"
      style={{ backgroundColor: m.bg }}
    />
  );
}
