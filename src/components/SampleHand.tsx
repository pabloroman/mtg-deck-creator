import { useState } from 'react';
import type { OwnedCard } from '../types';
import { type CardIndex, type Deck, isLand, shuffledLibrary } from '../lib/deck';

interface Props {
  deck: Deck;
  index: CardIndex;
  onPreview: (card: OwnedCard) => void;
}

const HAND_SIZE = 7;
const btn =
  'rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40';

/** Goldfish opening hands: shuffle, look at the opening 7, draw, mulligan. */
export function SampleHand({ deck, index, onPreview }: Props) {
  const [library, setLibrary] = useState(() => shuffledLibrary(deck, index));
  const [handSize, setHandSize] = useState(HAND_SIZE);
  const [drawn, setDrawn] = useState(HAND_SIZE);

  // ponytail: a mulligan just deals one fewer; London mulligan (draw 7, bottom N)
  // needs a card-picking step — add it if hand quality after mulligans matters.
  const deal = (size: number) => {
    setLibrary(shuffledLibrary(deck, index));
    setHandSize(size);
    setDrawn(size);
  };

  const hand = library.slice(0, drawn);
  const draws = hand.length - Math.min(handSize, library.length);
  const lands = hand.filter(isLand).length;

  return (
    <div className="mb-6 rounded-2xl bg-[#13161e] p-4 ring-1 ring-white/10 [column-span:all]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => deal(HAND_SIZE)} className={btn}>
          New hand
        </button>
        <button
          type="button"
          onClick={() => deal(handSize - 1)}
          disabled={handSize <= 1}
          className={btn}
        >
          Mulligan to {handSize - 1}
        </button>
        <button
          type="button"
          onClick={() => setDrawn(drawn + 1)}
          disabled={drawn >= library.length}
          className={btn}
        >
          Draw
        </button>
        <span className="text-sm tabular-nums text-zinc-400">
          {draws === 0 ? 'Opening hand' : `Draw ${draws}`} · {lands} land{lands === 1 ? '' : 's'} ·{' '}
          {library.length - hand.length} in library
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {hand.map((card, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => onPreview(card)}
            onFocus={() => onPreview(card)}
            title={card.name}
            className={`overflow-hidden rounded-lg ${i >= handSize ? 'ring-2 ring-sky-400/60' : ''}`}
          >
            {card.image ? (
              <img src={card.image} alt={card.name} className="aspect-[5/7] w-full object-cover" />
            ) : (
              <span className="flex aspect-[5/7] items-center justify-center p-1 text-center text-xs text-zinc-300 ring-1 ring-inset ring-white/10">
                {card.name}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
