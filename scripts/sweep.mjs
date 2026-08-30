/**
 * Reachability sweep, Section 9 acceptance criterion.
 *
 * Sweeps the whole realistic input space and asserts every bundle is reachable
 * as a primary match. Prints the distribution so it can be diffed against the
 * regression baseline in the spec.
 *
 *   Function subsets of size 1-3 from 6 tags : 6 + 15 + 20 = 41
 *   Space combos (5 lengths x 5 depths)      : 25
 *   Levels                                   : 3
 *   Budget steps ($2,500-$7,500 by $250)     : 21
 *   ---------------------------------------------------
 *   Total                                    : 64,575
 *
 * Run with:  npm run sweep
 * Exits non-zero if any bundle is unreachable or any combination throws.
 */
import { BUNDLES, FUNCTION_OPTIONS } from '../src/quiz/bundles.js';
import { match, FALLBACK } from '../src/quiz/matcher.js';

const TAGS = FUNCTION_OPTIONS.map((o) => o.tag);
const DIMS = [1.0, 1.5, 2.0, 2.5, 3.0];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const BUDGETS = Array.from({ length: 21 }, (_, i) => 2500 + i * 250);

/** All subsets of TAGS with size 1..3. */
function subsets(arr, maxSize) {
  const out = [];
  const walk = (start, acc) => {
    if (acc.length) out.push(acc.slice());
    if (acc.length === maxSize) return;
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

const FUNCTION_SETS = subsets(TAGS, 3);

const counts = new Map(BUNDLES.map((b) => [b.id, 0]));
const fallbackCounts = new Map([
  [FALLBACK.BUDGET, 0],
  [FALLBACK.SPACE, 0],
  [FALLBACK.SMALLEST, 0],
  [FALLBACK.CONTACT, 0]
]);

let total = 0;
let matched = 0;      // combinations that produced a real bundle
let fellBack = 0;     // combinations that used any rung of the ladder
let contactOnly = 0;  // combinations that produced no bundle at all
const errors = [];

for (const functions of FUNCTION_SETS) {
  for (const length of DIMS) {
    for (const depth of DIMS) {
      for (const level of LEVELS) {
        for (const budget of BUDGETS) {
          total++;
          const answers = { functions, length, depth, level, budget };
          let result;
          try {
            result = match(answers, BUNDLES);
          } catch (err) {
            if (errors.length < 5) errors.push({ answers, message: err.message });
            continue;
          }
          if (result.fallback !== FALLBACK.NONE) {
            fellBack++;
            fallbackCounts.set(result.fallback, (fallbackCounts.get(result.fallback) ?? 0) + 1);
          }
          if (result.primary) {
            matched++;
            counts.set(result.primary.id, counts.get(result.primary.id) + 1);
          } else {
            contactOnly++;
          }
        }
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0');

// The spec's stated regression baseline, for side-by-side comparison.
const BASELINE = {
  4: 24.1, 8: 18.2, 5: 16.2, 9: 10.8, 7: 9.9,
  2: 7.2, 1: 6.6, 6: 3.5, 10: 2.4, 3: 1.0
};

console.log(`\nSwept ${total.toLocaleString()} combinations`);
console.log(`  ${matched.toLocaleString()} produced a bundle`);
console.log(`  ${fellBack.toLocaleString()} (${pct(fellBack, total)}%) used the fallback ladder`);
console.log(`  ${contactOnly.toLocaleString()} (${pct(contactOnly, total)}%) reached the "let's talk" card\n`);

const rows = [...counts.entries()]
  .map(([id, n]) => {
    const b = BUNDLES.find((x) => x.id === id);
    const share = Number(pct(n, matched));
    return { id, name: b.name, n, share, baseline: BASELINE[id] ?? null };
  })
  .sort((a, b) => b.n - a.n);

const pad = (s, w) => String(s).padEnd(w);
const lpad = (s, w) => String(s).padStart(w);

console.log(`${pad('Bundle', 22)}${lpad('Matches', 9)}${lpad('Share', 8)}${lpad('Baseline', 10)}${lpad('Delta', 8)}`);
console.log('-'.repeat(57));
for (const r of rows) {
  const delta = r.baseline === null ? 'n/a' : `${(r.share - r.baseline >= 0 ? '+' : '')}${(r.share - r.baseline).toFixed(1)}`;
  console.log(
    pad(r.name, 22) + lpad(r.n.toLocaleString(), 9) + lpad(`${r.share.toFixed(1)}%`, 8) +
    lpad(r.baseline === null ? 'n/a' : `${r.baseline.toFixed(1)}%`, 10) + lpad(delta, 8)
  );
}

console.log('\nFallback ladder usage:');
for (const [tier, n] of fallbackCounts) {
  console.log(`  ${pad(tier, 12)} ${lpad(n.toLocaleString(), 8)}  (${pct(n, total)}%)`);
}

const unreachable = rows.filter((r) => r.n === 0);

console.log('');
if (errors.length) {
  console.error(`FAIL, ${errors.length} combination(s) threw. First:`);
  console.error(JSON.stringify(errors[0], null, 2));
  process.exit(1);
}
if (unreachable.length) {
  console.error(`FAIL, unreachable bundle(s): ${unreachable.map((r) => r.name).join(', ')}`);
  process.exit(1);
}
console.log('PASS, all 10 bundles are reachable and no combination threw.');
