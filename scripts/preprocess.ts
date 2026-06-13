/**
 * Build-time ETL: join the ManaBox collection CSV + Scryfall default-cards (every
 * printing) + Scryfall oracle-tags into two small static JSON files the SPA ships:
 *
 *   public/data/cards.json  — one entry per owned printing, enriched with tags
 *   public/data/tags.json   — metadata for every tag present in the collection
 *
 * The 547 MB default-cards file is streamed (bounded memory). Run with:  npm run preprocess
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import streamArrayMod from 'stream-json/streamers/StreamArray';
import type { Color, OwnedCard, ResolvedArchetype, TagIndexEntry } from '../src/types';
import { ARCHETYPES } from '../src/lib/ontology';

// stream-* packages are CommonJS; under Node ESM use default import + destructure.
const { chain } = streamChain as unknown as { chain: (fns: unknown[]) => NodeJS.ReadableStream };
const { parser } = streamJson as unknown as { parser: () => unknown };
const { streamArray } = streamArrayMod as unknown as { streamArray: () => unknown };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'public', 'data');

/** Find the (timestamped) source file matching a prefix/suffix in data/. */
function findFile(prefix: string, ext: string): string {
  const matches = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .sort();
  if (matches.length === 0) {
    throw new Error(`No file matching ${prefix}*${ext} in ${DATA_DIR}`);
  }
  // newest last after sort (timestamps are zero-padded)
  return path.join(DATA_DIR, matches[matches.length - 1]);
}

// ---- Scryfall raw shapes (only the fields we use) ----
interface ScryImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
}
interface ScryCardFace {
  image_uris?: ScryImageUris;
  mana_cost?: string;
}
interface ScryCard {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  colors?: string[];
  color_identity?: string[];
  rarity?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  layout?: string;
  image_uris?: ScryImageUris;
  card_faces?: ScryCardFace[];
}
interface OracleTag {
  id?: string;
  slug: string;
  label: string;
  description?: string | null;
  aliases?: string[];
  child_ids?: string[]; // DAG edges (reference other tags' id)
  parent_ids?: string[];
  taggings?: { oracle_id: string; weight?: string }[];
}

async function main() {
  const csvPath = findFile('ManaBox', '.csv');
  const tagsPath = findFile('oracle-tags', '.json');
  const cardsPath = findFile('default-cards', '.json');
  console.log('Sources:');
  console.log('  collection :', path.basename(csvPath));
  console.log('  cards      :', path.basename(cardsPath));
  console.log('  tags       :', path.basename(tagsPath));

  // 1) Tags: oracle_id -> Set<slug>, plus slug -> metadata
  const rawTags: OracleTag[] = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
  const oidToSlugs = new Map<string, Set<string>>();
  const tagMeta = new Map<string, OracleTag>();
  const byId = new Map<string, OracleTag>(); // for DAG traversal (child_ids -> id)
  for (const t of rawTags) {
    if (t.id) byId.set(t.id, t);
    if (!t.slug) continue;
    tagMeta.set(t.slug, t);
    for (const tg of t.taggings ?? []) {
      let set = oidToSlugs.get(tg.oracle_id);
      if (!set) {
        set = new Set();
        oidToSlugs.set(tg.oracle_id, set);
      }
      set.add(t.slug);
    }
  }
  console.log(`Loaded ${rawTags.length} tags.`);

  // 2) Collection CSV: scryfall printing id -> { quantity, foil }
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const owned = new Map<string, { quantity: number; foil: boolean }>();
  for (const row of parsed.data) {
    const id = (row['Scryfall ID'] ?? '').trim();
    if (!id) continue;
    const qty = parseInt((row['Quantity'] ?? '1').trim(), 10) || 0;
    const foil = (row['Foil'] ?? 'normal').trim().toLowerCase() !== 'normal';
    const prev = owned.get(id);
    if (prev) {
      prev.quantity += qty;
      prev.foil = prev.foil || foil;
    } else {
      owned.set(id, { quantity: qty, foil });
    }
  }
  console.log(`Collection: ${parsed.data.length} rows, ${owned.size} unique printings.`);

  // 3) Stream default-cards, keep only owned printings
  const cards: OwnedCard[] = [];
  const seen = new Set<string>();
  let imageless = 0;
  const pipeline = chain([fs.createReadStream(cardsPath), parser(), streamArray()]);
  for await (const { value } of pipeline as AsyncIterable<{ value: ScryCard }>) {
    const c = value;
    const own = owned.get(c.id);
    if (!own || seen.has(c.id)) continue;
    seen.add(c.id);

    const image = c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? '';
    const imageBack = c.card_faces?.[1]?.image_uris?.normal;
    if (!image) imageless++;

    const tags = oidToSlugs.get(c.oracle_id ?? '');
    cards.push({
      id: c.id,
      oracleId: c.oracle_id ?? '',
      name: c.name,
      manaCost: c.mana_cost ?? c.card_faces?.[0]?.mana_cost ?? '',
      cmc: c.cmc ?? 0,
      typeLine: c.type_line ?? '',
      colors: (c.colors ?? []) as Color[],
      colorIdentity: (c.color_identity ?? []) as Color[],
      rarity: c.rarity ?? '',
      set: c.set ?? '',
      setName: c.set_name ?? '',
      collectorNumber: c.collector_number ?? '',
      image,
      ...(imageBack ? { imageBack } : {}),
      layout: c.layout ?? 'normal',
      quantity: own.quantity,
      foil: own.foil,
      tags: tags ? [...tags].sort() : [],
    });
  }
  cards.sort((a, b) => a.name.localeCompare(b.name));

  const missing = [...owned.keys()].filter((id) => !seen.has(id));
  if (missing.length) {
    console.warn(`WARNING: ${missing.length} owned printings not found in default-cards.`);
  }
  if (imageless) console.warn(`WARNING: ${imageless} owned cards have no image.`);

  // 4) Tag index for tags present in the collection (count = distinct owned cards)
  const slugToOids = new Map<string, Set<string>>();
  for (const card of cards) {
    for (const slug of card.tags) {
      let s = slugToOids.get(slug);
      if (!s) {
        s = new Set();
        slugToOids.set(slug, s);
      }
      s.add(card.oracleId);
    }
  }
  const tags: TagIndexEntry[] = [...slugToOids.entries()]
    .map(([slug, oids]) => {
      const meta = tagMeta.get(slug);
      return {
        slug,
        label: meta?.label ?? slug,
        description: meta?.description ?? null,
        aliases: meta?.aliases ?? [],
        count: oids.size,
      };
    })
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

  // 4b) Resolve the synergy ontology through the tag DAG (build-only — the DAG
  //     itself is never shipped). Each archetype role slug is expanded to all its
  //     descendant slugs, then intersected with slugs present in the collection.
  const presentSlugs = new Set(slugToOids.keys());

  /** All descendant slugs of a hub slug (incl. itself), via child_ids. */
  const descendantSlugs = (slug: string): Set<string> | null => {
    const root = tagMeta.get(slug);
    if (!root || !root.id) return null; // not in the taxonomy
    const out = new Set<string>();
    const stack: string[] = [root.id];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = byId.get(id);
      if (!t) continue;
      if (t.slug) out.add(t.slug);
      for (const c of t.child_ids ?? []) stack.push(c);
    }
    return out;
  };

  const resolveRole = (archId: string, role: string, slugs: string[]): string[] => {
    const acc = new Set<string>();
    for (const slug of slugs) {
      const desc = descendantSlugs(slug);
      if (desc === null) {
        console.warn(`  ! [${archId}.${role}] unknown tag '${slug}' (not in taxonomy)`);
        continue;
      }
      let added = 0;
      for (const s of desc) {
        if (presentSlugs.has(s)) {
          acc.add(s);
          added++;
        }
      }
      if (added === 0) console.warn(`  ! [${archId}.${role}] '${slug}' resolves to 0 owned cards`);
    }
    return [...acc].sort();
  };

  /** Distinct owned cards (by oracle_id) matching any of the given slugs. */
  const roleCardCount = (slugs: string[]): number => {
    const oids = new Set<string>();
    for (const s of slugs) for (const oid of slugToOids.get(s) ?? []) oids.add(oid);
    return oids.size;
  };

  const archetypes: ResolvedArchetype[] = ARCHETYPES.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    enablers: resolveRole(a.id, 'enablers', a.enablers),
    payoffs: resolveRole(a.id, 'payoffs', a.payoffs),
  }));

  console.log('\nArchetypes (enabler-cards / payoff-cards):');
  for (const a of archetypes) {
    const e = roleCardCount(a.enablers);
    const p = roleCardCount(a.payoffs);
    console.log(
      `  ${a.name.padEnd(22)} e=${String(e).padStart(4)}  p=${String(p).padStart(4)}` +
        `  (${a.enablers.length}+${a.payoffs.length} slugs)`,
    );
  }

  // 5) Write outputs
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'cards.json'), JSON.stringify(cards));
  fs.writeFileSync(path.join(OUT_DIR, 'tags.json'), JSON.stringify(tags));
  fs.writeFileSync(path.join(OUT_DIR, 'archetypes.json'), JSON.stringify(archetypes));

  const reanimate = cards.filter((c) => c.tags.includes('reanimate')).length;
  console.log(
    `\nWrote ${cards.length} cards, ${tags.length} tags, ${archetypes.length} archetypes. reanimate=${reanimate}`,
  );
  const sizeMb = (p: string) =>
    (fs.statSync(path.join(OUT_DIR, p)).size / 1e6).toFixed(2) + ' MB';
  console.log(
    `  cards.json ${sizeMb('cards.json')} | tags.json ${sizeMb('tags.json')}` +
      ` | archetypes.json ${sizeMb('archetypes.json')}`,
  );

  // Sanity checks — fail loudly on a bad run.
  if (reanimate !== 3) {
    throw new Error(`Sanity check failed: expected reanimate=3, got ${reanimate}`);
  }
  const aristo = archetypes.find((a) => a.id === 'aristocrats');
  if (!aristo || !aristo.enablers.length || !aristo.payoffs.length) {
    throw new Error('Sanity check failed: aristocrats must have ≥1 enabler and ≥1 payoff');
  }
  const life = archetypes.find((a) => a.id === 'lifegain');
  if (!life || roleCardCount(life.enablers) <= roleCardCount(life.payoffs)) {
    throw new Error('Sanity check failed: lifegain should be enabler-heavy (lopsided demo)');
  }
  console.log('Sanity checks passed (reanimate=3; aristocrats two-sided; lifegain lopsided).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
