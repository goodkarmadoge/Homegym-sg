// Reading a product page, deciding whether to believe it, and rewriting PRODUCTS.
//
// WHY THIS FILE EXISTS.
//   sync-prices.mjs rewrites prices a customer reads, unattended, at 02:30. The
//   two things that could go wrong are believing a mis-read page and corrupting
//   the catalogue while editing it, so both are pinned here.
//
//   The decision rules are a pure function and tested directly. The write is a
//   string replacement against bundles.js, which cannot be type-checked, so it
//   is extracted from the script and RUN, the way test/rooms.test.mjs runs the
//   rooms insertion and scripts/test-engine.mjs runs the prototype's engine. The
//   script cannot simply be imported: it fetches 23 live pages at module scope.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRODUCTS } from '../src/quiz/bundles.js';
import { parseProductPage, decode } from '../scripts/lib/product-page.mjs';
import { MAX_MOVE, decidePrice, shouldAbort } from '../scripts/lib/price-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ── Reading the page ──────────────────────────────────────────────────────── */

// Shaped like the markup the real pages served on 22 Sep 2026, including the
// two traps that cost a CI run: Magento escaping its own product name, and a
// was-price that belongs to a related item further down the page.
const PAGE = ({ price = '4899.00', old = null, name = 'Vigor&#x20;Titan&#x20;X20' } = {}) => `
<html><head>
<meta property="og:title" content="${name}" />
<meta itemprop="price" content="${price}" />
<meta property="og:image" content="https://d101vd00cis701.cloudfront.net/catalog/product/cache/abc/x/2/x20.jpg" />
</head><body>
${old == null ? '' : `<span data-price-type="oldPrice" data-price-amount="${old}"></span>`}
<div class="related"><span data-price-amount="175"></span></div>
</body></html>`;

test('a product page yields name, price and image', () => {
  const p = parseProductPage(PAGE());
  assert.equal(p.name, 'Vigor Titan X20', 'the escaped name must be decoded, not passed through');
  assert.equal(p.price, 4899);
  assert.match(p.image, /^https:\/\//);
  assert.equal(p.was, null);
});

test('a was-price above the selling price is a sale', () => {
  assert.equal(parseProductPage(PAGE({ old: '5899' })).was, 5899);
});

test('a was-price at or below the selling price is a mis-read, not a discount', () => {
  // Both of these were served by real pages. Either would have rendered a
  // nonsense strikethrough next to the price.
  for (const old of ['4899', '175']) {
    const p = parseProductPage(PAGE({ old }));
    assert.equal(p.was, null, `was=${old} against price 4899 must be rejected`);
    assert.equal(p.wasRejected, true);
  }
});

test('an unreadable page yields nulls, never guesses', () => {
  const p = parseProductPage('<html><body>maintenance</body></html>');
  assert.equal(p.price, null);
  assert.equal(p.was, null);
});

test('decode leaves ordinary text alone', () => {
  assert.equal(decode('Vigor Titan X20'), 'Vigor Titan X20');
  assert.equal(decode(null), null);
});

/* ── Deciding whether to believe it ────────────────────────────────────────── */

const committed = { key: 'x20-bench', price: 1039, was: null };

test('an unchanged page changes nothing', () => {
  assert.equal(decidePrice(committed, { price: 1039, was: null }).kind, 'keep');
});

test('a price inside the limit is applied', () => {
  const v = decidePrice(committed, { price: 950, was: 1039 });
  assert.equal(v.kind, 'update');
  assert.deepEqual(v.price, { from: 1039, to: 950 });
  assert.deepEqual(v.was, { from: null, to: 1039 });
});

test('a sale ending clears the was-price', () => {
  const onSale = { key: 'tinytitan', price: 2200, was: 2799 };
  const v = decidePrice(onSale, { price: 2200, was: null });
  assert.equal(v.kind, 'update');
  assert.equal(v.price, null, 'the price itself did not move');
  assert.deepEqual(v.was, { from: 2799, to: null });
});

// The whole point of the limit. A pattern that starts matching the wrong
// element reports a plausible-looking number, and nothing here can tell that
// from a real promotion — so a big move is treated as the bug it usually is.
test('a move beyond the limit is refused, and does not abort the run', () => {
  for (const price of [29, 2920, 10390]) {
    const v = decidePrice(committed, { price, was: null });
    assert.equal(v.kind, 'refuse', `${price} should be refused`);
    assert.equal(v.counts, false, 'one wild product is not evidence about the site');
    assert.match(v.reason, /Too big to apply unattended/);
  }
});

test('the limit is applied as a ratio, in both directions', () => {
  const justInside = Math.round(committed.price * (1 + MAX_MOVE) * 100) / 100 - 1;
  const justOutside = Math.ceil(committed.price * (1 + MAX_MOVE)) + 1;
  assert.equal(decidePrice(committed, { price: justInside, was: null }).kind, 'update');
  assert.equal(decidePrice(committed, { price: justOutside, was: null }).kind, 'refuse');
  assert.equal(decidePrice(committed, { price: Math.round(committed.price * 0.7), was: null }).kind, 'update');
  assert.equal(decidePrice(committed, { price: Math.round(committed.price * 0.6), was: null }).kind, 'refuse');
});

test('a page that did not load or did not parse counts towards the abort', () => {
  for (const parsed of [{ error: 'HTTP 503' }, { price: null }, null]) {
    const v = decidePrice(committed, parsed);
    assert.equal(v.kind, 'refuse');
    assert.equal(v.counts, true, 'this is evidence about the site, not the product');
  }
});

test('a price that is not a price is refused', () => {
  for (const price of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(decidePrice(committed, { price, was: null }).kind, 'refuse', `${price} must be refused`);
  }
});

test('the run aborts only once a third of the catalogue has failed', () => {
  assert.equal(shouldAbort(7, 23), false);
  assert.equal(shouldAbort(8, 23), true);
  assert.equal(shouldAbort(0, 23), false);
  assert.equal(shouldAbort(23, 23), true);
  assert.equal(shouldAbort(0, 0), false, 'an empty catalogue is not an abort, it is a different bug');
});

/* ── Rewriting the catalogue ───────────────────────────────────────────────── */

/** The write block out of sync-prices.mjs, as a function of (source, changes). */
function writer() {
  const script = read('scripts/sync-prices.mjs');
  const from = script.indexOf('let out = source;');
  const to = script.indexOf('writeFileSync(TARGET, out);');
  assert.ok(from > 0 && to > from, 'could not find the write block in sync-prices.mjs');
  return new Function('source', 'changes', `${script.slice(from, to)}\nreturn out;`);
}

/**
 * Load a rewritten bundles.js and hand back its PRODUCTS.
 *
 * Written beside the real file rather than imported as a data: URL, because
 * bundles.js imports ./sheet-data.js and a data: URL has no directory to
 * resolve that against. Dotted so the build's globs skip it; removed in
 * `finally` so a failing assertion cannot leave it behind.
 */
async function productsOf(source) {
  const scratch = join(ROOT, `src/quiz/.prices-test-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  writeFileSync(scratch, source);
  try {
    return (await import(pathToFileURL(scratch).href)).PRODUCTS;
  } finally {
    rmSync(scratch, { force: true });
  }
}

/**
 * A change record shaped the way the script's own loop builds them.
 *
 * Both the offsets and the committed price are read out of the SOURCE PASSED
 * IN, never out of the imported PRODUCTS. Two reasons, and the first one cost a
 * CI run: an earlier version took `was` from PRODUCTS and cleared it on
 * tinytitan, which worked only while tinytitan happened to be on sale. The
 * price sync ended that sale and the test started failing on real data — a test
 * asserting something about the catalogue's contents while claiming to test
 * string surgery. The second is that it lets a change be built against an
 * already-rewritten source, so two writes can be chained; offsets shift when the
 * first one lands.
 */
function changeFor(key, { price, was } = {}, source = read('src/quiz/bundles.js')) {
  const blockStart = source.indexOf('export const PRODUCTS = {');
  const re = new RegExp(`^ {2}'${key}': \\{\\n[\\s\\S]*?\\n {2}\\},?$`, 'm');
  const m = re.exec(source.slice(blockStart));
  assert.ok(m, `could not find ${key} in PRODUCTS`);
  const body = m[0];
  const committedPrice = Number(/^ {4}price: (\d+(?:\.\d+)?),$/m.exec(body)[1]);
  const committedWasRaw = /^ {4}was: (\d+(?:\.\d+)?|null),$/m.exec(body)[1];
  const committedWas = committedWasRaw === 'null' ? null : Number(committedWasRaw);
  return {
    key,
    entry: {
      key,
      price: committedPrice,
      was: committedWas,
      from: blockStart + m.index,
      to: blockStart + m.index + body.length
    },
    price: price === undefined ? null : { from: committedPrice, to: price },
    was: was === undefined ? null : { from: committedWas, to: was }
  };
}

test('a price is rewritten in place, and nothing else moves', async () => {
  const source = read('src/quiz/bundles.js');
  const products = await productsOf(writer()(source, [changeFor('x20-bench', { price: 950 })]));

  assert.equal(products['x20-bench'].price, 950);
  for (const key of Object.keys(PRODUCTS)) {
    if (key === 'x20-bench') continue;
    assert.deepEqual(products[key], PRODUCTS[key], `${key} must be untouched`);
  }
});

// A sale starting and then ending, on one product, chained. Deliberately NOT
// "clear the was-price of whichever product is on sale today": the price sync
// ends sales, so that test passes or fails according to HomeGym's promotions
// rather than according to this code.
test('a was-price can be set and then cleared', async () => {
  const source = read('src/quiz/bundles.js');

  const withWas = writer()(source, [changeFor('x20-bench', { was: 1200 }, source)]);
  const set = await productsOf(withWas);
  assert.equal(set['x20-bench'].was, 1200, 'a sale starting must be written');

  const cleared = await productsOf(writer()(withWas, [changeFor('x20-bench', { was: null }, withWas)]));
  assert.equal(cleared['x20-bench'].was, null, 'a sale ending must write null, not remove the line');
  assert.equal(cleared['x20-bench'].price, set['x20-bench'].price, 'and must leave the price alone');
});

// Several products change on a normal night, and each edit shifts the offsets of
// everything after it in the file. The script sorts back-to-front for exactly
// this reason; if that ever regresses, the second edit lands in the wrong place.
test('several products can change in one run', async () => {
  const source = read('src/quiz/bundles.js');
  const products = await productsOf(writer()(source, [
    changeFor('tinytitan', { price: 2100 }),
    changeFor('x20-bench', { price: 950 }),
    changeFor('mab-bench', { price: 280 })
  ]));
  assert.equal(products.tinytitan.price, 2100);
  assert.equal(products['x20-bench'].price, 950);
  assert.equal(products['mab-bench'].price, 280);
});

test('the write refuses a price line it cannot find rather than writing anything', () => {
  const bogus = changeFor('x20-bench', { price: 950 });
  bogus.price.from = 999999;          // not the committed price, so no line matches
  assert.throws(() => writer()(read('src/quiz/bundles.js'), [bogus]), /could not rewrite the price line/);
});

/* ── The reason this is safe to run unattended ─────────────────────────────── */

// A bundle price is the sum of its products and never a typed-in figure, which
// is what lets a price sync exist at all: correct the product and every bundle
// containing it re-prices itself. If a stated bundle price ever appeared, this
// script would start producing totals that disagree with their own parts.
test('a bundle total is still the sum of its products', async () => {
  const { BUNDLES } = await import('../src/quiz/bundles.js');
  for (const b of BUNDLES) {
    const sum = b.products.reduce((t, id) => t + PRODUCTS[id].price, 0);
    assert.equal(b.price, sum, `bundle ${b.id} states ${b.price} but its products sum to ${sum}`);
  }
});
