// Checks each bundle's anchor machine against the footprint its sheet row claims.
//
// WHY THIS IS NOT PART OF `npm run check`.
//   Same reason as check-images.mjs: it reports on data nobody in this repo
//   controls. Bundle 5 fails today, and wiring that into CI would block every
//   deploy on a spreadsheet cell only HomeGym can correct. It is a report, run
//   it when the Size column changes:
//
//     npm run check:fit
//
// WHAT THE SIZE COLUMN IS FOR.
//   It is a HARD FILTER, not a hint. A bundle whose footprint does not fit the
//   room a visitor entered is removed from consideration before scoring, so the
//   customer never sees it. It is also a promise: the result page prints
//   "Fits 2.0 x 3.0 m" next to the bundle. Both directions can be wrong. Too
//   small and you hide a bundle that would have sold; too big and you tell
//   someone a 338 kg machine fits a room it does not.
//
// WHAT THIS CAN AND CANNOT TELL YOU.
//   It compares the ANCHOR MACHINE ONLY against the stated footprint, because
//   that is the one thing with a published number. It says nothing about
//   whether there is room left for the bench, the plates, or a person to
//   actually use the thing, and those are in most of these bundles. Passing
//   here is necessary, not sufficient.
import { PRODUCTS, BUNDLES } from '../src/quiz/bundles.js';

const rows = [];

for (const b of BUNDLES) {
  const anchorId = b.products[0];
  const anchor = PRODUCTS[anchorId];
  const claimed = b.footprint;
  const machine = anchor.footprint;

  if (!machine) {
    rows.push({ b, anchor, status: 'unknown', detail: 'no dimensions published' });
    continue;
  }

  // A machine can be turned round, so it fits if EITHER orientation does. This
  // is the same rule the matcher uses in fits().
  const a = machine.w <= claimed.length && machine.d <= claimed.depth;
  const c = machine.w <= claimed.depth && machine.d <= claimed.length;

  if (a || c) {
    // Report how much room is left over on the tighter axis, because "fits by
    // 1cm" and "fits with a metre spare" are very different answers when a
    // bench and 107kg of plates still have to go somewhere.
    const slackA = a ? Math.min(claimed.length - machine.w, claimed.depth - machine.d) : -Infinity;
    const slackB = c ? Math.min(claimed.depth - machine.w, claimed.length - machine.d) : -Infinity;
    const slack = Math.max(slackA, slackB);
    rows.push({
      b, anchor, status: slack < 0.25 ? 'tight' : 'ok',
      detail: `${slack.toFixed(2)} m spare on the tighter side${a ? '' : ', turned round'}`
    });
  } else {
    const overA = Math.max(machine.w - claimed.length, machine.d - claimed.depth);
    const overB = Math.max(machine.w - claimed.depth, machine.d - claimed.length);
    rows.push({
      b, anchor, status: 'fail',
      detail: `over by ${Math.min(overA, overB).toFixed(2)} m in its best orientation`
    });
  }
}

const MARK = { ok: 'ok   ', tight: 'TIGHT', fail: 'FAIL ', unknown: '?    ' };
const pad = (s, n) => String(s).padEnd(n);

console.log('Anchor machine vs the footprint its bundle claims\n');
console.log(pad('', 6) + pad('#', 4) + pad('bundle', 22) + pad('claims', 12) + pad('machine', 14) + 'result');
console.log('-'.repeat(94));

for (const r of rows) {
  const m = r.anchor.footprint;
  console.log(
    pad(MARK[r.status], 6) +
    pad(r.b.id, 4) +
    pad(r.b.name.slice(0, 20), 22) +
    pad(`${r.b.footprint.length} x ${r.b.footprint.depth} m`, 12) +
    pad(m ? `${m.w} x ${m.d} m` : 'not published', 14) +
    r.detail
  );
}

const fails = rows.filter((r) => r.status === 'fail');
const tight = rows.filter((r) => r.status === 'tight');
const unknown = rows.filter((r) => r.status === 'unknown');

console.log('');
if (fails.length) {
  console.log(`${fails.length} bundle(s) claim a footprint their own anchor machine does not fit:`);
  for (const r of fails) {
    console.log(`  Bundle ${r.b.id}, ${r.b.name}: the ${r.anchor.name} is ${r.anchor.footprint.w} x ${r.anchor.footprint.d} m,`);
    console.log(`    but the sheet says the bundle fits ${r.b.footprint.length} x ${r.b.footprint.depth} m. ${r.detail}.`);
    console.log(`    A visitor with exactly that much floor is currently told it fits.`);
  }
  console.log('');
}
if (tight.length) {
  console.log(`${tight.length} fit the machine but leave under 25cm spare, before the bench and plates:`);
  for (const r of tight) console.log(`  Bundle ${r.b.id}, ${r.b.name}: ${r.detail}`);
  console.log('');
}
if (unknown.length) {
  console.log(`${unknown.length} cannot be checked, no dimensions on the product page:`);
  for (const r of unknown) console.log(`  Bundle ${r.b.id}, ${r.b.name}, anchor: ${r.anchor.name}`);
  console.log('');
}

console.log('Reminder: this checks the anchor machine only. Every bundle above with a');
console.log('bench and plates in it needs floor for those too, and for a person to lift.');

// Deliberately exits 0 even on failures. This is a report for a human, not a
// gate; see the note at the top.
