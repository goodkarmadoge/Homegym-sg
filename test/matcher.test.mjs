/**
 * Unit tests for the matching logic.  Run with:  npm test
 * Node's built-in test runner, no test framework dependency.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLES, PRODUCTS } from '../src/quiz/bundles.js';
import { match, fits, functionScore, budgetScore, levelScore, FALLBACK } from '../src/quiz/matcher.js';

const run = (answers) => match(answers, BUNDLES);
const nameOf = (answers) => run(answers).primary?.name ?? null;

// ── The eight cases specified in Section 5.5 ────────────────────────────────

test('smart + cable in a 1x2 room picks The Silent Operator', () => {
  assert.equal(
    nameOf({ functions: ['smart', 'cable'], length: 1, depth: 2, level: 'beginner', budget: 6000 }),
    'The Silent Operator'
  );
});

test('barbell + cable on a $2,500 budget picks The Barbell Purist', () => {
  assert.equal(
    nameOf({ functions: ['power_rack', 'cable'], length: 2.5, depth: 3, level: 'intermediate', budget: 2500 }),
    'The Barbell Purist'
  );
});

test('everything, 3x3, advanced, $7,000 picks The Iron Fortress', () => {
  assert.equal(
    nameOf({ functions: ['smith', 'power_rack', 'cable', 'leg_press'], length: 3, depth: 3, level: 'advanced', budget: 7000 }),
    'The Iron Fortress'
  );
});

test('machine circuit, 1.5x2, beginner, $2,500 picks The Fast Track', () => {
  assert.equal(
    nameOf({ functions: ['multigym'], length: 1.5, depth: 2, level: 'beginner', budget: 2500 }),
    'The Fast Track'
  );
});

test('smith + cable, 1.5x2, intermediate, $4,000 picks The Foldaway Beast', () => {
  assert.equal(
    nameOf({ functions: ['smith', 'cable'], length: 1.5, depth: 2, level: 'intermediate', budget: 4000 }),
    'The Foldaway Beast'
  );
});

test('a 1x1 room falls back gracefully and never throws', () => {
  const result = run({ functions: ['power_rack'], length: 1, depth: 1, level: 'beginner', budget: 2500 });
  assert.notEqual(result.fallback, FALLBACK.NONE, 'must report that it fell back');
  assert.ok(Array.isArray(result.alternates), 'alternates must always be an array');
  // Nothing on earth fits 1x1, so this must be the contact card, not a fabricated bundle.
  assert.equal(result.fallback, FALLBACK.CONTACT);
  assert.equal(result.primary, null);
});

test('orientation swap gives an identical result', () => {
  const base = { functions: ['smith', 'power_rack', 'cable'], level: 'intermediate', budget: 5000 };
  const a = run({ ...base, length: 3, depth: 2 });
  const b = run({ ...base, length: 2, depth: 3 });
  assert.equal(a.primary.id, b.primary.id);
  assert.deepEqual(a.alternates.map((x) => x.id), b.alternates.map((x) => x.id));
});

test('every bundle total equals the sum of its products', () => {
  for (const b of BUNDLES) {
    const sum = b.products.reduce((total, id) => {
      assert.ok(PRODUCTS[id], `bundle "${b.name}" references unknown product "${id}"`);
      return total + PRODUCTS[id].price;
    }, 0);
    assert.equal(sum, b.price, `${b.name}: products sum to ${sum} but price is ${b.price}`);
  }
});

// ── Data integrity ─────────────────────────────────────────────────────────

test('catalogue has 15 products, each with a URL and an image', () => {
  const ids = Object.keys(PRODUCTS);
  assert.equal(ids.length, 15);
  for (const id of ids) {
    const p = PRODUCTS[id];
    assert.match(p.url, /^https:\/\/homegym\.sg\//, `${id} has a bad product URL`);
    assert.match(p.image, /^https:\/\/d101vd00cis701\.cloudfront\.net\//, `${id} has a bad image URL`);
    assert.ok(p.name && p.name.length > 3, `${id} has no name`);
    assert.ok(Number.isFinite(p.price) && p.price > 0, `${id} has a bad price`);
  }
});

test('product URLs and images are all distinct, no copy-paste collisions', () => {
  const urls = Object.values(PRODUCTS).map((p) => p.url);
  const images = Object.values(PRODUCTS).map((p) => p.image);
  assert.equal(new Set(urls).size, urls.length, 'duplicate product URL');
  assert.equal(new Set(images).size, images.length, 'duplicate image URL');
});

test('there are 10 bundles with unique ids and names, priced under their ceilings', () => {
  assert.equal(BUNDLES.length, 10);
  assert.equal(new Set(BUNDLES.map((b) => b.id)).size, 10);
  assert.equal(new Set(BUNDLES.map((b) => b.name)).size, 10);
  for (const b of BUNDLES) {
    assert.ok(b.price <= b.budgetCeiling, `${b.name} is over its ceiling`);
    assert.ok(b.trains.length > 0, `${b.name} has no trains list`);
    assert.ok(b.functions.length > 0, `${b.name} has no function tags`);
  }
});

// ── Scoring components ─────────────────────────────────────────────────────

test('fits() is orientation-agnostic', () => {
  const b = { footprint: { length: 1.5, depth: 2.5 } };
  assert.equal(fits(b, 2.5, 1.5), true);
  assert.equal(fits(b, 1.5, 2.5), true);
  assert.equal(fits(b, 1.5, 2.0), false);
});

test('functionScore rewards coverage and caps the capability bonus at +0.15', () => {
  assert.equal(functionScore(['cable'], ['cable']), 1);
  // Zero coverage still earns the capability bonus for the one function it does
  // have, a machine that does something else is worth 0.05, not nothing.
  assert.equal(functionScore(['cable'], ['smith']), 0.05);
  assert.equal(functionScore([], ['smith']), 0, 'no selection means no score at all');
  // 1 of 2 covered, 0 extras
  assert.equal(functionScore(['cable', 'leg_press'], ['cable']), 0.5);
  // 1 of 2 covered, 3 extras -> 0.5 + 0.15 (capped), not 0.5 + 0.20
  const capped = functionScore(['cable', 'leg_press'], ['cable', 'smith', 'power_rack', 'multigym']);
  assert.ok(Math.abs(capped - 0.65) < 1e-9, `expected 0.65, got ${capped}`);
  // Never exceeds 1
  assert.equal(functionScore(['cable'], ['cable', 'smith', 'power_rack', 'multigym']), 1);
});

test('budgetScore steps down as the bundle leaves money on the table', () => {
  assert.equal(budgetScore(3800, 4000), 1.0);
  assert.equal(budgetScore(2400, 4000), 0.8);
  assert.equal(budgetScore(1700, 4000), 0.55);
  assert.equal(budgetScore(1000, 4000), 0.3);
});

test('levelScore is 1.0 / 0.6 / 0.2 by distance', () => {
  assert.equal(levelScore('beginner', 'beginner'), 1.0);
  assert.equal(levelScore('beginner', 'intermediate'), 0.6);
  assert.equal(levelScore('beginner', 'advanced'), 0.2);
  assert.equal(levelScore('advanced', 'beginner'), 0.2);
});

// ── Contract guarantees ────────────────────────────────────────────────────

test('alternates never repeat the primary and never exceed two', () => {
  const r = run({ functions: ['smith', 'power_rack', 'cable'], length: 3, depth: 3, level: 'intermediate', budget: 7500 });
  assert.ok(r.alternates.length <= 2);
  assert.ok(!r.alternates.some((alt) => alt.id === r.primary.id));
});

test('the acceptance-criteria edge cases produce a result without throwing', () => {
  // 1x1m, the tightest possible room
  assert.doesNotThrow(() =>
    run({ functions: ['power_rack'], length: 1, depth: 1, level: 'beginner', budget: 2500 })
  );
  // $2,500 budget, 3x3 space, every function selected
  const all = run({
    functions: ['power_rack', 'smith', 'cable', 'leg_press', 'multigym', 'smart'],
    length: 3, depth: 3, level: 'advanced', budget: 2500
  });
  assert.ok(all.primary, 'a 3x3 room at $2,500 should still find a real bundle');
  assert.equal(all.fallback, FALLBACK.NONE, 'The Barbell Purist and The Fast Track both clear $2,500');
});

test('degenerate input does not throw', () => {
  assert.doesNotThrow(() => match({}, BUNDLES));
  assert.doesNotThrow(() => match(null, BUNDLES));
  assert.doesNotThrow(() => match({ functions: [], length: 0, depth: 0, level: 'x', budget: 0 }, BUNDLES));
});

test('the matcher does not mutate the bundle data it is given', () => {
  const snapshot = JSON.stringify(BUNDLES);
  run({ functions: ['cable'], length: 2, depth: 2, level: 'beginner', budget: 4000 });
  assert.equal(JSON.stringify(BUNDLES), snapshot);
});
