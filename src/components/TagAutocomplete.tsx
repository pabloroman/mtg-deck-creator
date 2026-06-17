import type { TagIndexEntry } from '../types';
import { keywordSlug } from '../search/parseQuery';

interface Props {
  suggestions: TagIndexEntry[];
  activeIndex: number;
  onPick: (slug: string) => void;
  onHover: (index: number) => void;
}

function stripMd(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

export function TagAutocomplete({ suggestions, activeIndex, onPick, onHover }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="absolute z-40 mt-1 w-full rounded-lg bg-[#1b1f2a] p-3 text-sm text-zinc-500 shadow-xl ring-1 ring-white/10">
        No matching tags in your collection.
      </div>
    );
  }
  return (
    <ul className="scroll-thin absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-lg bg-[#1b1f2a] py-1 shadow-xl ring-1 ring-white/10">
      {suggestions.map((tag, i) => (
        <li key={tag.slug}>
          <button
            type="button"
            // onMouseDown (not onClick) so it fires before the input blur
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(tag.slug);
            }}
            onMouseEnter={() => onHover(i)}
            className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
              i === activeIndex ? 'bg-sky-500/20' : 'hover:bg-white/5'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-sky-300">{tag.slug}</span>
              <span className="shrink-0 text-xs text-zinc-500">{tag.count} owned</span>
            </div>
            {tag.label && keywordSlug(tag.label) !== tag.slug && (
              <span className="text-xs text-zinc-300">{tag.label}</span>
            )}
            {tag.description && (
              <span className="line-clamp-2 text-xs text-zinc-400">{stripMd(tag.description)}</span>
            )}
            {tag.aliases.length > 0 && (
              <span className="text-[11px] text-zinc-600">aka {tag.aliases.join(', ')}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
