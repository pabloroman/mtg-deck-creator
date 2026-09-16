/**
 * Build-time ETL: join the ManaBox collection CSV + Scryfall default-cards (every
 * printing) + Scryfall oracle-tags into two small static JSON files the SPA ships:
 *
 *   public/data/cards.json  — one entry per owned printing, enriched with tags
 *   public/data/tags.json   — metadata for every tag present in the collection
 *
 * The default-cards bulk file is streamed from its .jsonl.gz (bounded memory).
 * Run with:  npm run preprocess
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import zlib from 'node:zlib';
import Papa from 'papaparse';
import type { Color, OwnedCard, ResolvedArchetype, TagIndexEntry } from '../src/types';
import { ARCHETYPES, creatureSubtypes } from '../src/lib/ontology';

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

/** Stream a gzipped JSONL bulk file, one parsed object per line (bounded memory). */
async function* readJsonl<T>(file: string): AsyncGenerator<T> {
  const input = fs.createReadStream(file).pipe(zlib.createGunzip());
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    if (line) yield JSON.parse(line) as T;
  }
}

// ---- Playability pass (build-only) ----
// A first-pass "pull list" for sorting the physical collection: cards that stand on
// their own and read in one sentence. EDHREC rank is the base signal, but it is a
// Commander popularity metric and is wrong in both directions for this purpose, so
// two corrections ride along. See the tag descriptions below.
const PLAYABLE_RANK = 15_000; // EDHREC rank at or below which a card is "generically played"
const SUBSTRATE_TEXT_MAX = 55; // chars of rules text a simple creature body may carry

/** Evergreen keywords a card can have and still read at a glance. */
const EVERGREEN = new Set([
  'Flying', 'Trample', 'Vigilance', 'Haste', 'First strike', 'Double strike', 'Deathtouch',
  'Lifelink', 'Menace', 'Reach', 'Defender', 'Hexproof', 'Ward', 'Flash', 'Indestructible',
]);

/** Mechanics that cost an explanation or a deck built around them. */
const FRICTION = new Set([
  'Morph', 'Megamorph', 'Manifest', 'Suspend', 'Emerge', 'Delirium', 'Storm', 'Cascade',
  'Madness', 'Dredge', 'Bloodrush', 'Miracle', 'Prowl', 'Evoke', 'Escape', 'Foretell',
  'Disturb', 'Cleave', 'Casualty', 'Bestow', 'Devour', 'Exploit', 'Soulbond', 'Unearth',
  'Embalm', 'Eternalize', 'Spectacle', 'Adapt', 'Mutate', 'Companion', 'Hideaway',
  'Threshold', 'Landfall', 'Metalcraft', 'Ferocious', 'Formidable',
]);

/** Synthetic tags injected into card.tags — not from Scryfall. Kept out of synergy
 *  scoring by isCosmetic() in src/lib/ontology.ts. */
const PLAYABLE_TAGS: OracleTag[] = [
  {
    slug: 'playable',
    label: 'playable',
    description:
      'First-pass pull list: self-contained and readable in one sentence. EDHREC rank ' +
      `\u2264 ${PLAYABLE_RANK}, plus simple creature bodies added back by rule. A starting ` +
      'point to correct, not a verdict.',
  },
  {
    slug: 'playable-substrate',
    label: 'playable-substrate',
    description:
      'On the pull list by the add-back rule rather than by EDHREC: a creature with ' +
      `evergreen keywords only and \u2264 ${SUBSTRATE_TEXT_MAX} characters of rules text. ` +
      'Commander under-plays these; a kids\u2019 deck runs on them.',
  },
  {
    slug: 'playable-friction',
    label: 'playable-friction',
    description:
      'On the pull list but carries a mechanic that costs an explanation or a deck built ' +
      'around it (storm, cascade, evoke\u2026). Check these by eye \u2014 most are build-arounds.',
  },
];

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
  oracle_text?: string;
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
  oracle_text?: string;
  keywords?: string[]; // top-level; covers all faces (e.g. ["Flying","Trample"])
  legalities?: Record<string, string>; // format -> 'legal' | 'not_legal' | 'banned' | 'restricted'
  edhrec_rank?: number; // EDHREC popularity rank (lower = more played); absent if unranked
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
  const tagsPath = findFile('oracle-tags', '.jsonl.gz');
  const cardsPath = findFile('default-cards', '.jsonl.gz');
  console.log('Sources:');
  console.log('  collection :', path.basename(csvPath));
  console.log('  cards      :', path.basename(cardsPath));
  console.log('  tags       :', path.basename(tagsPath));

  // 1) Tags: oracle_id -> Set<slug>, plus slug -> metadata
  const oidToSlugs = new Map<string, Set<string>>();
  const tagMeta = new Map<string, OracleTag>();
  const byId = new Map<string, OracleTag>(); // for DAG traversal (child_ids -> id)
  let tagCount = 0;
  for await (const t of readJsonl<OracleTag>(tagsPath)) {
    tagCount++;
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
  console.log(`Loaded ${tagCount} tags.`);

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
  for await (const c of readJsonl<ScryCard>(cardsPath)) {
    const own = owned.get(c.id);
    if (!own || seen.has(c.id)) continue;
    seen.add(c.id);

    const image = c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? '';
    const imageBack = c.card_faces?.[1]?.image_uris?.normal;
    if (!image) imageless++;

    // Single-faced cards carry oracle_text at the top level; multi-faced cards
    // carry it per face (joined with a // divider, matching the printed card).
    const oracleText =
      c.oracle_text ??
      (c.card_faces?.length
        ? c.card_faces.map((f) => f.oracle_text ?? '').filter(Boolean).join('\n//\n')
        : '');

    const tags = oidToSlugs.get(c.oracle_id ?? '');
    cards.push({
      id: c.id,
      oracleId: c.oracle_id ?? '',
      name: c.name,
      manaCost: c.mana_cost ?? c.card_faces?.[0]?.mana_cost ?? '',
      cmc: c.cmc ?? 0,
      typeLine: c.type_line ?? '',
      oracleText,
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
      keywords: c.keywords ?? [],
      pauperLegal: c.legalities?.pauper === 'legal',
      ...(typeof c.edhrec_rank === 'number' ? { edhrecRank: c.edhrec_rank } : {}),
    });
  }
  cards.sort((a, b) => a.name.localeCompare(b.name));

  const missing = [...owned.keys()].filter((id) => !seen.has(id));
  if (missing.length) {
    console.warn(`WARNING: ${missing.length} owned printings not found in default-cards.`);
  }
  if (imageless) console.warn(`WARNING: ${imageless} owned cards have no image.`);

  // 3b) Playability pass. Classified per oracle_id off the best rank across printings, so
  //     every printing of a card lands in the same bucket (the grid groups printings).
  const bestRank = new Map<string, number>();
  for (const c of cards) {
    const k = c.oracleId || c.id;
    const rank = c.edhrecRank ?? Infinity;
    if (rank < (bestRank.get(k) ?? Infinity)) bestRank.set(k, rank);
  }
  const playableTags = new Map<string, string[]>(); // oracle_id -> synthetic slugs
  for (const c of cards) {
    const k = c.oracleId || c.id;
    if (playableTags.has(k)) continue;
    const core = (bestRank.get(k) ?? Infinity) <= PLAYABLE_RANK;
    const substrate =
      !core &&
      c.typeLine.includes('Creature') &&
      c.keywords.every((kw) => EVERGREEN.has(kw)) &&
      c.oracleText.length <= SUBSTRATE_TEXT_MAX;
    if (!core && !substrate) continue;
    const slugs = ['playable'];
    if (substrate) slugs.push('playable-substrate');
    if (c.keywords.some((kw) => FRICTION.has(kw))) slugs.push('playable-friction');
    playableTags.set(k, slugs);
  }
  for (const c of cards) {
    const extra = playableTags.get(c.oracleId || c.id);
    if (extra) c.tags = [...c.tags, ...extra].sort();
  }
  for (const t of PLAYABLE_TAGS) tagMeta.set(t.slug, t);
  const nSubstrate = [...playableTags.values()].filter((v) => v.includes('playable-substrate')).length;
  const nFriction = [...playableTags.values()].filter((v) => v.includes('playable-friction')).length;
  console.log(
    `Playable: ${playableTags.size} of ${bestRank.size} unique cards ` +
      `(${((playableTags.size / bestRank.size) * 100).toFixed(0)}%)` +
      ` \u2014 ${nSubstrate} substrate add-backs, ${nFriction} flagged for eye-review.`,
  );

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
    ...(a.subtypes?.length ? { subtypes: a.subtypes } : {}),
  }));

  // 4c) Auto-generate typal (tribal) archetypes from the deepest creature subtypes.
  //     There are no per-tribe oracle tags, so members are matched by creature
  //     subtype (client-side, in scoreArchetypes); the payoff is the shared anthem
  //     / changeling pool. Ranked like everything else by min(members, anthems).
  const TRIBE_MIN = 60; // a tribe needs at least this many distinct owned creatures
  const TRIBE_MAX = 12; // cap on how many tribes to surface
  const tribeOids = new Map<string, Set<string>>();
  for (const c of cards) {
    for (const s of creatureSubtypes(c.typeLine)) {
      let set = tribeOids.get(s);
      if (!set) tribeOids.set(s, (set = new Set()));
      set.add(c.oracleId || c.id);
    }
  }
  const anthemPayoffs = resolveRole('typal', 'payoffs', ['anthem', 'keyword-anthem', 'changeling']);
  const IRREGULAR: Record<string, string> = {
    elf: 'Elves',
    dwarf: 'Dwarves',
    wolf: 'Wolves',
    merfolk: 'Merfolk',
    eldrazi: 'Eldrazi',
    fungus: 'Fungi',
  };
  const pluralize = (sub: string): string => {
    if (IRREGULAR[sub]) return IRREGULAR[sub];
    const cap = sub.charAt(0).toUpperCase() + sub.slice(1);
    return /(s|x|z|ch|sh)$/.test(sub) ? `${cap}es` : `${cap}s`;
  };
  const topTribes = [...tribeOids.entries()]
    .map(([s, ids]) => [s, ids.size] as const)
    .filter(([, n]) => n >= TRIBE_MIN)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TRIBE_MAX);
  for (const [sub] of topTribes) {
    const name = pluralize(sub);
    archetypes.push({
      id: `typal-${sub}`,
      name,
      description: `Go wide with ${name} and back the tribe with anthems and lords.`,
      enablers: [],
      payoffs: anthemPayoffs,
      subtypes: [sub],
    });
  }

  console.log('\nArchetypes (enabler-cards / payoff-cards):');
  for (const a of archetypes) {
    const e = a.subtypes?.length
      ? (tribeOids.get(a.subtypes[0])?.size ?? 0) // typal: members by subtype
      : roleCardCount(a.enablers);
    const p = roleCardCount(a.payoffs);
    console.log(
      `  ${a.name.padEnd(22)} e=${String(e).padStart(4)}  p=${String(p).padStart(4)}` +
        `  (${a.enablers.length}+${a.payoffs.length} slugs${a.subtypes?.length ? `, ${a.subtypes.join('/')} tribe` : ''})`,
    );
  }

  // 5) Write outputs
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'cards.json'), JSON.stringify(cards));
  fs.writeFileSync(path.join(OUT_DIR, 'tags.json'), JSON.stringify(tags));
  fs.writeFileSync(path.join(OUT_DIR, 'archetypes.json'), JSON.stringify(archetypes));

  const reanimate = cards.filter((c) => c.tags.includes('reanimate')).length;
  const flying = cards.filter((c) => c.keywords.includes('Flying')).length;
  console.log(
    `\nWrote ${cards.length} cards, ${tags.length} tags, ${archetypes.length} archetypes.` +
      ` reanimate=${reanimate} flying=${flying}`,
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
  if (flying === 0) {
    throw new Error('Sanity check failed: expected at least one card with the Flying keyword');
  }
  const aristo = archetypes.find((a) => a.id === 'aristocrats');
  if (!aristo || !aristo.enablers.length || !aristo.payoffs.length) {
    throw new Error('Sanity check failed: aristocrats must have ≥1 enabler and ≥1 payoff');
  }
  const life = archetypes.find((a) => a.id === 'lifegain');
  if (!life || roleCardCount(life.enablers) <= roleCardCount(life.payoffs)) {
    throw new Error('Sanity check failed: lifegain should be enabler-heavy (lopsided demo)');
  }
  const typal = archetypes.filter((a) => a.subtypes?.length);
  if (typal.length < 5) {
    throw new Error(`Sanity check failed: expected ≥5 typal archetypes, got ${typal.length}`);
  }
  if (playableTags.size < 1000 || playableTags.size > bestRank.size * 0.6) {
    throw new Error(
      `Sanity check failed: playable=${playableTags.size} of ${bestRank.size} unique cards ` +
        'is outside the expected 1000..60% band',
    );
  }
  if (anthemPayoffs.length === 0) {
    throw new Error('Sanity check failed: typal archetypes have no resolved anthem payoffs');
  }
  console.log(
    `Sanity checks passed (reanimate=3; aristocrats two-sided; lifegain lopsided; ${typal.length} tribes).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
