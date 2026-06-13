import { useState } from 'react';
import type { OwnedCard } from '../types';

interface Props {
  card: OwnedCard;
  onSelect: (card: OwnedCard) => void;
}

export function CardTile({ card, onSelect }: Props) {
  const [errored, setErrored] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className="group relative block overflow-hidden rounded-xl bg-[#161922] text-left shadow ring-1 ring-white/5 transition hover:ring-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400"
      style={{ aspectRatio: '488 / 680' }}
      title={card.name}
    >
      {errored || !card.image ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
          <span className="text-sm font-medium text-zinc-200">{card.name}</span>
          <span className="text-xs text-zinc-500">{card.typeLine}</span>
        </div>
      ) : (
        <img
          src={card.image}
          alt={card.name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      )}

      {/* badges */}
      <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
        {card.quantity > 1 && (
          <span className="rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">
            ×{card.quantity}
          </span>
        )}
        {card.foil && (
          <span className="rounded-md bg-gradient-to-r from-fuchsia-500/80 to-amber-400/80 px-1.5 py-0.5 text-xs font-semibold text-black">
            foil
          </span>
        )}
        {card.printingCount !== undefined && card.printingCount > 1 && (
          <span
            className="rounded-md bg-sky-500/80 px-1.5 py-0.5 text-xs font-semibold text-white"
            title={`${card.printingCount} printings combined`}
          >
            {card.printingCount}p
          </span>
        )}
      </div>
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
        {card.set}
      </span>
    </button>
  );
}
