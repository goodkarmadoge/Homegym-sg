// Checks that each bundle's install photograph actually shows that bundle's
// own machine.
//
//   npm run check:heroes
//
// WHY THIS EXISTS.
//   The photo sits next to the product list as evidence: "here is the machine
//   you are being sold, in a room". If it shows a different machine, that is
//   not a cosmetic slip, it is a false claim about the thing being bought. It
//   is also easy to get wrong: an earlier pass on this project picked a
//   treadmill for a Smith machine off thumbnails too small to read.
//
// HOW IT DECIDES.
//   Every Instagram post on homegym.sg carries a caption naming the machine,
//   written by HomeGym. That caption is the evidence. If a bundle's photo is a
//   post whose caption names the bundle's anchor machine, the photo is proved
//   correct without anyone eyeballing it. If the caption names something else,
//   it is proved WRONG. If the photo has dropped out of the feed, the proof is
//   gone even though the file still loads, and it needs a human to look again.
//
// WHY IT IS NOT PART OF `npm run check`.
//   Same as check-images and check-fit: it reads a third party's live feed,
//   which rotates on its own. A HomeGym post going stale should not be able to
//   fail a deploy. Exits 0 always; it is a report.
import { BUNDLES, PRODUCTS } from '../src/quiz/bundles.js';

const FEED = 'https://homegym.sg/instagram?plnkgd=1';

/**
 * Caption patterns that identify each machine.
 *
 * Written out per product rather than matched fuzzily against the product name.
 * "Infinity All-in-1 Trainer" and "Infinity smith machine" share three words
 * and are different machines, which a loose match would happily conflate. Every
 * pattern here was checked against a photo of the machine before being added.
 */
const SIGNATURE = {
  'tinytitan':         [/tinytitan/i, /tiny titan/i],
  'bodyx-cube':        [/bodyx\s*cube/i, /cube smith/i],
  'titan-x20':         [/titan\s*x20/i],
  'bf900-pro':         [/bf\s*900/i],
  'xpress-pro':        [/xpress\s*pro/i, /vigor xpress/i],
  'infinity-halfrack': [/infinity.*half\s*rack/i, /half\s*rack.*infinity/i,
                        /infinity dual cable/i, /infinity functional trainer/i],
  // Deliberately NOT /infinity smith/: the feed's "Infinity smith machine" is a
  // four-post cage with a barbell and no weight stacks, not this dual-stack
  // all-in-one. Compared side by side against both Infinity catalogue photos on
  // 11 Sep 2026.
  //
  // "3in1" is what the sheet calls this machine internally, so a post using
  // that shorthand is caught too. The whole feed was searched on 11 Sep 2026
  // and none of these matched: six Infinity posts are the Half Rack, which is
  // a different bundle's machine, and the seventh is the cage above.
  'infinity-aio':      [/infinity.*all\s*in\s*1/i, /infinity.*31\s*in/i,
                        /infinity.*3\s*in\s*1/i, /infinity.*3in1/i],
  'aeke-s1-pro':       [/aeke/i],
  'im2000':            [/im\s*2000/i, /ironmaster/i],
  'folding-rack':      [/folding power rack/i, /vigor folding/i]
};

/**
 * Photos confirmed by eye against the catalogue image, for posts that have
 * since dropped out of the feed. Without this the check can only say "no longer
 * provable" forever, and a correct photo would keep being reported as a
 * problem. Only add a URL here after actually looking at it beside the
 * product shot.
 */
const EYE_VERIFIED = {
  'https://d101vd00cis701.cloudfront.net/ox_instagram/627627547_18407289532131119_4104113445378468616_n.jpg':
    'bundle 9, Ironmaster IM2000. Checked against the catalogue photo on 11 Sep 2026: ' +
    'same uprights, same chrome guide rods, same bench. The post has left the feed.'
};

async function loadFeed() {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`feed returned HTTP ${res.status}`);
  const html = await res.text();

  const posts = new Map();
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
      if (!o.media_url || posts.has(o.media_url)) continue;
      const full = (o.caption_decoded || o.caption || '').replace(/[^\x20-\x7E\n]/g, '');
      posts.set(o.media_url, {
        // Headline only, for the report table. Short enough to read at a glance.
        caption: full.split('\n')[0].trim(),
        // THE WHOLE CAPTION IS WHAT GETS MATCHED, not just the headline.
        // Two AEKE posts open with "One machine. Endless possibilities." and
        // name the machine three lines further down. Matching the headline
        // alone reported them as not existing, which left the AEKE bundle on a
        // studio shot while a real install of it sat in the feed.
        full,
        date: o.timestamp || null
      });
    } catch { /* not a clean post object */ }
  }
  return posts;
}

const posts = await loadFeed();
console.log(`feed has ${posts.size} posts\n`);

const rows = [];

for (const b of BUNDLES) {
  const anchorId = b.products[0];
  const anchor = PRODUCTS[anchorId];
  const sigs = SIGNATURE[anchorId] || [];
  const post = posts.get(b.hero);
  const available = [...posts.entries()]
    .filter(([, p]) => sigs.some((re) => re.test(p.full)))
    .map(([url, p]) => ({ url, ...p }));

  let status, detail;

  if (b.heroSource !== 'instagram') {
    status = available.length ? 'GALLERY*' : 'GALLERY';
    detail = available.length
      ? `studio shot, but the feed now has ${available.length} post(s) of this machine`
      : 'studio shot; the feed has no post of this machine';
  } else if (post) {
    const ok = sigs.some((re) => re.test(post.full));
    status = ok ? 'OK' : 'WRONG';
    detail = `"${post.caption}"`;
  } else if (EYE_VERIFIED[b.hero]) {
    status = 'OK, BY EYE';
    detail = EYE_VERIFIED[b.hero];
  } else {
    status = 'UNPROVEN';
    detail = 'the post has left the feed, so no caption proves what this shows';
  }

  rows.push({ b, anchor, status, detail, available });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('', 12) + pad('#', 4) + pad('bundle', 22) + 'anchor machine');
console.log('-'.repeat(92));
for (const r of rows) {
  console.log(pad(r.status, 12) + pad(r.b.id, 4) + pad(r.b.name.slice(0, 20), 22) + r.anchor.name);
  console.log(' '.repeat(12) + r.detail);
}

const wrong = rows.filter((r) => r.status === 'WRONG');
const unproven = rows.filter((r) => r.status === 'UNPROVEN');
const upgradable = rows.filter((r) => r.status === 'GALLERY*');

console.log('');
if (wrong.length) {
  console.log(`${wrong.length} photo(s) show the WRONG MACHINE. Fix before this ships:`);
  for (const r of wrong) console.log(`  bundle ${r.b.id}: caption says ${r.detail}, anchor is ${r.anchor.name}`);
  console.log('');
}
if (unproven.length) {
  console.log(`${unproven.length} photo(s) can no longer be proved from the feed.`);
  console.log('  They may still be correct. Open each beside its catalogue photo, and if it');
  console.log('  matches, add the URL to EYE_VERIFIED at the top of this file with the date.');
  for (const r of unproven) console.log(`  bundle ${r.b.id}, ${r.b.name}: ${r.b.hero}`);
  console.log('');
}
if (upgradable.length) {
  console.log(`${upgradable.length} bundle(s) use a studio shot but the feed now has a real install:`);
  for (const r of upgradable) {
    console.log(`  bundle ${r.b.id}, ${r.b.name}:`);
    for (const c of r.available.slice(0, 3)) console.log(`      ${c.date}  ${c.caption.slice(0, 60)}`);
  }
  console.log('  Check each one shows the right machine before swapping it in.');
  console.log('');
}

const proved = rows.filter((r) => r.status.startsWith('OK')).length;
const gallery = rows.filter((r) => r.status.startsWith('GALLERY')).length;
console.log(`${proved} of ${rows.length} show a verified install of the bundle's own machine.`);
console.log(`${gallery} use the catalogue photo, captioned as the machine rather than as a real room.`);
