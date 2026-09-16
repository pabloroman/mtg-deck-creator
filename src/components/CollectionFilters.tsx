import { rarityMeta } from '../lib/rarity';
import { Segmented } from './Segmented';

export type SortKey = 'name' | 'owned' | 'cmc' | 'edhrec';

interface Props {
  availableRarities: string[];
  rarities: string[];
  onToggleRarity: (rarity: string) => void;
  minQuantity: number;
  onMinQuantity: (n: number) => void;
  pauperOnly: boolean;
  onTogglePauper: () => void;
  playableOnly: boolean;
  onTogglePlayable: () => void;
  groupPrintings: boolean;
  onToggleGroup: () => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}

const COPIES_OPTIONS = [
  { value: '0', label: 'Any' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: 'Playset' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'owned', label: 'Owned' },
  { value: 'cmc', label: 'CMC' },
  { value: 'edhrec', label: 'EDHREC' },
];

export function CollectionFilters({
  availableRarities,
  rarities,
  onToggleRarity,
  minQuantity,
  onMinQuantity,
  pauperOnly,
  onTogglePauper,
  playableOnly,
  onTogglePlayable,
  groupPrintings,
  onToggleGroup,
  sort,
  onSortChange,
}: Props) {
  const sel = new Set(rarities);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* Rarity toggles */}
      {availableRarities.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Rarity</span>
          {availableRarities.map((r) => {
            const meta = rarityMeta(r);
            const active = sel.has(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => onToggleRarity(r)}
                title={r}
                aria-pressed={active}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition ${
                  active ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/20 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: meta.bg, color: meta.text }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Copies-owned presets */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-500">Owned</span>
        <Segmented
          value={String(minQuantity)}
          onChange={(v) => onMinQuantity(Number(v))}
          options={COPIES_OPTIONS}
        />
      </div>

      {/* Sort order */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-500">Sort</span>
        <Segmented value={sort} onChange={onSortChange} options={SORT_OPTIONS} />
      </div>

      {/* Pauper-legal toggle */}
      <button
        type="button"
        onClick={onTogglePauper}
        aria-pressed={pauperOnly}
        title="Show only cards legal in the Pauper format"
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
          pauperOnly
            ? 'bg-sky-500/20 text-sky-200 ring-sky-500/40'
            : 'bg-white/5 text-zinc-400 ring-white/10 hover:text-zinc-200'
        }`}
      >
        ◆ Pauper legal
      </button>

      {/* Pull-list toggle. Amber, matching the playable chips in the card detail view —
          these tags are build-generated, not Scryfall oracle tags. */}
      <button
        type="button"
        onClick={onTogglePlayable}
        aria-pressed={playableOnly}
        title="Show only cards on the pull list: self-contained, readable in one sentence"
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
          playableOnly
            ? 'bg-amber-500/20 text-amber-200 ring-amber-500/40'
            : 'bg-white/5 text-zinc-400 ring-white/10 hover:text-zinc-200'
        }`}
      >
        ✦ Playable
      </button>

      {/* Group printings toggle */}
      <button
        type="button"
        onClick={onToggleGroup}
        aria-pressed={groupPrintings}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
          groupPrintings
            ? 'bg-sky-500/20 text-sky-200 ring-sky-500/40'
            : 'bg-white/5 text-zinc-400 ring-white/10 hover:text-zinc-200'
        }`}
      >
        ⧉ Group printings
      </button>
    </div>
  );
}
