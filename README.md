# MTG Collection Browser

A single-page app to browse the Magic: The Gathering cards you own and filter them by
Scryfall **oracle tags** (e.g. `otag:reanimate`) and by **color** — so you can quickly check
whether your collection has enough cards for a deck archetype you want to build.

Built with **Vite + React + TypeScript + Tailwind**. All filtering runs client-side over a
small, pre-built dataset of just your collection (~6k cards) — no backend.

![screenshot](docs/screenshot.png)

## How it works

Three source files are joined once, at build time, into two small JSON files the app ships:

| Source (in `data/`, gitignored) | Role |
| --- | --- |
| `ManaBox_Collection*.csv` | Your collection (ManaBox export). `Scryfall ID` + `Quantity` + `Foil`. |
| `default-cards*.json` | Every Scryfall printing. Joined to the collection by printing `id` (**100% match**), giving each owned card its `oracle_id`, image, colors, type, etc. |
| `oracle-tags*.json` | Scryfall oracle tags. `taggings[].oracle_id` links tags to cards. |

The join chain is: **ManaBox `Scryfall ID` → `default-cards.id` → `oracle_id` → oracle tags.**
Output lands in `public/data/cards.json` (~3.5 MB) and `public/data/tags.json` (~0.3 MB), which
are committed and served statically.

> The 547 MB `default-cards` file is **streamed** during preprocessing, so memory stays low.

## Quick start

```bash
npm install

# 1. Put the three source files in ./data/  (filenames may carry timestamps)
#    - ManaBox_Collection*.csv
#    - default-cards*.json     (Scryfall "Default Cards" bulk data)
#    - oracle-tags*.json       (Scryfall oracle tags export)

# 2. Build the static dataset (re-run whenever the sources change)
npm run preprocess
#    -> writes public/data/cards.json + tags.json, asserts reanimate=3

# 3. Run the app
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build` (typecheck + production build to `dist/`), `npm run preview`,
`npm run typecheck`, `npm run verify` (sanity-checks the search/filter logic against the data).

## Using the app

- **Search** by card name, or type `otag:<slug>` (also `tag:` / `t:`) for an oracle tag.
  Autocomplete suggests tags **present in your collection**, with owned counts and descriptions.
- Multiple `otag:` filters are **AND**-ed. Click a tag chip in a card's detail view to add it.
- **Color filter** (W/U/B/R/G/C):
  - *Identity* (default, EDH-relevant) vs *Colors* axis.
  - *Subset* (default): card's colors ⊆ selected — "playable in a deck of these colors".
  - *Any*: card shares at least one selected color.
- Click any card for a detail modal (flip button for double-faced cards, full tag list).

## Deployment

The app is a static bundle. Commit `public/data/*.json` (the raw `data/` files are gitignored
and not present in CI).

- **Vercel / Netlify**: framework = Vite, build = `npm run build`, output = `dist`. `base` is `/`.
- **GitHub Pages**: a workflow at `.github/workflows/deploy.yml` builds with
  `DEPLOY_TARGET=gh-pages` (sets Vite `base` to `/mtg-deck-creator/`) and publishes `dist/`.
  Enable Pages → Source: "GitHub Actions". For a different repo name, update `base` in
  `vite.config.ts`. Build locally with `npm run build:gh`.

## Notes & edge cases

- Card images load from Scryfall's CDN, so the app needs internet at runtime; broken images
  fall back to a name placeholder.
- Double-faced cards use the front-face image (back available via the modal flip button).
- Duplicate collection rows (same printing across binders / foil+nonfoil) are merged: quantity
  summed, `foil` true if any copy is foil.
- ~0.5% of owned cards have no oracle tags; they still appear in name/color searches.

## Roadmap

- Synergy/recommendation engine: analyze the collection (tag co-occurrence across owned cards)
  to suggest archetypes and good card pairings you already own. The tag graph
  (`parent_ids`/`child_ids` in the oracle-tags source) is available to power this.
