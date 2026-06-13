export interface ParsedQuery {
  tagSlugs: string[]; // AND-ed together
  text: string; // lowercased name substring
}

const TAG_PREFIXES = ['otag:', 'tag:', 't:'];

/** Returns the matching tag prefix for a token, or null. */
export function tagPrefixOf(token: string): string | null {
  const lower = token.toLowerCase();
  return TAG_PREFIXES.find((p) => lower.startsWith(p)) ?? null;
}

/**
 * "otag:reanimate dragon" -> { tagSlugs: ['reanimate'], text: 'dragon' }
 * Supports otag:/tag:/t: prefixes; everything else is a name search.
 */
export function parseQuery(raw: string): ParsedQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const tagSlugs: string[] = [];
  const textParts: string[] = [];
  for (const tok of tokens) {
    const pref = tagPrefixOf(tok);
    if (pref) {
      const slug = tok.slice(pref.length).trim().toLowerCase();
      if (slug) tagSlugs.push(slug);
    } else {
      textParts.push(tok);
    }
  }
  return { tagSlugs, text: textParts.join(' ').toLowerCase() };
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
