import type { OwnedCard } from '../types';

interface Props {
  filtered: OwnedCard[];
  totalCards: number;
  hasFilters: boolean;
}

export function ResultSummary({ filtered, totalCards, hasFilters }: Props) {
  const copies = filtered.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <p className="text-sm text-zinc-400">
      {hasFilters ? (
        <>
          <span className="font-semibold text-zinc-100">{filtered.length}</span> matching card
          {filtered.length === 1 ? '' : 's'}{' '}
          <span className="text-zinc-500">
            ({copies} cop{copies === 1 ? 'y' : 'ies'} · of {totalCards} owned)
          </span>
        </>
      ) : (
        <>
          <span className="font-semibold text-zinc-100">{totalCards}</span> cards in your collection
        </>
      )}
    </p>
  );
}
