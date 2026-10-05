import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { OwnedCard } from '../types';
import type { ColorFilterKey } from '../lib/mana';
import { filterCards, type ColorAxis, type ColorMatch } from './filterCards';
import { groupPrintings } from './groupPrintings';
import type { ParsedQuery } from './parseQuery';
import type { SortKey } from '../components/CollectionFilters';

/**
 * All collection-filter state + setters in one bundle. Held once (per view that
 * filters cards) and passed straight to <FilterBar>. Adding a new filter type
 * means adding a field here, a control in FilterBar, and a clause in
 * applyCollectionFilters — and every view that uses them picks it up for free.
 */
export interface FilterControls {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  colors: ColorFilterKey[];
  toggleColor: (key: ColorFilterKey) => void;
  axis: ColorAxis;
  setAxis: (a: ColorAxis) => void;
  match: ColorMatch;
  setMatch: (m: ColorMatch) => void;
  rarities: string[];
  toggleRarity: (rarity: string) => void;
  pauperOnly: boolean;
  togglePauper: () => void;
  playableOnly: boolean;
  togglePlayable: () => void;
  minQuantity: number;
  setMinQuantity: (n: number) => void;
  group: boolean;
  toggleGroup: () => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
}

/** The value subset of FilterControls that drives {@link applyCollectionFilters}. */
export type FilterValues = Pick<
  FilterControls,
  | 'colors'
  | 'axis'
  | 'match'
  | 'rarities'
  | 'pauperOnly'
  | 'playableOnly'
  | 'group'
  | 'minQuantity'
  | 'sort'
>;

export function useCollectionFilters(): FilterControls {
  const [query, setQuery] = useState('');
  const [colors, setColors] = useState<ColorFilterKey[]>([]);
  const [axis, setAxis] = useState<ColorAxis>('identity');
  const [match, setMatch] = useState<ColorMatch>('subset');
  const [rarities, setRarities] = useState<string[]>([]);
  const [pauperOnly, setPauperOnly] = useState(false);
  const [playableOnly, setPlayableOnly] = useState(false);
  const [minQuantity, setMinQuantity] = useState(0);
  const [group, setGroup] = useState(true);
  const [sort, setSort] = useState<SortKey>('edhrec');

  return {
    query,
    setQuery,
    colors,
    toggleColor: (key) =>
      setColors((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key])),
    axis,
    setAxis,
    match,
    setMatch,
    rarities,
    toggleRarity: (r) =>
      setRarities((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])),
    pauperOnly,
    togglePauper: () => setPauperOnly((p) => !p),
    playableOnly,
    togglePlayable: () => setPlayableOnly((p) => !p),
    minQuantity,
    setMinQuantity,
    group,
    toggleGroup: () => setGroup((g) => !g),
    sort,
    setSort,
  };
}

/**
 * The shared filter pipeline: color/rarity → group printings → owned-copies → sort.
 * Pass `parsed` to also apply the text-search terms (Browse); omit it for views
 * without a search box (Archetypes), which filter on everything but the query.
 */
export function applyCollectionFilters(
  cards: OwnedCard[],
  f: FilterValues,
  parsed?: ParsedQuery | null,
): OwnedCard[] {
  let list = filterCards(cards, {
    tagSlugs: parsed?.tagSlugs ?? [],
    typeTerms: parsed?.typeTerms ?? [],
    keywords: parsed?.keywordSlugs ?? [],
    text: parsed?.text ?? '',
    colors: f.colors,
    axis: f.axis,
    match: f.match,
    rarities: f.rarities,
    setCodes: parsed?.setCodes ?? [],
    mvTerms: parsed?.mvTerms ?? [],
    identityTerms: parsed?.identityTerms ?? [],
    oracleTerms: parsed?.oracleTerms ?? [],
    pauperOnly: f.pauperOnly,
    playableOnly: f.playableOnly,
  });
  if (f.group) list = groupPrintings(list);
  if (f.minQuantity > 0) list = list.filter((c) => c.quantity >= f.minQuantity);
  if (f.sort === 'owned') {
    list = [...list].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
  } else if (f.sort === 'cmc') {
    list = [...list].sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));
  } else if (f.sort === 'edhrec') {
    // lower rank = more played; unranked cards sort to the end
    list = [...list].sort(
      (a, b) =>
        (a.edhrecRank ?? Infinity) - (b.edhrecRank ?? Infinity) || a.name.localeCompare(b.name),
    );
  }
  return list;
}
