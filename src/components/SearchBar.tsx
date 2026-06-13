import { useEffect, useMemo, useRef, useState } from 'react';
import type { TagIndexEntry } from '../types';
import { appendTag, tagPrefixOf } from '../search/parseQuery';
import { rankTags } from '../search/rankTags';
import { TagAutocomplete } from './TagAutocomplete';

interface Props {
  query: string;
  setQuery: (q: string) => void;
  tags: TagIndexEntry[];
}

export function SearchBar({ query, setQuery, tags }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const lastToken = /(\S*)$/.exec(query)?.[1] ?? '';
  const pref = tagPrefixOf(lastToken);
  const partial = pref !== null ? lastToken.slice(pref.length) : null;

  const suggestions = useMemo(
    () => (partial !== null ? rankTags(tags, partial) : []),
    [tags, partial],
  );
  const open = focused && partial !== null && !escaped;

  useEffect(() => {
    setActiveIndex(0);
  }, [partial]);

  const pick = (slug: string) => {
    setQuery(appendTag(query, slug));
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
        placeholder="Search by name, t:cat, or otag:reanimate …"
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
