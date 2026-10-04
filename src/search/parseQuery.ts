export type MvOp = '=' | '<' | '<=' | '>' | '>=';
export interface MvTerm {
  op: MvOp;
  value: number;
}

export interface IdentityTerm {
  op: MvOp;
  colors: string[]; // uppercase color letters; [] = colorless
}

export interface ParsedQuery {
  tagSlugs: string[]; // AND-ed together
  typeTerms: string[]; // type-line substrings, AND-ed together
  keywordSlugs: string[]; // MTG keyword-ability slugs, AND-ed together
  setCodes: string[]; // set codes, OR-ed together
  oracleTerms: string[]; // lowercased rules-text substrings, AND-ed together
  mvTerms: MvTerm[];
  identityTerms: IdentityTerm[]; // color-identity comparisons, AND-ed together // mana-value comparisons, AND-ed together (mv>=2 mv<=4 = a range)
  text: string; // lowercased name substring
}

const TAG_PREFIXES = ['otag:', 'tag:'];
const TYPE_PREFIXES = ['type:', 't:'];
const KEYWORD_PREFIXES = ['kw:', 'keyword:'];
const SET_PREFIXES = ['set:', 's:'];
// id:rg / id<=rg (fits in an RG deck), id=rg (exactly), id>=rg (at least), id:c (colorless)
const IDENTITY_TOKEN = /^(?:id|ci|identity)(:|=|<=|>=|<|>)([wubrgc]+)$/i;
const ORACLE_PREFIXES = ['fo:', 'fulloracle:'];
// mv:3 / mv=3 / mv<=2 / mv>=5 / mv<4 / mv>4 (cmc and manavalue are aliases)
const MV_TOKEN = /^(?:mv|cmc|manavalue)(:|=|<=|>=|<|>)(\d+)$/i;

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

/** Returns the matching set prefix for a token, or null. `set:` wins over `s:`. */
export function setPrefixOf(token: string): string | null {
  const lower = token.toLowerCase();
  return SET_PREFIXES.find((p) => lower.startsWith(p)) ?? null;
}

/** Normalize a keyword ability to its slug form, e.g. "First strike" -> "first-strike". */
export function keywordSlug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

/**
 * "otag:reanimate t:cat kw:flying set:woe dragon"
 *   -> { tagSlugs: ['reanimate'], typeTerms: ['cat'], keywordSlugs: ['flying'],
 *        setCodes: ['woe'], mvTerms: [], text: 'dragon' }
 * Supports otag:/tag: for oracle tags, t:/type: for card type, kw:/keyword: for MTG
 * keyword abilities, set:/s: for set code, mv<=N style mana-value comparisons,
 * id<=rg style color-identity comparisons, fo:/fulloracle: for rules text (quote phrases: fo:"draw a card"); everything else
 * is a name search.
 */
export function parseQuery(raw: string): ParsedQuery {
  // whitespace-separated, but a "quoted phrase" stays inside its token (the closing
  // quote is optional so a phrase still being typed isn't split into name words)
  const tokens = raw.match(/(?:[^\s"]|"[^"]*"?)+/g) ?? [];
  const tagSlugs: string[] = [];
  const typeTerms: string[] = [];
  const keywordSlugs: string[] = [];
  const setCodes: string[] = [];
  const oracleTerms: string[] = [];
  const mvTerms: MvTerm[] = [];
  const identityTerms: IdentityTerm[] = [];
  const textParts: string[] = [];
  for (const tok of tokens) {
    const mv = MV_TOKEN.exec(tok);
    if (mv) {
      mvTerms.push({ op: mv[1] === ':' ? '=' : (mv[1] as MvOp), value: Number(mv[2]) });
      continue;
    }
    const id = IDENTITY_TOKEN.exec(tok);
    if (id) {
      identityTerms.push({
        op: id[1] === ':' ? '<=' : (id[1] as MvOp),
        colors: [...new Set(id[2].toUpperCase())].filter((c) => c !== 'C'),
      });
      continue;
    }
    const oraclePref = ORACLE_PREFIXES.find((p) => tok.toLowerCase().startsWith(p));
    if (oraclePref) {
      const term = tok.slice(oraclePref.length).replace(/"/g, '').trim().toLowerCase();
      if (term) oracleTerms.push(term);
      continue;
    }
    const tagPref = tagPrefixOf(tok);
    const typePref = !tagPref ? typePrefixOf(tok) : null;
    const kwPref = !tagPref && !typePref ? keywordPrefixOf(tok) : null;
    const setPref = !tagPref && !typePref && !kwPref ? setPrefixOf(tok) : null;
    if (tagPref) {
      const slug = tok.slice(tagPref.length).trim().toLowerCase();
      if (slug) tagSlugs.push(slug);
    } else if (typePref) {
      const term = tok.slice(typePref.length).trim().toLowerCase();
      if (term) typeTerms.push(term);
    } else if (kwPref) {
      const slug = tok.slice(kwPref.length).trim().toLowerCase();
      if (slug) keywordSlugs.push(slug);
    } else if (setPref) {
      const code = tok.slice(setPref.length).trim().toLowerCase();
      if (code) setCodes.push(code);
    } else {
      textParts.push(tok);
    }
  }
  return {
    tagSlugs,
    typeTerms,
    keywordSlugs,
    setCodes,
    oracleTerms,
    mvTerms,
    identityTerms,
    text: textParts.join(' ').toLowerCase(),
  };
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

/** Append `set:<code>` to a query, replacing a trailing partial set token if present. */
export function appendSet(query: string, code: string): string {
  return appendToken(query, code, 'set:', setPrefixOf);
}
