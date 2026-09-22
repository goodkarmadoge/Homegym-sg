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
/* Magento escapes its own product names, so og:title arrives as
   "Vigor&#x20;Titan&#x20;G9". Left alone that string reaches a customer
   verbatim, spaces and all. */
function decode(s) {
  if (s == null) return null;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

const first = (html, patterns) => {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1].trim();
  }
  return null;
};

/**
 * Every dimension-shaped run of numbers on the page, with its surrounding
 * words.
 *
 * The first version of this split the de-tagged page into LINES and kept the
 * ones mentioning cm. It found nothing on any of the eight pages, because
 * Magento puts the spec in a table and each cell is its own element: by the
 * time tags became newlines, "209 x 92 x 225cm" had been cut into three
 * pieces. So this matches the numbers wherever they sit and carries the
 * neighbouring text along, which is what names the axes.
 */
function dimensionLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const flat = decode(text);
  const re = /(\d{1,3}(?:\.\d+)?)\s*[x×*]\s*(\d{1,3}(?:\.\d+)?)(?:\s*[x×*]\s*(\d{1,3}(?:\.\d+)?))?\s*(cm|mm|m\b)/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(flat)) !== null) {
    const from = Math.max(0, m.index - 90);
    const to = Math.min(flat.length, m.index + m[0].length + 90);
    out.add(('...' + flat.slice(from, to) + '...').replace(/\s+/g, ' '));
    if (out.size >= 8) break;
  }
  return [...out];
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

  const name = decode(first(html, [
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
    /<span[^>]+itemprop="name"[^>]*>([^<]+)</i,
    /<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>\s*(?:<span[^>]*>)?([^<]+)/i,
    /<title>([^<]+)<\/title>/i
  ]));
  const price = money(first(html, [
    /<meta[^>]+itemprop="price"[^>]+content="([^"]+)"/i,
    /data-price-type="finalPrice"[^>]*data-price-amount="([^"]+)"/i,
    /data-price-amount="([^"]+)"/i,
    /"final_price"\s*:\s*"?([0-9.]+)/i
  ]));
  // A "was" that is not ABOVE the selling price is a mis-read, not a discount.
  // Both showed up on the real pages: one product reported was === price, and
  // the dumbbell reported 175 against a price of 580, picked up from a related
  // item's markup. Either would have rendered a nonsense strikethrough.
  const wasRaw = money(first(html, [
    /data-price-type="oldPrice"[^>]*data-price-amount="([^"]+)"/i,
    /"oldPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"?([0-9.]+)/i,
    /"regular_price"\s*:\s*"?([0-9.]+)/i
  ]));
  const was = (wasRaw != null && price != null && wasRaw > price) ? wasRaw : null;
  const wasRejected = wasRaw != null && was == null;
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
  else if (wasRejected) console.log(`    // no was-price: the page offered ${wasRaw}, which is not above ${price}`);
  console.log(`    url: '${url}',`);
  console.log(`    image: ${image ? `'${image}'` : "'TODO'"}`);
  console.log(`  },`);
  console.log();
}

console.log('='.repeat(78));
console.log('Nothing was written. Paste the entries above into PRODUCTS, fill every');
console.log('TODO, then run: npm run check && npm run check:fit');
