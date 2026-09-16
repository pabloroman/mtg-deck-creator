import type { ReactNode } from 'react';
import { ColorFilter } from './ColorFilter';
import { CollectionFilters } from './CollectionFilters';
import type { FilterControls } from '../search/useCollectionFilters';

interface Props {
  filters: FilterControls;
  availableRarities: string[];
  /** Optional control rendered before the color filter (e.g. the search box on Browse). */
  leading?: ReactNode;
  /** Optional caption before the color swatches (e.g. "Buildable in:" on Archetypes). */
  colorLabel?: string;
}

/**
 * The shared collection filter controls — color/identity plus rarity, owned,
 * sort and group. Every view that filters cards renders this, so a new filter
 * type added here (and to useCollectionFilters) shows up everywhere at once.
 * The text search box is view-specific, so it's injected via `leading` rather
 * than baked in.
 */
export function FilterBar({ filters: f, availableRarities, leading, colorLabel }: Props) {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {leading}
        <div className="flex flex-wrap items-center gap-3">
          {colorLabel && <span className="text-xs text-zinc-500">{colorLabel}</span>}
          <ColorFilter
            selected={f.colors}
            onToggle={f.toggleColor}
            axis={f.axis}
            onAxisChange={f.setAxis}
            match={f.match}
            onMatchChange={f.setMatch}
          />
        </div>
      </div>
      <CollectionFilters
        availableRarities={availableRarities}
        rarities={f.rarities}
        onToggleRarity={f.toggleRarity}
        pauperOnly={f.pauperOnly}
        onTogglePauper={f.togglePauper}
        playableOnly={f.playableOnly}
        onTogglePlayable={f.togglePlayable}
        minQuantity={f.minQuantity}
        onMinQuantity={f.setMinQuantity}
        groupPrintings={f.group}
        onToggleGroup={f.toggleGroup}
        sort={f.sort}
        onSortChange={f.setSort}
      />
    </>
  );
}
