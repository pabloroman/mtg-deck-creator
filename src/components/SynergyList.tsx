import { useLayoutEffect, useRef, useState } from 'react';
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
  /** Show the per-card reason line. Off where the surrounding context (e.g. a
   *  tab label) already names the relationship. Defaults to on. */
  showReason?: boolean;
}

/**
 * A responsive list of small card tiles (image + name + reason), used for the
 * card modal's "Engine partners" / "Similar cards" sections and the commander
 * guide's theme bucket. Hovering (or focusing) a tile reveals the card's oracle
 * text in a floating tooltip.
 */
export function SynergyList({ items, onSelect, testId, showReason = true }: Props) {
  // The hovered/focused card plus the screen rect of its tile, used to anchor
  // the floating tooltip. Null when nothing is hovered.
  const [active, setActive] = useState<{ card: OwnedCard; anchor: DOMRect } | null>(null);

  const show = (card: OwnedCard, el: HTMLElement) =>
    setActive({ card, anchor: el.getBoundingClientRect() });

  return (
    <div data-testid={testId} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {items.map((hit) => (
        <button
          key={hit.card.id}
          type="button"
          onClick={() => onSelect(hit.card)}
          onMouseEnter={(e) => show(hit.card, e.currentTarget)}
          onMouseLeave={() => setActive(null)}
          onFocus={(e) => show(hit.card, e.currentTarget)}
          onBlur={() => setActive(null)}
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
            {showReason && hit.reason && (
              <span className="block truncate text-xs text-zinc-400">{hit.reason}</span>
            )}
          </span>
        </button>
      ))}
      {active && <OracleTooltip card={active.card} anchor={active.anchor} />}
    </div>
  );
}

/**
 * A fixed-position popover showing a card's name, type, and oracle text. Uses
 * `position: fixed` so it isn't clipped by the modal's scroll container, and
 * flips to the other side of the anchor / clamps vertically to stay on screen.
 */
function OracleTooltip({ card, anchor }: { card: OwnedCard; anchor: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    // Prefer the right of the tile; flip left if it would overflow the viewport.
    let left = anchor.right + margin;
    if (left + width > window.innerWidth - margin) left = anchor.left - margin - width;
    left = Math.max(margin, left);
    // Align to the tile top, then clamp so it stays fully visible.
    let top = Math.min(anchor.top, window.innerHeight - margin - height);
    top = Math.max(margin, top);
    setPos({ left, top });
  }, [anchor, card.id]);

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{
        left: pos?.left ?? anchor.right + 8,
        top: pos?.top ?? anchor.top,
        // Hidden for the first layout pass so it doesn't flash at (0,0).
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="pointer-events-none fixed z-[60] w-72 rounded-lg bg-[#0c0e14] p-3 text-xs leading-relaxed shadow-xl ring-1 ring-white/15"
    >
      <div className="font-semibold text-zinc-100">{card.name}</div>
      <div className="mt-0.5 text-zinc-400">{card.typeLine}</div>
      {card.oracleText ? (
        <p className="mt-2 whitespace-pre-line text-zinc-300">{card.oracleText}</p>
      ) : (
        <p className="mt-2 italic text-zinc-500">No rules text.</p>
      )}
    </div>
  );
}
