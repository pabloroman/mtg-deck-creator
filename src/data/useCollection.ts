import { useEffect, useState } from 'react';
import type { CollectionData, OwnedCard, TagIndexEntry } from '../types';

interface State {
  data: CollectionData | null;
  loading: boolean;
  error: string | null;
}

/** Fetches the preprocessed cards.json + tags.json once on mount. */
export function useCollection(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    const base = import.meta.env.BASE_URL; // '/' locally, '/mtg-deck-creator/' on Pages
    const get = async (file: string) => {
      const res = await fetch(`${base}data/${file}`);
      if (!res.ok) throw new Error(`Failed to load ${file} (HTTP ${res.status})`);
      return res.json();
    };
    Promise.all([get('cards.json'), get('tags.json')])
      .then(([cards, tags]: [OwnedCard[], TagIndexEntry[]]) =>
        setState({ data: { cards, tags }, loading: false, error: null }),
      )
      .catch((err: unknown) =>
        setState({ data: null, loading: false, error: err instanceof Error ? err.message : String(err) }),
      );
  }, []);

  return state;
}
