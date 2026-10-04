import { parseManaSymbols } from '../lib/mana';

/** A mana cost as Scryfall symbol images, e.g. "{1}{R}". Front face only; nothing for lands. */
export function ManaCost({ cost }: { cost: string }) {
  const symbols = parseManaSymbols(cost.split(' // ')[0]);
  if (symbols.length === 0) return null;
  return (
    <span className="flex shrink-0 gap-0.5" aria-label={`Mana cost ${cost}`}>
      {symbols.map((sym, i) => (
        <img
          key={i}
          src={`https://svgs.scryfall.io/card-symbols/${sym.replace(/\//g, '')}.svg`}
          alt={`{${sym}}`}
          className="h-4 w-4"
        />
      ))}
    </span>
  );
}
