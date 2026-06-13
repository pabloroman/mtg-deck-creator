import type { OwnedCard } from '../types';

/** Either a SynergyHit or a ScoredCard — both carry a card and a reason. */
interface Item {
  card: OwnedCard;
  reason: string;
}

interface Props {
  items: Item[];
  onSelect: (card: OwnedCard) => void;
  testId?: string;
}

/**
 * A responsive list of small card tiles (image + name + reason), used both in
 * the card modal's "Synergizes with" section and the commander guide's theme
 * bucket.
 */
export function SynergyList({ items, onSelect, testId }: Props) {
  return (
    <div data-testid={testId} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {items.map((hit) => (
        <button
          key={hit.card.id}
          type="button"
          onClick={() => onSelect(hit.card)}
          className="flex items-center gap-2 rounded-lg p-1.5 text-left ring-1 ring-white/10 hover:bg-white/5 hover:ring-sky-500/40"
        >
          {hit.card.image ? (
            <img
              src={hit.card.image}
              alt=""
              loading="lazy"
              className="h-12 w-9 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-12 w-9 shrink-0 rounded bg-zinc-800" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-100">{hit.card.name}</span>
            {hit.reason && <span className="block truncate text-xs text-zinc-400">{hit.reason}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
