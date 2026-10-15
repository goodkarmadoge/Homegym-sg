// Keeps the catalogue's prices in step with homegym.sg.
//
//   npm run sync:prices            correct what is provable, report the rest
//   npm run sync:prices -- --check report only, write nothing
//
// WHY THIS EXISTS.
//   README's Known Issue 1, and the header of src/quiz/bundles.js, have said the
//   same thing since 30 Aug 2026: every price in PRODUCTS is a snapshot, several
//   are promotional, they WILL drift, and the durable fix is a nightly job that
//   rewrites them. This is that job. Until it existed, a sale ending at HomeGym
//   meant the quiz quoted a price nobody could buy at, and the only thing that
//   would eventually notice was a customer.
//
//   It matters more here than in most catalogues because A BUNDLE PRICE IS THE
//   SUM OF ITS PRODUCTS, never a typed-in figure (see composeBundles). So one
//   product moving re-prices every bundle containing it, correctly, with no
//   second edit. That is also why a WRONG number here spreads: it would move
//   several bundle totals at once.
//
// WHAT IT WILL AND WILL NOT DO ON ITS OWN.
//   The rule is the same one the photography sync follows: do the thing that is
//   provably right, and report anything that needs a judgement.
//
//     auto
//       - a price that moved, within MAX_MOVE of the committed one
//       - a `was` that appeared, changed, or ended (sale over -> was: null)
//
//     refused, and reported
//       - a page that would not load, or whose price could not be read. The
//         committed price stays. NEVER write a null or a guess into a figure a
//         customer reads.
//       - a move larger than MAX_MOVE. A parse regression looks exactly like a
//         massive discount, and the two cannot be told apart from here, so the
//         safe reading is "this is probably a bug" and a human decides.
//       - everything, if too much of the catalogue fails at once. One dead page
//         is a dead page; eight are a redesign, a WAF, or a block, and in that
//         state the few that did parse are not to be trusted either.
//
// WHAT HAPPENS DOWNSTREAM, WHICH IS THE POINT OF THE ORDERING IN THE WORKFLOW.
//   The nightly job runs `npm run check` before it commits. A price rise can
//   push a bundle past the budget ceilings the matcher uses, and if that made a
//   bundle unreachable the sweep fails, the commit is refused, and the quiz
//   keeps serving the last good data. That is the right failure: a bundle nobody
//   can reach is worse than a price a day stale. It does mean a bad price night
//   also holds back that night's sheet edits, which is a trade worth knowing
//   about rather than discovering.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHEET_BUNDLES } from '../src/quiz/sheet-data.js';
import { fetchProductPage, parseProductPage } from './lib/product-page.mjs';
// The rules live in their own file so they can be unit-tested without fetching
// 23 pages. MAX_MOVE and MAX_FAILED_SHARE are documented there.
import { MAX_FAILED_SHARE, MAX_MOVE, decidePrice, shouldAbort } from './lib/price-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'src/quiz/bundles.js');
const CHECK_ONLY = process.argv.includes('--check');

/* ── Read the catalogue as text ────────────────────────────────────────────── */

// As TEXT, not imported, for the reason new-products.mjs gives: bundles.js
// composes at module scope and throws when the data does not compose. A tool
// that edits the catalogue should not be unusable because the catalogue is
// currently broken. It also means the write below is a surgical edit rather than
// a reprint, which keeps every comment in the file.
const source = readFileSync(TARGET, 'utf8');
const blockStart = source.indexOf('export const PRODUCTS = {');
if (blockStart < 0) throw new Error('could not find PRODUCTS in src/quiz/bundles.js');
const blockEnd = source.indexOf('\n};', blockStart);

/** Every catalogue entry, with the span of its own text so edits stay inside it. */
function readCatalogue() {
  const block = source.slice(blockStart, blockEnd);
  const out = [];
  const re = /^ {2}'([a-z0-9-]+)': \{\n([\s\S]*?)\n {2}\},?$/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    const body = m[2];
    const url = /url: '([^']+)'/.exec(body);
    const price = /^ {4}price: (\d+(?:\.\d+)?),$/m.exec(body);
    const was = /^ {4}was: (\d+(?:\.\d+)?|null),$/m.exec(body);
    if (!url || !price || !was) continue;        // reported below as unreadable
    out.push({
      key: m[1],
      url: url[1],
      price: Number(price[1]),
      was: was[1] === 'null' ? null : Number(was[1]),
      from: blockStart + m.index,
      to: blockStart + m.index + m[0].length
    });
  }
  return out;
}

const catalogue = readCatalogue();
if (!catalogue.length) throw new Error('parsed zero products out of PRODUCTS, refusing to touch anything');
console.log(`catalogue has ${catalogue.length} products\n`);

/* ── Decide ────────────────────────────────────────────────────────────────── */

const changes = [];    // { key, price:{from,to}|null, was:{from,to}|null, entry }
const refused = [];    // human-readable, needs an eye
let failed = 0;        // pages that would not load or would not parse

for (const entry of catalogue) {
  const page = await fetchProductPage(entry.url);
  const parsed = page.error ? { error: page.error } : parseProductPage(page.html);
  const verdict = decidePrice(entry, parsed);

  if (verdict.kind === 'keep') continue;
  if (verdict.kind === 'refuse') {
    if (verdict.counts) failed++;
    refused.push(`${entry.key}: ${verdict.reason}`);
    continue;
  }
  changes.push({ key: entry.key, entry, ...verdict });
}

/* ── Report ────────────────────────────────────────────────────────────────── */

const money = (n) => (n == null ? 'none' : `$${n.toLocaleString('en-SG')}`);

if (changes.length) {
  console.log('CHANGED');
  for (const c of changes) {
    const bits = [];
    if (c.price) bits.push(`price ${money(c.price.from)} -> ${money(c.price.to)}`);
    if (c.was) bits.push(`was ${money(c.was.from)} -> ${money(c.was.to)}`);
    console.log(`  ${c.key}: ${bits.join(', ')}`);
    if (c.wasRejected != null) {
      console.log(`      (the page also offered a was-price of ${c.wasRejected}, not above the selling price, so it was ignored)`);
    }
  }
  console.log('');

  // WHAT THIS DOES TO THE SHELF PRICE. A product delta is not the interesting
  // number; what a customer sees is the bundle total, and one product can move
  // several of them. Printed from the sheet's own membership so it needs no
  // second source of truth.
  const delta = new Map(changes.filter((c) => c.price).map((c) => [c.entry.url, c.price.to - c.price.from]));
  const priced = new Map(catalogue.map((p) => [p.url, p.price]));
  const moved = [];
  for (const b of SHEET_BUNDLES) {
    const d = b.productUrls.reduce((sum, u) => sum + (delta.get(u) || 0), 0);
    if (!d) continue;
    const before = b.productUrls.reduce((sum, u) => sum + (priced.get(u) || 0), 0);
    moved.push({ id: b.id, before, after: before + d, d });
  }
  if (moved.length) {
    console.log(`BUNDLE TOTALS, ${moved.length} of ${SHEET_BUNDLES.length} move:`);
    for (const m of moved.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))) {
      console.log(`  bundle ${String(m.id).padStart(2)}: ${money(m.before)} -> ${money(m.after)}  (${m.d > 0 ? '+' : ''}${money(m.d).replace('$', '$')})`);
    }
    console.log('');
  }
}

if (refused.length) {
  console.log('NEEDS A HUMAN');
  for (const r of refused) console.log('  ' + r);
  console.log('');
}

// The abort. Checked AFTER the report, so the log says what went wrong rather
// than only that something did.
const failedShare = failed / catalogue.length;
if (shouldAbort(failed, catalogue.length)) {
  console.error(
    `REFUSING TO WRITE: ${failed} of ${catalogue.length} product pages did not yield a price ` +
    `(${(failedShare * 100).toFixed(0)}%, limit ${(MAX_FAILED_SHARE * 100).toFixed(0)}%).\n` +
    'That is a site-wide problem, not a set of price changes, and the pages that DID parse\n' +
    'cannot be trusted either while the rest look like this. Nothing has been changed.'
  );
  process.exit(1);
}

if (!changes.length) {
  console.log('Every price matches the product page. Nothing to change.');
  process.exit(0);
}

if (CHECK_ONLY) {
  console.log(`--check: ${changes.length} product(s) would change. Nothing written.`);
  process.exit(0);
}

/* ── Write ─────────────────────────────────────────────────────────────────── */

// Edited back-to-front so that every span recorded above is still valid: a
// replacement earlier in the file would shift the offsets of everything after
// it. Each edit is confined to its own entry's text, so a price can never be
// written into the wrong product.
let out = source;
for (const c of [...changes].sort((a, b) => b.entry.from - a.entry.from)) {
  let text = out.slice(c.entry.from, c.entry.to);
  if (c.price) {
    const before = text;
    text = text.replace(`\n    price: ${c.price.from},`, `\n    price: ${c.price.to},`);
    if (text === before) throw new Error(`could not rewrite the price line for ${c.key}`);
  }
  if (c.was) {
    const before = text;
    const fromLit = c.was.from == null ? 'null' : String(c.was.from);
    text = text.replace(`\n    was: ${fromLit},`, `\n    was: ${c.was.to == null ? 'null' : c.was.to},`);
    if (text === before) throw new Error(`could not rewrite the was line for ${c.key}`);
  }
  out = out.slice(0, c.entry.from) + text + out.slice(c.entry.to);
}

writeFileSync(TARGET, out);
console.log(`Wrote ${changes.length} price change(s) to src/quiz/bundles.js.`);
console.log('Bundle totals follow automatically: a bundle price is the sum of its products.');
