// Reports the catalogue entries a new sheet row needs, by reading the product
// pages it points at.
//
// WHY THIS EXISTS. Adding a bundle is meant to be a spreadsheet edit. But the
// sheet carries only PRODUCT URLS: no price, no dimensions, no imagery, by
// design, because those live on homegym.sg and change there. So a sheet row
// naming a machine the catalogue has never seen fails `npm run check` with
// "no product in the catalogue matches ...", and the fix is a hand-written
// PRODUCTS entry. That happened for bundles 11-16 and the hand-writing means
// opening seven product pages and copying five fields out of each.
//
// This does the opening and copying. It does NOT write anything: it prints,
// and a person pastes.
//
// WHAT IT WILL NOT DECIDE FOR YOU, and this is the whole reason it reports
// rather than commits. `footprint` is a HARD FILTER: a bundle whose footprint
// does not fit the room a visitor typed is removed before scoring, and the
// result page then prints "Fits 2.0 x 3.0 m" as a promise. Product pages state
// dimensions in an order that varies by listing -- some are W x D x H, some
// D x W x H, some quote a folded size or a safety-arm depth that is the real
// number in use. Picking the wrong pair tells a customer a machine fits a room
// it does not. So every candidate dimension line found is printed verbatim,
// and footprint is left as a TODO for a human to fill from them.
//
// Run it where homegym.sg is reachable:
//
//   npm run sync && node scripts/new-products.mjs
//
// The sync first, because the missing URLs come from the sheet as it stands
// now, not from the last committed copy.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHEET_BUNDLES } from '../src/quiz/sheet-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The catalogue is read as TEXT, not imported, and that is deliberate.
// src/quiz/bundles.js composes the bundles at module scope and THROWS when the
// data does not compose -- which is exactly the situation this script exists
// for. Importing it would make the tool unusable precisely when it is needed.
const catalogue = new Set(
  [...readFileSync(join(ROOT, 'src/quiz/bundles.js'), 'utf8')
    .matchAll(/^\s*url:\s*'([^']+)'/gm)].map((m) => m[1])
);

const missing = new Map();
for (const b of SHEET_BUNDLES) {
  for (const url of b.productUrls) {
    if (catalogue.has(url)) continue;
    if (!missing.has(url)) missing.set(url, []);
    missing.get(url).push(b.id);
  }
}

if (!missing.size) {
  console.log(`every product in the sheet is already in the catalogue (${catalogue.size} entries, ${SHEET_BUNDLES.length} bundles)`);
  process.exit(0);
}

console.log(`${missing.size} product(s) in the sheet are not in the catalogue.\n`);

/** First capture of the first pattern that matches, or null. */
const first = (html, patterns) => {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1].trim();
  }
  return null;
};

/** Every distinct line mentioning cm alongside a dimension separator. */
function dimensionLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  const out = new Set();
  for (const line of text.split('\n')) {
    const s = line.trim().replace(/\s+/g, ' ');
    if (s.length < 6 || s.length > 200) continue;
    if (!/\d/.test(s)) continue;
    if (!/\bcm\b|\bmm\b|\bm\b/i.test(s)) continue;
    if (!/[x×*]/i.test(s)) continue;
    out.add(s);
  }
  return [...out].slice(0, 6);
}

const money = (s) => (s == null ? null : Number(String(s).replace(/[^0-9.]/g, '')) || null);

for (const [url, ids] of missing) {
  const key = url.split('/').pop().replace(/\.html$/, '');
  console.log('='.repeat(78));
  console.log(`bundle ${ids.join(', ')}  ${key}`);
  console.log(url);

  let html;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'homegym-quiz-catalogue/1.0' } });
    if (!res.ok) { console.log(`  FETCH FAILED: HTTP ${res.status}. Fill this one in by hand.\n`); continue; }
    html = await res.text();
  } catch (err) {
    console.log(`  FETCH FAILED: ${err.message}. Fill this one in by hand.\n`); continue;
  }

  const name = first(html, [
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
    /<span[^>]+itemprop="name"[^>]*>([^<]+)</i,
    /<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>\s*(?:<span[^>]*>)?([^<]+)/i,
    /<title>([^<]+)<\/title>/i
  ]);
  const price = money(first(html, [
    /<meta[^>]+itemprop="price"[^>]+content="([^"]+)"/i,
    /data-price-type="finalPrice"[^>]*data-price-amount="([^"]+)"/i,
    /data-price-amount="([^"]+)"/i,
    /"final_price"\s*:\s*"?([0-9.]+)/i
  ]));
  const was = money(first(html, [
    /data-price-type="oldPrice"[^>]*data-price-amount="([^"]+)"/i,
    /"oldPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"?([0-9.]+)/i,
    /"regular_price"\s*:\s*"?([0-9.]+)/i
  ]));
  const image = first(html, [
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
    /"(https:\/\/[^"]*cloudfront\.net\/catalog\/product\/cache\/[^"]+\.(?:jpg|jpeg|png|webp))"/i
  ]);

  console.log('\n  dimension lines found on the page, pick the pair that is W and D in use:');
  const dims = dimensionLines(html);
  if (!dims.length) console.log('    (none found -- read the page yourself)');
  for (const d of dims) console.log(`    | ${d}`);

  console.log('\n  paste into PRODUCTS in src/quiz/bundles.js:\n');
  console.log(`  '${key}': {`);
  console.log(`    // Published machine footprint, metres, from the product page:`);
  console.log(`    //   ${dims[0] || 'TODO read the dimensions off the page'}`);
  console.log(`    footprint: { w: 0, d: 0 },   // TODO from the line above, in metres`);
  console.log(`    name: ${JSON.stringify(name || 'TODO')},`);
  console.log(`    price: ${price ?? 'null /* TODO */'},`);
  if (was) console.log(`    was: ${was},`);
  console.log(`    url: '${url}',`);
  console.log(`    image: ${image ? `'${image}'` : "'TODO'"}`);
  console.log(`  },`);
  console.log();
}

console.log('='.repeat(78));
console.log('Nothing was written. Paste the entries above into PRODUCTS, fill every');
console.log('TODO, then run: npm run check && npm run check:fit');
