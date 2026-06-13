import { useEffect, useRef, useState } from 'react';
import type { OwnedCard } from '../types';
import { CardTile } from './CardTile';

const PAGE = 80;

interface Props {
  cards: OwnedCard[];
  onSelect: (card: OwnedCard) => void;
}

export function CardGrid({ cards, onSelect }: Props) {
  const [count, setCount] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // reset paging whenever the filtered set changes
  useEffect(() => {
    setCount(PAGE);
  }, [cards]);

  // auto-load more as the sentinel approaches the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + PAGE, cards.length));
        }
      },
      { rootMargin: '800px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cards.length, count]);

  if (cards.length === 0) {
    return (
      <div className="py-24 text-center text-zinc-500">
        No cards match your filters.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {cards.slice(0, count).map((card) => (
          <CardTile key={card.id} card={card} onSelect={onSelect} />
        ))}
      </div>
      {count < cards.length && (
        <div ref={sentinelRef} className="flex justify-center py-10">
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(c + PAGE, cards.length))}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/20"
          >
            Load more ({cards.length - count} left)
          </button>
        </div>
      )}
    </>
  );
}
