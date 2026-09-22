/**
 * Tests for the telemetry ingest mapping.  Run with:  npm test
 *
 * WHY THIS FILE EXISTS AT ALL.
 *   Every other failure in this repo is loud. This one is not. The collector
 *   posts with sendBeacon, which cannot see a response, so a row that Postgres
 *   rejects is dropped in silence; and a row that is ACCEPTED with the wrong
 *   column filled in is worse, because the dashboard then draws a confident
 *   chart of a number that is not the number. Nobody is going to notice that
 *   "bundles explored" reads zero.
 *
 *   So the mapping from event to row is tested directly, which is the only
 *   place the mistake can be caught before it becomes a quiet wrong answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toRow, EVENTS } from '../api/collect.js';
import { authorise, MIN_PASSWORD_LENGTH } from '../api/insights.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SID = 'a'.repeat(32);

test('a matched bundle lands in bundle_id', () => {
  const row = toRow({ name: 'quiz:complete', detail: { bundleId: 14, price: 1399 } }, SID);
  assert.equal(row.name, 'quiz:complete');
  assert.equal(row.bundle_id, 14);
  assert.equal(row.session_id, SID);
});

// The one genuinely easy thing to get wrong in the whole pipeline. This event
// names its bundle `toBundleId`, not `bundleId`, and `bundleId` is also present
// on it holding the bundle being navigated AWAY from. Read the wrong key and
// the "explored" column silently counts the wrong bundle.
test('an explored alternate is recorded as the bundle being opened, not the one being left', () => {
  const row = toRow({ name: 'quiz:alternate-view', detail: { fromBundleId: 3, toBundleId: 7 } }, SID);
  assert.equal(row.bundle_id, 7, 'must be the bundle the visitor opened');
});

test('the step number is promoted so the funnel can group on it', () => {
  assert.equal(toRow({ name: 'quiz:step', detail: { step: 3 } }, SID).step, 3);
  assert.equal(toRow({ name: 'quiz:start', detail: {} }, SID).step, null);
});

test('a CTA keeps its action, which is what the dashboard groups by', () => {
  for (const action of ['whatsapp', 'advice', 'book-visit', 'add-to-cart']) {
    assert.equal(toRow({ name: 'quiz:cta-click', detail: { action } }, SID).action, action);
  }
});

test('an unknown event name is dropped rather than sent to a CHECK constraint', () => {
  assert.equal(toRow({ name: 'quiz:ghost', detail: {} }, SID), null);
  assert.equal(toRow({ name: 'evil', detail: {} }, SID), null);
  assert.equal(toRow({}, SID), null);
  assert.equal(toRow(null, SID), null);
});

// Everything below is a hostile or malformed client, which is the only kind
// this endpoint will ever meet: it is reachable from any browser on the
// internet and the page it serves is embedded on someone else's site.
test('a step outside the quiz is rejected rather than stored', () => {
  assert.equal(toRow({ name: 'quiz:step', detail: { step: 9 } }, SID).step, null);
  assert.equal(toRow({ name: 'quiz:step', detail: { step: 0 } }, SID).step, null);
  assert.equal(toRow({ name: 'quiz:step', detail: { step: -1 } }, SID).step, null);
});

test('a number sent as a string is not quietly accepted', () => {
  // PostgREST would coerce "3" into the smallint and nothing would look wrong,
  // which is exactly why this is checked here instead of being left to Postgres.
  assert.equal(toRow({ name: 'quiz:step', detail: { step: '3' } }, SID).step, null);
  assert.equal(toRow({ name: 'quiz:complete', detail: { bundleId: '14' } }, SID).bundle_id, null);
  assert.equal(toRow({ name: 'quiz:step', detail: { step: 3.5 } }, SID).step, null);
  assert.equal(toRow({ name: 'quiz:step', detail: { step: NaN } }, SID).step, null);
});

test('an over-long string is dropped, not truncated into the column', () => {
  const long = 'x'.repeat(500);
  assert.equal(toRow({ name: 'quiz:cta-click', detail: { action: long } }, SID).action, null);
  assert.equal(toRow({ name: 'quiz:product-click', detail: { productId: long } }, SID).product_id, null);
});

test('a detail that is not an object cannot break the row', () => {
  for (const detail of [null, undefined, 'string', 42, ['a'], true]) {
    const row = toRow({ name: 'quiz:start', detail }, SID);
    assert.ok(row, `detail ${JSON.stringify(detail)} should still produce a row`);
    assert.deepEqual(row.detail, {}, 'a non-object detail becomes an empty object');
  }
});

// EVERY ROW MUST HAVE THE SAME KEYS, AND THIS IS NOT A STYLE POINT.
//
// PostgREST rejects a bulk insert whose objects do not all carry an identical
// key set, with a 400 and the whole batch lost. Found by sending a hand-written
// batch during setup where some rows omitted their null columns: every row was
// individually valid, the batch was refused outright.
//
// The collector posts with sendBeacon and cannot see a status code, so that
// 400 would be completely invisible: no console error, no failed request in
// devtools, just a dashboard that reads zero forever. An obvious future tidy-up
// — "don't send nulls, they're wasteful" — reintroduces it silently, which is
// exactly why it is pinned here.
test('every row has an identical key set, whatever the event', () => {
  const rows = [
    { name: 'quiz:start', detail: {} },
    { name: 'quiz:step', detail: { step: 2 } },
    { name: 'quiz:complete', detail: { bundleId: 3, price: 6567 } },
    { name: 'quiz:alternate-view', detail: { fromBundleId: 3, toBundleId: 7 } },
    { name: 'quiz:cta-click', detail: { action: 'whatsapp' } },
    { name: 'quiz:product-click', detail: { productId: 'titan-x20' } },
    { name: 'quiz:restart', detail: { completedBefore: true } }
  ].map((e) => toRow(e, SID));

  const shapes = new Set(rows.map((r) => Object.keys(r).sort().join(',')));
  assert.equal(
    shapes.size, 1,
    'PostgREST refuses a bulk insert with mismatched keys and the collector cannot ' +
    `see the rejection. Shapes found: ${[...shapes].join(' | ')}`
  );
  assert.equal(
    [...shapes][0],
    'action,bundle_id,detail,name,product_id,session_id,step',
    'the row shape changed; make sure every column still exists on every row'
  );
});

// ── The vocabulary has to agree in three places ────────────────────────────
//
// The collector in src/bundle-quiz.html sends them, this endpoint allows them,
// and a CHECK constraint in db/001_quiz_events.sql stores them. Nothing joins
// those three files up at runtime, and the failure mode when they drift is a
// metric that reads zero rather than an error anyone sees.
test('every event this endpoint accepts is one the table allows', () => {
  const schema = readFileSync(join(ROOT, 'db', '001_quiz_events.sql'), 'utf8');
  for (const name of EVENTS) {
    assert.ok(
      schema.includes(`'${name}'`),
      `api/collect.js accepts "${name}" but db/001_quiz_events.sql would reject it, ` +
      'so those rows would vanish on insert with nothing reported'
    );
  }
});

test('every event the quiz page sends is one this endpoint accepts', () => {
  const page = readFileSync(join(ROOT, 'src', 'bundle-quiz.html'), 'utf8');
  const blocks = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const collector = blocks.find((b) => /navigator\.sendBeacon\(/.test(b) && /\/api\/collect/.test(b));
  assert.ok(collector, 'no collector found in src/bundle-quiz.html');

  const sent = [...new Set([...collector.matchAll(/'(quiz:[a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(sent.length >= 7, `expected the full event list, found ${sent.length}`);
  for (const name of sent) {
    assert.ok(EVENTS.has(name), `the quiz page sends "${name}" but api/collect.js drops it`);
  }
});

// ── The dashboard's password ───────────────────────────────────────────────
//
// WHY THIS IS TESTED HARDER THAN ANYTHING ELSE IN THE REPO.
//   Vercel's deployment password cannot protect this page: protection covers a
//   whole deployment, and this one also serves bundle-quiz.html, the customer
//   embed that has to stay public. So /api/insights protects itself, and these
//   assertions are the only thing standing between "internal dashboard" and
//   "the client's traffic, published".
//
//   The nastiest failure is not a wrong answer, it is a permissive one: an
//   unset variable that falls through to "allow" looks exactly like a working
//   dashboard from the inside, and nobody discovers it by using the thing.

const GOOD = 'a-long-enough-password';

test('the right password is accepted', () => {
  assert.equal(authorise(GOOD, GOOD).ok, true);
});

test('a wrong password is refused with 401', () => {
  const r = authorise('not-the-password-at-all', GOOD);
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

test('an unset password refuses EVERYONE rather than letting everyone in', () => {
  // The whole point. Read the assertions as: there is no value of
  // INSIGHTS_PASSWORD, and no value of the supplied password, that opens this
  // door when the variable has not been configured.
  for (const expected of [undefined, null, '']) {
    for (const provided of ['', 'anything', GOOD, undefined, null]) {
      const r = authorise(provided, expected);
      assert.equal(r.ok, false, `unset password allowed "${provided}" through`);
      assert.equal(r.status, 503, 'an unconfigured dashboard must say so, not open');
    }
  }
});

test('a password shorter than the floor is treated as unset', () => {
  const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
  const r = authorise(short, short);
  assert.equal(r.ok, false, 'a guessable password is not a password');
  assert.equal(r.status, 503);

  // And the boundary itself is allowed, so the floor is a floor and not an
  // off-by-one that quietly rejects a valid 12-character password.
  const atFloor = 'y'.repeat(MIN_PASSWORD_LENGTH);
  assert.equal(authorise(atFloor, atFloor).ok, true);
});

test('a missing or non-string header cannot be mistaken for a password', () => {
  // req.headers[...] is undefined when absent, and an array when the header is
  // sent twice. Neither may be coerced into a comparison that could pass.
  for (const provided of [undefined, null, 0, false, [], {}, [GOOD], Buffer.from(GOOD)]) {
    const r = authorise(provided, GOOD);
    assert.equal(r.ok, false, `${JSON.stringify(provided)} was accepted as a password`);
    assert.equal(r.status, 401);
  }
});

test('a password that is a prefix of the real one is refused', () => {
  // Guards the shape of the comparison: hashing both sides means length tells
  // an attacker nothing and a prefix is as wrong as anything else.
  assert.equal(authorise(GOOD.slice(0, -1), GOOD).ok, false);
  assert.equal(authorise(GOOD + 'x', GOOD).ok, false);
});
