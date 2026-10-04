import { useEffect, useMemo, useRef, useState } from 'react';
import type { TagIndexEntry } from '../types';
import {
  appendKeyword,
  appendSet,
  appendTag,
  keywordPrefixOf,
  setPrefixOf,
  tagPrefixOf,
} from '../search/parseQuery';
import { rankTags } from '../search/rankTags';
import { TagAutocomplete } from './TagAutocomplete';

interface Props {
  query: string;
  setQuery: (q: string) => void;
  tags: TagIndexEntry[];
  keywords: TagIndexEntry[]; // MTG keyword abilities, shaped as TagIndexEntry for reuse
  sets: TagIndexEntry[]; // collection sets (slug = code, label = set name), shaped for reuse
}

export function SearchBar({ query, setQuery, tags, keywords, sets }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Which prefix is the cursor currently completing? Tag wins over keyword over set.
  const lastToken = /(\S*)$/.exec(query)?.[1] ?? '';
  const tagPref = tagPrefixOf(lastToken);
  const kwPref = !tagPref ? keywordPrefixOf(lastToken) : null;
  const setPref = !tagPref && !kwPref ? setPrefixOf(lastToken) : null;
  const mode: 'tag' | 'keyword' | 'set' | null = tagPref
    ? 'tag'
    : kwPref
      ? 'keyword'
      : setPref
        ? 'set'
        : null;
  const activePref = tagPref ?? kwPref ?? setPref;
  const partial = activePref !== null ? lastToken.slice(activePref.length) : null;

  const suggestions = useMemo(
    () =>
      partial !== null
        ? rankTags(mode === 'keyword' ? keywords : mode === 'set' ? sets : tags, partial)
        : [],
    [tags, keywords, sets, mode, partial],
  );
  const open = focused && partial !== null && !escaped;

  useEffect(() => {
    setActiveIndex(0);
  }, [partial]);

  const pick = (slug: string) => {
    const next =
      mode === 'keyword'
        ? appendKeyword(query, slug)
        : mode === 'set'
          ? appendSet(query, slug)
          : appendTag(query, slug);
    setQuery(next);
    setEscaped(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions[activeIndex]) {
        e.preventDefault();
        pick(suggestions[activeIndex].slug);
      }
    } else if (e.key === 'Escape') {
      setEscaped(true);
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setEscaped(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder="Search by name, t:cat, kw:flying, set:woe, mv<=3, id:rg, fo:draw, or otag:reanimate …"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-xl bg-[#11141c] px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1 text-zinc-500 hover:text-zinc-200"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
      {open && (
        <TagAutocomplete
          suggestions={suggestions}
          activeIndex={activeIndex}
          onPick={pick}
          onHover={setActiveIndex}
        />
      )}
    </div>
  );
}
