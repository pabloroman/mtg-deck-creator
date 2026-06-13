import type { Color } from '../types';

export const COLORS: Color[] = ['W', 'U', 'B', 'R', 'G'];

/** UI pseudo-color for colorless cards (empty color array). */
export const COLORLESS = 'C' as const;
export type ColorFilterKey = Color | typeof COLORLESS;
export const COLOR_FILTER_KEYS: ColorFilterKey[] = [...COLORS, COLORLESS];

export const COLOR_META: Record<ColorFilterKey, { name: string; bg: string; text: string }> = {
  W: { name: 'White', bg: '#f8f6d8', text: '#5b5326' },
  U: { name: 'Blue', bg: '#0e68ab', text: '#ffffff' },
  B: { name: 'Black', bg: '#2b2620', text: '#e9e2d5' },
  R: { name: 'Red', bg: '#d3202a', text: '#ffffff' },
  G: { name: 'Green', bg: '#00733e', text: '#ffffff' },
  C: { name: 'Colorless', bg: '#9e9aa0', text: '#1c1c1c' },
};

/** "{3}{G}{G}" -> ["3", "G", "G"] */
export function parseManaSymbols(manaCost: string): string[] {
  if (!manaCost) return [];
  const matches = manaCost.match(/\{([^}]+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}
