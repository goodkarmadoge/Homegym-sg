// Keeps the quiz's photography in step with HomeGym's Instagram feed.
//
//   npm run sync:images            refresh what is provable, report the rest
//   npm run sync:images -- --check report only, write nothing
//
// WHY THIS EXISTS.
//   sync-sheet.mjs keeps the DATA current, but every photograph in the quiz is
//   a URL pinned by hand in bundles.js, and the feed those URLs come from
//   rotates. Two bundle heroes had already dropped out of it by 11 Sep: the
//   files still returned 200, so nothing broke visibly, but no caption proved
//   what they showed any more. Left alone, the imagery drifts away from the
//   feed it was drawn from and nobody notices until a customer does.
//
// WHAT IT WILL AND WILL NOT DO ON ITS OWN.
//   A caption proves WHICH MACHINE is in the photo. It does not prove the photo
//   is a room rather than a studio repost, and the quiz captions an Instagram
//   hero as "A real install". So:
//
//     auto, because the result is strictly better than what it replaces
//       - a hero that 404s, or is no longer in the feed, is replaced by the
//         newest post whose caption names that bundle's own machine
//       - a rooms tile that 404s is dropped
//
//     reported, because it needs an eye
//       - a bundle on a studio shot when the feed now has a post of its machine
//       - new posts that could join the rooms strip
//
//   An auto-picked hero is marked heroVerified: false and captioned "From our
//   Instagram", which is true of any post. Only a human who has looked at it
//   promotes it to "A real install, from our Instagram". That distinction is
//   the whole reason this can run unattended.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, BUNDLE_COPY, ROOMS } from '../src/quiz/bundles.js';
import { SHEET_BUNDLES } from '../src/quiz/sheet-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'src/quiz/bundles.js');
const FEED = 'https://homegym.sg/instagram?plnkgd=1';
const CHECK_ONLY = process.argv.includes('--check');

/* Which captions identify which machine. Kept in step with check-heroes.mjs by
   hand; both files want the same knowledge and neither should import the
   other's reporting. The exclusions matter as much as the inclusions: the
   feed's "Infinity smith machine" is a four-post cage with no weight stacks,
   not the dual-stack all-in-one, so infinity-aio deliberately does not match
   on the word smith. */
const SIGNATURE = {
  'tinytitan':         [/tinytitan/i, /tiny titan/i],
  'bodyx-cube':        [/bodyx\s*cube/i, /cube smith/i],
  'titan-x20':         [/titan\s*x20/i],
  'bf900-pro':         [/bf\s*900/i],
  'xpress-pro':        [/xpress\s*pro/i, /vigor xpress/i],
  'infinity-halfrack': [/infinity.*half\s*rack/i, /half\s*rack.*infinity/i,
                        /infinity dual cable/i, /infinity functional trainer/i],
  'infinity-aio':      [/infinity.*all\s*in\s*1/i, /infinity.*31\s*in/i,
                        /infinity.*3\s*in\s*1/i, /infinity.*3in1/i],
  'aeke-s1-pro':       [/aeke/i],
  'im2000':            [/im\s*2000/i, /ironmaster/i],
  'folding-rack':      [/folding power rack/i, /vigor folding/i]
};

/* Photographs confirmed by eye against the catalogue shot, for posts that have
   left the feed. Without this the sync would keep replacing a perfectly good
   photo every time it ran. Mirrors the list in check-heroes.mjs. */
const EYE_VERIFIED = new Set([
  "https://d101vd00cis701.cloudfront.net/ox_instagram/733309572_18602787556005504_5869793302032627450_n.jpg",
  'https://d101vd00cis701.cloudfront.net/ox_instagram/627627547_18407289532131119_4104113445378468616_n.jpg'
]);

/* ── Feed ─────────────────────────────────────────────────────────────────── */

async function loadFeed() {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`the Instagram feed returned HTTP ${res.status}`);
  const html = await res.text();

  const posts = [];
  const seen = new Set();
  for (const m of html.matchAll(/"media_url":"(https:[^"]+?)"/g)) {
    let depth = 0, start = -1;
    for (let i = m.index; i >= 0; i--) {
      if (html[i] === '}') depth++;
      else if (html[i] === '{') { if (depth === 0) { start = i; break; } depth--; }
    }
    if (start < 0) continue;
    let end = -1; depth = 0;
    for (let i = start; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) continue;
    try {
      const o = JSON.parse(html.slice(start, end));
      if (!o.media_url || seen.has(o.media_url)) continue;
      seen.add(o.media_url);
      const full = (o.caption_decoded || o.caption || '').replace(/[^\x20-\x7E\n]/g, '');
      posts.push({
        url: o.media_url,
        full,                                   // matched against in whole
        headline: full.split('\n')[0].trim(),   // shown in the report
        date: o.timestamp || null
      });
    } catch { /* not a clean post object */ }
  }
  if (!posts.length) throw new Error('the feed parsed to zero posts, refusing to touch anything');
  return posts;
}

/** Feed order is newest first, so the first match is the most recent. */
const candidatesFor = (posts, anchorId) => {
  const sigs = SIGNATURE[anchorId] || [];
  return sigs.length ? posts.filter((p) => sigs.some((re) => re.test(p.full))) : [];
};

/** Does the file still exist? A pinned URL can 404 long after it was chosen. */
async function resolves(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return r.ok && (r.headers.get('content-type') || '').startsWith('image/');
  } catch {
    return false;
  }
}

/* ── Decide ───────────────────────────────────────────────────────────────── */

const posts = await loadFeed();
const byUrl = new Map(posts.map((p) => [p.url, p]));
console.log(`feed has ${posts.length} posts\n`);

const anchorOf = (id) => {
  const s = SHEET_BUNDLES.find((b) => b.id === Number(id));
  if (!s) return null;
  const url = s.productUrls[0];
  const entry = Object.entries(PRODUCTS).find(([, p]) => p.url === url);
  return entry ? entry[0] : null;
};

const edits = [];     // { id, field, from, to }
const actions = [];   // human-readable log
const attention = []; // needs an eye

for (const [id, copy] of Object.entries(BUNDLE_COPY)) {
  const anchorId = anchorOf(id);
  if (!anchorId) continue;
  const anchor = PRODUCTS[anchorId];
  const cands = candidatesFor(posts, anchorId);
  const hero = copy.hero;
  const isInstagram = copy.heroSource === 'instagram';

  const live = await resolves(hero);
  const inFeed = byUrl.has(hero);
  const proven = inFeed || EYE_VERIFIED.has(hero);

  if (!isInstagram) {
    // On a studio shot. An upgrade is a judgement call, so it is reported.
    if (cands.length) {
      attention.push(
        `bundle ${id}, ${copy.name}: on a studio shot, but the feed now has ` +
        `${cands.length} post(s) of the ${anchor.name}. Newest: ${cands[0].date}, ` +
        `"${cands[0].headline.slice(0, 50)}". Look at it, then swap it in and set ` +
        `heroVerified true if it is a real room.`
      );
    }
    continue;
  }

  if (live && proven) continue;   // nothing to do, and that is the usual case

  const why = !live ? 'the file no longer loads' : 'the post has left the feed';
  if (cands.length) {
    edits.push({ id, field: 'hero', from: hero, to: cands[0].url });
    edits.push({ id, field: 'heroVerified', from: null, to: false });
    actions.push(
      `bundle ${id}, ${copy.name}: ${why}. Replaced with the newest post of the ` +
      `${anchor.name} (${cands[0].date}). Captioned "From our Instagram" until ` +
      `someone confirms it is a room.`
    );
  } else {
    attention.push(
      `bundle ${id}, ${copy.name}: ${why}, and the feed has no post of the ` +
      `${anchor.name} to replace it with. ${live ? 'It still displays, so this is not urgent.' : 'IT IS SHOWING A BROKEN IMAGE.'}`
    );
  }
}

/* Rooms strip: drop anything that has stopped loading. Adding new tiles is not
   automated, because a caption cannot tell a finished room from a dumbbell
   rack, and that distinction is the whole point of the section. */
const deadTiles = [];
for (const r of ROOMS) {
  if (!(await resolves(r.image))) deadTiles.push(r);
}

const freshRoomCandidates = posts
  .filter((p) => !ROOMS.some((r) => r.image === p.url))
  .filter((p) => Object.keys(SIGNATURE).some((k) => candidatesFor([p], k).length))
  .slice(0, 5);

/* ── Report ───────────────────────────────────────────────────────────────── */

if (actions.length) {
  console.log('CHANGED');
  for (const a of actions) console.log('  ' + a);
  console.log('');
}
if (deadTiles.length) {
  console.log(`ROOMS: ${deadTiles.length} tile(s) no longer load and will be dropped`);
  for (const t of deadTiles) console.log(`  ${t.title}`);
  console.log('');
}
if (attention.length) {
  console.log('NEEDS A HUMAN');
  for (const a of attention) console.log('  ' + a);
  console.log('');
}
if (freshRoomCandidates.length) {
  console.log(`ROOMS: ${freshRoomCandidates.length} newer post(s) could join the strip, if they show a room:`);
  for (const p of freshRoomCandidates) console.log(`  ${p.date}  ${p.headline.slice(0, 58)}`);
  console.log('');
}

if (!edits.length && !deadTiles.length) {
  console.log('Every photograph still loads and still matches its bundle. Nothing to change.');
  process.exit(0);
}

if (CHECK_ONLY) {
  console.log(`--check: ${edits.length / 2} hero(es) and ${deadTiles.length} tile(s) would change. Nothing written.`);
  process.exit(0);
}

/* ── Write ────────────────────────────────────────────────────────────────── */

let src = readFileSync(TARGET, 'utf8');

for (const e of edits) {
  if (e.field === 'hero') {
    if (!src.includes(e.from)) throw new Error(`hero URL for bundle ${e.id} not found in bundles.js`);
    src = src.split(e.from).join(e.to);
  }
}

// heroVerified sits next to heroSource, added only where a hero was swapped.
for (const e of edits.filter((x) => x.field === 'heroVerified')) {
  const copy = BUNDLE_COPY[e.id];
  const swapped = edits.find((x) => x.id === e.id && x.field === 'hero');
  const marker = `    hero: "${swapped.to}",\n    heroSource: "instagram"`;
  if (!src.includes(marker)) throw new Error(`could not mark bundle ${e.id} unverified`);
  src = src.replace(marker, `${marker},\n    heroVerified: false`);
}

for (const t of deadTiles) {
  const block = src.match(new RegExp(`\\n  \\{\\n    image: "${t.image.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}"[\\s\\S]*?\\n  \\},?`));
  if (block) src = src.replace(block[0], '');
}

writeFileSync(TARGET, src);
console.log(`wrote src/quiz/bundles.js: ${edits.length / 2} hero(es) refreshed, ${deadTiles.length} dead tile(s) dropped`);
console.log('Next: npm run check');
