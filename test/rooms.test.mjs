// The "Rooms we've built" strip: tile shape, and the string surgery that adds to it.
//
// WHY THIS FILE EXISTS.
//   sync-images.mjs may now add tiles to this strip unattended, which makes two
//   things worth pinning. The first is the shape of a tile, because every field
//   is rendered: a missing date prints "undefined" under a photograph on a
//   customer's screen. The second is the insertion itself, which is a string
//   replacement against a literal in bundles.js and so cannot be type-checked.
//
//   The insertion is tested by extracting the real block from the script and
//   running it, the way scripts/test-engine.mjs extracts the prototype's engine.
//   Importing the script is not an option: it fetches HomeGym's live Instagram
//   feed at module scope, and a test that needs a third party's feed to be up is
//   a test that fails for reasons that are nobody's fault.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOMS, PRODUCTS } from '../src/quiz/bundles.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/**
 * Load a rewritten bundles.js and hand back its ROOMS.
 *
 * Written to a scratch file BESIDE the real one rather than imported as a data:
 * URL, because bundles.js imports ./sheet-data.js and a data: URL has no
 * directory to resolve that against. The name is dotted so the build's own globs
 * skip it, and the finally clause removes it even when an assertion throws.
 */
async function loadCatalogue(source) {
  const scratch = join(ROOT, `src/quiz/.rooms-test-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  writeFileSync(scratch, source);
  try {
    return await import(pathToFileURL(scratch).href);
  } finally {
    rmSync(scratch, { force: true });
  }
}

/** Just the ROOMS array out of a rewritten catalogue. */
const roomsOf = async (source) => (await loadCatalogue(source)).ROOMS;

const DATE = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d\d$/;

test('every rooms tile carries every field the strip renders', () => {
  for (const [i, r] of ROOMS.entries()) {
    const where = `tile ${i}, "${r.title}"`;
    assert.match(r.image, /^https:\/\//, `${where} has no image URL`);
    assert.ok(r.title && r.title.length <= 60, `${where} has no usable title`);
    assert.match(r.date, DATE, `${where} has date "${r.date}", which is not the form tiles print`);
    assert.match(r.href, /^https:\/\/homegym\.sg\//, `${where} links outside the store`);
    assert.ok(['product', 'category'].includes(r.linkKind), `${where} has linkKind "${r.linkKind}"`);
    assert.equal(typeof r.verified, 'boolean', `${where} has no verified flag`);
  }
});

// A tile the sync adopted links to the product whose caption matched, so that
// link has to be a product this quiz actually sells. A curated tile may link to
// a category instead, which is the deliberate escape hatch for a machine in the
// photograph that is not in the catalogue.
test('an unverified tile links to a product in the catalogue', () => {
  const urls = new Set(Object.values(PRODUCTS).map((p) => p.url));
  for (const r of ROOMS.filter((x) => x.verified === false)) {
    assert.equal(r.linkKind, 'product', `unverified tile "${r.title}" should link to its matched product`);
    assert.ok(urls.has(r.href), `unverified tile "${r.title}" links to ${r.href}, which is not a catalogue product`);
  }
});

test('no tile is listed twice', () => {
  const seen = new Set();
  for (const r of ROOMS) {
    assert.ok(!seen.has(r.image), `${r.title} repeats an image already in the strip`);
    seen.add(r.image);
  }
});

/* ── The insertion, run for real ───────────────────────────────────────────── */

/** The adoption block out of sync-images.mjs, as a function of (src, roomAdditions). */
function insertion() {
  const script = read('scripts/sync-images.mjs');
  const from = script.indexOf('/* New tiles go at the HEAD');
  const to = script.indexOf('writeFileSync(TARGET, src);');
  assert.ok(from > 0 && to > from, 'could not find the rooms insertion block in sync-images.mjs');
  return new Function('src', 'roomAdditions', `${script.slice(from, to)}\nreturn src;`);
}

const TILE = {
  image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/test_1_n.jpg',
  title: 'Aeke S1 PRO setup',
  date: '5 Oct 2026',
  href: 'https://homegym.sg/strength/multi-functional.html/space-saving/aeke-s1-pro-smart-home-gym.html',
  linkKind: 'product'
};

test('an adopted tile lands at the head of the array, unverified', async () => {
  // Loaded as a module rather than regexed, so that an insertion which produced
  // something unparseable, or landed outside the array, fails here.
  const rooms = await roomsOf(insertion()(read('src/quiz/bundles.js'), [TILE]));
  assert.equal(rooms.length, ROOMS.length + 1);
  assert.deepEqual(rooms[0], { ...TILE, verified: false });
  assert.deepEqual(rooms.slice(1), ROOMS, 'the tiles already there must be untouched');
});

test('adopted tiles keep feed order, newest first', async () => {
  const second = { ...TILE, image: TILE.image.replace('test_1', 'test_2'), title: 'Vigor Tiny Titan', date: '1 Oct 2026' };
  const rooms = await roomsOf(insertion()(read('src/quiz/bundles.js'), [TILE, second]));
  assert.deepEqual(rooms.slice(0, 2).map((r) => r.title), [TILE.title, second.title]);
});

test('nothing is written when there is nothing to adopt', () => {
  const before = read('src/quiz/bundles.js');
  assert.equal(insertion()(before, []), before);
});

test('the insertion refuses a file it cannot find the array in', () => {
  assert.throws(() => insertion()('export const ROOMS = []', [TILE]), /could not find the ROOMS array/);
});

/* ── The hero swap must not reach a rooms tile ─────────────────────────────── */

/** The hero-swap block out of sync-images.mjs, as a function of (src, edits). */
function heroWriter() {
  const script = read('scripts/sync-images.mjs');
  const from = script.indexOf('/**\n * The span of one BUNDLE_COPY entry');
  const to = script.indexOf('for (const t of deadTiles) {');
  assert.ok(from > 0 && to > from, 'could not find the hero-swap block in sync-images.mjs');
  return new Function('src', 'edits', `${script.slice(from, to)}\nreturn src;`);
}

// THE 26 Oct 2026 FAILURE. The swap was a file-wide string replace, and a hero
// photograph is routinely also a rooms tile's image, because both come from the
// same feed. So swapping bundle 6's hero rewrote the tile "Infinity half rack
// with barbell set" as well, leaving its hand-written title and August date over
// a different photograph. It showed up as a duplicate tile only because the same
// post was adopted in the same run; on any other night it would have gone out
// quietly.
test('swapping a hero leaves a rooms tile that shares the photograph alone', async () => {
  const source = read('src/quiz/bundles.js');
  const { BUNDLE_COPY: copyBefore } = await import('../src/quiz/bundles.js');

  // Pick a real bundle whose hero is also a tile image. There are several; if
  // there are none the premise has gone away and this test has nothing to guard.
  const shared = Object.entries(copyBefore)
    .map(([id, c]) => ({ id: Number(id), hero: c.hero, tile: ROOMS.find((r) => r.image === c.hero) }))
    .find((x) => x.tile);
  assert.ok(shared, 'expected at least one bundle hero to also be a rooms tile image');

  const to = 'https://d101vd00cis701.cloudfront.net/ox_instagram/zz-regression-test_n.jpg';
  const out = heroWriter()(source, [
    { id: shared.id, field: 'hero', from: shared.hero, to },
    { id: shared.id, field: 'heroVerified', from: null, to: false }
  ]);
  const mod = await loadCatalogue(out);

  assert.equal(mod.BUNDLE_COPY[shared.id].hero, to, 'the hero must be swapped');
  assert.equal(mod.BUNDLE_COPY[shared.id].heroVerified, false, 'and marked unverified');

  const tileAfter = mod.ROOMS.find((r) => r.title === shared.tile.title);
  assert.equal(tileAfter.image, shared.hero,
    `the tile "${shared.tile.title}" kept its title and date, so it must keep its photograph`);

  assert.equal(new Set(mod.ROOMS.map((r) => r.image)).size, mod.ROOMS.length,
    'and no tile may end up sharing an image with another');
});

test('a hero already marked unverified is not marked twice', async () => {
  const source = read('src/quiz/bundles.js');
  const { BUNDLE_COPY: copyBefore } = await import('../src/quiz/bundles.js');
  const already = Object.keys(copyBefore).find((id) => 'heroVerified' in copyBefore[id]);
  assert.ok(already, 'expected at least one entry to carry heroVerified already');

  const to = 'https://d101vd00cis701.cloudfront.net/ox_instagram/zz-second-swap_n.jpg';
  const out = heroWriter()(source, [
    { id: Number(already), field: 'hero', from: copyBefore[already].hero, to },
    { id: Number(already), field: 'heroVerified', from: null, to: false }
  ]);
  assert.equal((out.match(/heroVerified:/g) || []).length,
    (source.match(/heroVerified:/g) || []).length,
    'swapping an already-flagged hero must reuse the flag, not add a second');
  const mod = await loadCatalogue(out);
  assert.equal(mod.BUNDLE_COPY[already].heroVerified, false);
});

/* ── The claim the strip makes ─────────────────────────────────────────────── */

// "Real installs from our Instagram, not showroom mock-ups" is a claim about the
// photographs. The sync can now put a photograph nobody has opened among the
// seven on screen, so the claim has to be conditional on the tiles SHOWN. This
// reads the component's source because the component cannot be imported in Node:
// it calls customElements.define at module scope.
test('the strip only claims real installs while every tile shown is verified', () => {
  const src = read('src/quiz/homegym-bundle-quiz.js');
  const shown = Number(src.match(/const ROOMS_SHOWN = (\d+);/)?.[1]);
  assert.ok(shown > 0, 'could not read ROOMS_SHOWN');

  assert.match(src, /const allChecked = tiles\.every\(\(r\) => r\.verified !== false\);/,
    'the standfirst must be decided by the tiles actually shown');
  assert.match(src, /allChecked[\s\S]{0,400}not showroom mock-ups/,
    'the strong claim must sit on the true branch');

  // And the data has to be able to satisfy it: if the first `shown` tiles were
  // never all verified, the strong line would be dead code.
  const front = ROOMS.slice(0, shown);
  assert.ok(front.length, 'no tiles to show');
  const unverifiedUpFront = front.filter((r) => r.verified === false);
  if (unverifiedUpFront.length) {
    console.log(
      `note: ${unverifiedUpFront.length} of the ${shown} tiles on screen are waiting to be ` +
      'looked at, so the strip is using the weaker standfirst. Promote them in bundles.js.'
    );
  }
});
