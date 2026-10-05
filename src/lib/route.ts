import { useMemo, useSyncExternalStore } from 'react';

export const VIEWS = ['browse', 'decks', 'sets', 'commander', 'build'] as const;
export type View = (typeof VIEWS)[number];

/** Where the app is, as stored in the URL hash: `#/<view>[/<id>][?card=<id> | ?group=<id>]`. */
export interface Route {
  view: View;
  id: string | null; // archetype id (decks), commander card key (commander) or deck id (build)
  card: string | null; // printing id of the card open in the modal
  grouped: boolean; // the open card stands for all its printings (owned count = total)
}

// A hand-edited URL can hold a malformed escape; fall back to the raw text.
const decode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [v, id] = path.split('/');
  const q = new URLSearchParams(query);
  return {
    view: VIEWS.find((x) => x === v) ?? 'browse',
    id: id ? decode(id) : null,
    card: q.get('group') ?? q.get('card'),
    grouped: q.has('group'),
  };
}

export function formatRoute(r: Route): string {
  const path = `#/${r.view}${r.id ? `/${encodeURIComponent(r.id)}` : ''}`;
  return r.card ? `${path}?${r.grouped ? 'group' : 'card'}=${encodeURIComponent(r.card)}` : path;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** The current route plus a navigate function; each navigation is a browser history entry. */
export function useRoute(): [Route, (patch: Partial<Route>) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const route = useMemo(() => parseRoute(hash), [hash]);
  return [route, go];
}

function go(patch: Partial<Route>) {
  window.location.hash = formatRoute({ ...parseRoute(window.location.hash), ...patch });
}
