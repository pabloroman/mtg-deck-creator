import type { ArchetypeScore } from '../types';
import { ArchetypeCard } from './ArchetypeCard';

interface Props {
  scores: ArchetypeScore[];
  onSelect: (id: string) => void;
}

export function ArchetypeDashboard({ scores, onSelect }: Props) {
  const max = scores[0]?.score ?? 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Archetypes your collection supports</h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          Ranked by paired synergy depth — how many enablers <span className="text-zinc-300">and</span>{' '}
          payoffs you own for each engine. Click one to see the cards.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {scores.map((s) => (
          <ArchetypeCard key={s.archetype.id} score={s} max={max} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
