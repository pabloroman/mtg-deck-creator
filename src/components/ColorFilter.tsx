import { COLOR_FILTER_KEYS, COLOR_META, type ColorFilterKey } from '../lib/mana';
import type { ColorAxis, ColorMatch } from '../search/filterCards';
import { Segmented } from './Segmented';

interface Props {
  selected: ColorFilterKey[];
  onToggle: (key: ColorFilterKey) => void;
  axis: ColorAxis;
  onAxisChange: (axis: ColorAxis) => void;
  match: ColorMatch;
  onMatchChange: (match: ColorMatch) => void;
}

export function ColorFilter({
  selected,
  onToggle,
  axis,
  onAxisChange,
  match,
  onMatchChange,
}: Props) {
  const sel = new Set(selected);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5">
        {COLOR_FILTER_KEYS.map((key) => {
          const meta = COLOR_META[key];
          const active = sel.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              title={meta.name}
              aria-pressed={active}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                active ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/20 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: meta.bg, color: meta.text }}
            >
              {key}
            </button>
          );
        })}
      </div>

      <Segmented
        value={axis}
        onChange={onAxisChange}
        options={[
          { value: 'identity', label: 'Identity' },
          { value: 'colors', label: 'Colors' },
        ]}
      />
      <Segmented
        value={match}
        onChange={onMatchChange}
        options={[
          { value: 'subset', label: '⊆ Subset' },
          { value: 'any', label: '∩ Any' },
        ]}
      />
    </div>
  );
}
