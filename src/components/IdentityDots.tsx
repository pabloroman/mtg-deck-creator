import type { Color } from '../types';
import { COLOR_META } from '../lib/mana';

/** Color-identity swatches; a single grey dot for colorless (empty identity). */
export function IdentityDots({ identity }: { identity: Color[] }) {
  const keys = identity.length === 0 ? (['C'] as const) : identity;
  return (
    <span className="flex gap-1">
      {keys.map((c) => {
        const m = COLOR_META[c];
        return (
          <span
            key={c}
            title={m.name}
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40"
            style={{ backgroundColor: m.bg }}
          />
        );
      })}
    </span>
  );
}
