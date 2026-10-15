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
// Shared with sync-prices.mjs, which reads the same pages nightly. One copy of
// the patterns, so the nightly job can never extract a different number from
// the same markup than the tool that first set it.
import { dimensionLines, fetchProductPage, parseProductPage } from './lib/product-page.mjs';

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


for (const [url, ids] of missing) {
  const key = url.split('/').pop().replace(/\.html$/, '');
  console.log('='.repeat(78));
  console.log(`bundle ${ids.join(', ')}  ${key}`);
  console.log(url);

  const page = await fetchProductPage(url);
  if (page.error) {
    console.log(`  FETCH FAILED: ${page.error}. Fill this one in by hand.\n`);
    continue;
  }
  const html = page.html;

  const { name, price, was, wasRaw, wasRejected, image } = parseProductPage(html);

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
