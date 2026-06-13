import type { TagIndexEntry } from '../types';

/**
 * Rank in-collection tags for the autocomplete given a partial slug.
 * Empty partial -> most-owned tags first. Otherwise prefix matches beat
 * substring matches; ties broken by owned count.
 */
export function rankTags(tags: TagIndexEntry[], partial: string, limit = 12): TagIndexEntry[] {
  const p = partial.toLowerCase();
  if (!p) return tags.slice(0, limit); // tags.json is pre-sorted by count desc

  const scored: { tag: TagIndexEntry; score: number }[] = [];
  for (const tag of tags) {
    const slug = tag.slug.toLowerCase();
    const label = tag.label.toLowerCase();
    const aliasHit = tag.aliases.some((a) => a.toLowerCase().includes(p));
    let score = Infinity;
    if (slug.startsWith(p)) score = 0;
    else if (label.startsWith(p)) score = 1;
    else if (tag.aliases.some((a) => a.toLowerCase().startsWith(p))) score = 2;
    else if (slug.includes(p) || label.includes(p)) score = 3;
    else if (aliasHit) score = 4;
    if (score !== Infinity) scored.push({ tag, score });
  }
  scored.sort((a, b) => a.score - b.score || b.tag.count - a.tag.count);
  return scored.slice(0, limit).map((s) => s.tag);
}
