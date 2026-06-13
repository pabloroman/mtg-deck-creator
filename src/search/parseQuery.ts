export interface ParsedQuery {
  tagSlugs: string[]; // AND-ed together
  typeTerms: string[]; // type-line substrings, AND-ed together
  text: string; // lowercased name substring
}

const TAG_PREFIXES = ['otag:', 'tag:'];
const TYPE_PREFIXES = ['type:', 't:'];

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

/**
 * "otag:reanimate t:cat dragon"
 *   -> { tagSlugs: ['reanimate'], typeTerms: ['cat'], text: 'dragon' }
 * Supports otag:/tag: for oracle tags, t:/type: for card type; everything else
 * is a name search.
 */
export function parseQuery(raw: string): ParsedQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const tagSlugs: string[] = [];
  const typeTerms: string[] = [];
  const textParts: string[] = [];
  for (const tok of tokens) {
    const tagPref = tagPrefixOf(tok);
    const typePref = !tagPref ? typePrefixOf(tok) : null;
    if (tagPref) {
      const slug = tok.slice(tagPref.length).trim().toLowerCase();
      if (slug) tagSlugs.push(slug);
    } else if (typePref) {
      const term = tok.slice(typePref.length).trim().toLowerCase();
      if (term) typeTerms.push(term);
    } else {
      textParts.push(tok);
    }
  }
  return { tagSlugs, typeTerms, text: textParts.join(' ').toLowerCase() };
}

/** Append `otag:<slug>` to a query, replacing a trailing partial tag token if present. */
export function appendTag(query: string, slug: string): string {
  const trimmedEnd = query.replace(/\s+$/, '');
  const tokens = trimmedEnd.length ? trimmedEnd.split(/\s+/) : [];
  const last = tokens[tokens.length - 1] ?? '';
  if (tokens.length && tagPrefixOf(last)) {
    tokens[tokens.length - 1] = `otag:${slug}`;
  } else {
    tokens.push(`otag:${slug}`);
  }
  return tokens.join(' ') + ' ';
}
