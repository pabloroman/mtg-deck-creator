export interface ParsedQuery {
  tagSlugs: string[]; // AND-ed together
  typeTerms: string[]; // type-line substrings, AND-ed together
  keywordSlugs: string[]; // MTG keyword-ability slugs, AND-ed together
  text: string; // lowercased name substring
}

const TAG_PREFIXES = ['otag:', 'tag:'];
const TYPE_PREFIXES = ['type:', 't:'];
const KEYWORD_PREFIXES = ['kw:', 'keyword:'];

/** Returns the matching tag prefix for a token, or null. */
export function tagPrefixOf(token: string): string | null {
  const lower = token.toLowerCase();
  return TAG_PREFIXES.find((p) => lower.startsWith(p)) ?? null;
}

/** Returns the matching type prefix for a token, or null. */
export function typePrefixOf(token: string): string | null {
  const lower = token.toLowerCase();
  return TYPE_PREFIXES.find((p) => lower.startsWith(p)) ?? null;
}

/** Returns the matching keyword prefix for a token, or null. */
export function keywordPrefixOf(token: string): string | null {
  const lower = token.toLowerCase();
  return KEYWORD_PREFIXES.find((p) => lower.startsWith(p)) ?? null;
}

/** Normalize a keyword ability to its slug form, e.g. "First strike" -> "first-strike". */
export function keywordSlug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

/**
 * "otag:reanimate t:cat kw:flying dragon"
 *   -> { tagSlugs: ['reanimate'], typeTerms: ['cat'], keywordSlugs: ['flying'], text: 'dragon' }
 * Supports otag:/tag: for oracle tags, t:/type: for card type, kw:/keyword: for MTG
 * keyword abilities; everything else is a name search.
 */
export function parseQuery(raw: string): ParsedQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const tagSlugs: string[] = [];
  const typeTerms: string[] = [];
  const keywordSlugs: string[] = [];
  const textParts: string[] = [];
  for (const tok of tokens) {
    const tagPref = tagPrefixOf(tok);
    const typePref = !tagPref ? typePrefixOf(tok) : null;
    const kwPref = !tagPref && !typePref ? keywordPrefixOf(tok) : null;
    if (tagPref) {
      const slug = tok.slice(tagPref.length).trim().toLowerCase();
      if (slug) tagSlugs.push(slug);
    } else if (typePref) {
      const term = tok.slice(typePref.length).trim().toLowerCase();
      if (term) typeTerms.push(term);
    } else if (kwPref) {
      const slug = tok.slice(kwPref.length).trim().toLowerCase();
      if (slug) keywordSlugs.push(slug);
    } else {
      textParts.push(tok);
    }
  }
  return { tagSlugs, typeTerms, keywordSlugs, text: textParts.join(' ').toLowerCase() };
}

/**
 * Append `<prefix><value>` to a query, replacing a trailing partial token of the same
 * kind if present (so typing `otag:rea` then picking lands on `otag:reanimate`).
 */
function appendToken(
  query: string,
  value: string,
  prefix: string,
  prefixOf: (token: string) => string | null,
): string {
  const trimmedEnd = query.replace(/\s+$/, '');
  const tokens = trimmedEnd.length ? trimmedEnd.split(/\s+/) : [];
  const last = tokens[tokens.length - 1] ?? '';
  if (tokens.length && prefixOf(last)) {
    tokens[tokens.length - 1] = `${prefix}${value}`;
  } else {
    tokens.push(`${prefix}${value}`);
  }
  return tokens.join(' ') + ' ';
}

/** Append `otag:<slug>` to a query, replacing a trailing partial tag token if present. */
export function appendTag(query: string, slug: string): string {
  return appendToken(query, slug, 'otag:', tagPrefixOf);
}

/** Append `kw:<slug>` to a query, replacing a trailing partial keyword token if present. */
export function appendKeyword(query: string, slug: string): string {
  return appendToken(query, slug, 'kw:', keywordPrefixOf);
}
