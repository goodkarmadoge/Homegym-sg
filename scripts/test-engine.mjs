// Exercises the quiz recommendation engine across every possible answer combination.
// The engine lives inline in src/prototype.html, so it is extracted and run in isolation.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'src/prototype.html'), 'utf8');

const cut = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`engine marker not found: ${i < 0 ? a : b}`);
  return src.slice(i, j);
};

const catalogue = cut('const P = (name, price, live, foot, why, tagline) =>', '/* ─────────── questions ─────────── */');
const engine    = cut('function build(){', '/* ─────────── result view ─────────── */');

const A = {};
const money = n => 'S$' + n.toLocaleString('en-SG');
const { build } = new Function('A', 'money', `${catalogue}\n${engine}\nreturn {build, C};`)(A, money);

const DIMS = {
  goal:    ['strength', 'fat', 'health', 'sport'],
  home:    ['hdb', 'condo', 'landed', 'office'],
  space:   ['s1', 's2', 's3', 's4'],
  ceiling: ['low', 'high', 'ask'],
  level:   ['new', 'ret', 'reg', 'adv'],
  budget:  ['b1', 'b2', 'b3', 'b4'],
};
const CAPS = { b1: 1000, b2: 3000, b3: 6000, b4: 99999 };

const problems = [];
const names = new Set();
let n = 0;

for (const goal of DIMS.goal)
for (const home of DIMS.home)
for (const space of DIMS.space)
for (const ceiling of DIMS.ceiling)
for (const level of DIMS.level)
for (const budget of DIMS.budget) {
  Object.assign(A, { goal, home, space, ceiling, level, budget });
  const key = [goal, home, space, ceiling, level, budget].join('/');
  n++;
  let r;
  try { r = build(); } catch (e) { problems.push(`THROW ${key}: ${e.message}`); continue; }

  names.add(r.name);
  if (!r.items.length)                         problems.push(`EMPTY ${key}`);
  if (!Number.isFinite(r.total) || r.total <= 0) problems.push(`BAD TOTAL ${key}: ${r.total}`);
  if (!r.name || !r.why)                       problems.push(`MISSING COPY ${key}`);
  if (r.items.some(i => !i?.name || !Number.isFinite(i.price))) problems.push(`BAD ITEM ${key}`);
  if (new Set(r.items.map(i => i.name)).size !== r.items.length) problems.push(`DUPLICATE ITEM ${key}`);
  if (Object.values(r.stats).some(v => /NaN|Infinity|undefined/.test(String(v))))
    problems.push(`BAD STAT ${key}: ${JSON.stringify(r.stats)}`);
  if (/NaN|Infinity/.test(JSON.stringify(r.plan))) problems.push(`BAD PLAN ${key}`);

  // A strength build must always land something you can actually load.
  if (goal === 'strength' && !r.items.some(i => i.foot[2] >= 1.5 || /Dumbbell/.test(i.name)))
    problems.push(`NO ANCHOR ${key}`);

  // Budget is a hard ceiling. Assembly is the only sanctioned overrun, capped at 12%.
  const cap = CAPS[budget];
  if (cap < 99999 && r.total > cap * 1.13) problems.push(`OVER BUDGET ${key}: ${r.total} vs ${cap}`);
}

console.log(`combinations tested : ${n}`);
console.log(`distinct builds     : ${names.size}`);

if (problems.length) {
  console.error(`\nengine FAILED (${problems.length}):`);
  problems.slice(0, 20).forEach(p => console.error('  ' + p));
  if (problems.length > 20) console.error(`  ... and ${problems.length - 20} more`);
  process.exit(1);
}
console.log('engine OK: no empty, malformed, duplicated or over-budget results');
