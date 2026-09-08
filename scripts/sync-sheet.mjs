// Pulls the bundle data from the Google Sheet and regenerates
// src/quiz/sheet-data.js. The sheet is the source of truth for which bundles
// exist and how they are matched; this script is the only way that data enters
// the repo.
//
//   npm run sync                    fetch the live sheet, rewrite sheet-data.js
//   npm run sync -- --check         fail if the committed file is out of date
//   npm run sync -- --csv-dir DIR   read rules.csv/products.csv/personas.csv
//                                   from DIR instead of the network
//
// WHY A COMMITTED FILE RATHER THAN A LIVE FETCH ON EVERY PAGE LOAD.
//   The quiz ships as one static script with no runtime dependencies, and the
//   64,575-combination sweep in scripts/sweep.mjs only means something if the
//   data it swept is the data that ships. Syncing at build time keeps both
//   properties: bad sheet data fails CI instead of reaching customers. The
//   component can still be pointed at a live CSV with the sheet-src attribute
//   when instant updates matter more than that guarantee.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSheetBundles, parsePersonas, SheetError } from '../src/quiz/sheet-parse.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, 'config/sheet.json');
const TARGET = join(ROOT, 'src/quiz/sheet-data.js');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : (args[i + 1] || '');
};
const CHECK_ONLY = args.includes('--check');
const CSV_DIR = flag('--csv-dir');

/**
 * The CSV export endpoint. Works for any sheet the caller can read.
 *
 * NOT /gviz/tq?tqx=out:csv. That endpoint runs a query engine over the sheet
 * and INFERS A HEADER ROW, and in doing so it silently dropped both of the
 * columns whose only value sat in the row it had decided was a header. Bundles
 * 5 and 8 came back with no products at all, while every other column was fine.
 * Nothing errored; the data was just quietly missing.
 *
 * /export returns the sheet verbatim, blank spacer rows and all, which is what
 * a source of truth has to do. Verified against both endpoints on 7 Sep 2026.
 */
const csvUrl = (sheetId, gid) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

/**
 * Fetch one tab.
 *
 * Google answers an unauthorised request with a 200-or-401 HTML sign-in page
 * rather than an error, so a naive fetch would hand the CSV parser a lump of
 * markup and produce a baffling "could not find the header row". Detect that
 * case and say what to actually do about it.
 */
async function fetchTab(sheetId, gid, name) {
  const url = csvUrl(sheetId, gid);
  const res = await fetch(url, { redirect: 'follow' });
  const body = await res.text();
  const type = res.headers.get('content-type') || '';

  if (!res.ok || type.includes('text/html') || /^\s*<!DOCTYPE/i.test(body)) {
    throw new Error(
      `could not read the "${name}" tab (HTTP ${res.status}).\n` +
      `  Google returned its sign-in page, which means the sheet is private.\n` +
      `  Fix: open the sheet, Share, "Anyone with the link" as Viewer.\n` +
      `  That makes only this sheet readable, not your Drive.\n` +
      `  Then re-run. To sync without sharing, export each tab as CSV and use:\n` +
      `    npm run sync -- --csv-dir ./path-with-rules-products-personas-csv\n` +
      `  URL tried: ${url}`
    );
  }
  return body;
}

function readLocal(dir, name) {
  const path = join(dir, `${name}.csv`);
  if (!existsSync(path)) throw new Error(`--csv-dir is missing ${name}.csv (looked in ${dir})`);
  return readFileSync(path, 'utf8');
}

/** Load all three tabs, from disk or from Google. */
async function loadTabs() {
  if (CSV_DIR) {
    console.log(`reading CSV from ${CSV_DIR}\n`);
    return {
      source: `local CSV, ${CSV_DIR}`,
      rules: readLocal(CSV_DIR, 'rules'),
      products: readLocal(CSV_DIR, 'products'),
      personas: readLocal(CSV_DIR, 'personas')
    };
  }

  const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
  const missing = Object.entries(cfg.tabs).filter(([, gid]) => gid == null).map(([k]) => k);
  if (missing.length) {
    console.error(
      `config/sheet.json has no gid for: ${missing.join(', ')}\n\n` +
      `  Open the sheet, click each tab, and copy the number after "#gid=" in\n` +
      `  the address bar into config/sheet.json. The first tab is usually 0.\n\n` +
      `  Until then you can sync from exported CSV files instead:\n` +
      `    npm run sync -- --csv-dir ./some-directory`
    );
    process.exit(1);
  }

  console.log(`fetching sheet ${cfg.sheetId}\n`);
  const [rules, products, personas] = await Promise.all([
    fetchTab(cfg.sheetId, cfg.tabs.rules, 'rules'),
    fetchTab(cfg.sheetId, cfg.tabs.products, 'products'),
    fetchTab(cfg.sheetId, cfg.tabs.personas, 'personas')
  ]);
  return { source: `https://docs.google.com/spreadsheets/d/${cfg.sheetId}`, rules, products, personas };
}

/**
 * Render the generated module.
 *
 * Written as plain data with no imports so the bundler in build-quiz.mjs can
 * concatenate it like any other quiz module.
 */
function render(bundles, personas, source, sheetId, tabs) {
  const j = (v) => JSON.stringify(v);
  const bundleLines = bundles.map((b) => [
    '  {',
    `    id: ${b.id},`,
    `    name: ${j(b.name)},`,
    `    label: ${j(b.label)},`,
    `    functions: ${j(b.functions)},`,
    `    footprint: { length: ${b.footprint.length}, depth: ${b.footprint.depth} },`,
    `    personas: ${j(b.personas)},`,
    `    budgetCeiling: ${b.budgetCeiling},`,
    '    productUrls: [',
    ...b.productUrls.map((u) => `      ${j(u)},`),
    '    ]',
    '  }'
  ].join('\n')).join(',\n');

  const personaLines = personas.map((p) => [
    '  {',
    `    name: ${j(p.name)},`,
    `    quote: ${j(p.quote)},`,
    `    description: ${j(p.description)}`,
    '  }'
  ].join('\n')).join(',\n');

  return `/**
 * GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Written by scripts/sync-sheet.mjs from the Google Sheet that owns the bundle
 * data. Any hand edit here is lost on the next sync. To change a bundle, or to
 * add one, edit the sheet and run:
 *
 *   npm run sync
 *
 * Source: ${source}
 *
 * WHAT THIS FILE CARRIES: which bundles exist, the rules that match a customer
 * to one (functions, footprint, personas, budget ceiling), and the products in
 * each, by URL. It carries no prices, copy or imagery, because the sheet holds
 * none. Those are joined on in src/quiz/bundles.js.
 *
 * "label" is the short working name from the products tab ("Cube", "bf900").
 * It is an internal handle for talking about a bundle, NOT customer-facing
 * copy, and nothing rendered to a visitor uses it.
 */

export const SHEET_SOURCE = ${JSON.stringify(source)};

/**
 * Where the live-override path fetches from.
 *
 * Baked in at sync time so <homegym-bundle-quiz sheet-live> needs no second
 * copy of the configuration. A null tab means that gid has not been filled into
 * config/sheet.json yet, and live mode reports that rather than guessing.
 */
export const SHEET_ID = ${JSON.stringify(sheetId)};
export const SHEET_TABS = ${JSON.stringify(tabs)};

export const SHEET_BUNDLES = [
${bundleLines}
];

/**
 * Customer personas from the sheet's third tab.
 *
 * These now DRIVE QUESTION THREE of the quiz. The options a visitor picks from
 * are generated from this list, and the rules tab's Style column says which
 * personas each bundle is built for, so adding a persona here and using it
 * there is enough to change what the quiz asks. Order is the sheet's order.
 */
export const PERSONAS = [
${personaLines}
];
`;
}

/** One line per bundle describing what changed against the committed file. */
function reportDiff(before, after) {
  const key = (b) => JSON.stringify([b.functions, b.footprint, b.personas, b.budgetCeiling, b.productUrls, b.name, b.label]);
  const oldById = new Map(before.map((b) => [b.id, b]));
  const newById = new Map(after.map((b) => [b.id, b]));
  let changes = 0;

  for (const b of after) {
    const was = oldById.get(b.id);
    if (!was) { console.log(`  NEW      bundle ${b.id}  ${b.productUrls.length} products, ${b.personas.join(' + ')}, ceiling ${b.budgetCeiling}`); changes++; }
    else if (key(was) !== key(b)) { console.log(`  CHANGED  bundle ${b.id}`); changes++; }
  }
  for (const b of before) {
    if (!newById.has(b.id)) { console.log(`  REMOVED  bundle ${b.id}`); changes++; }
  }
  return changes;
}

async function main() {
  let tabs;
  try {
    tabs = await loadTabs();
  } catch (e) {
    console.error(`sync FAILED: ${e.message}`);
    process.exit(1);
  }

  let bundles;
  let personas;
  try {
    bundles = buildSheetBundles(tabs.rules, tabs.products, tabs.personas);
    personas = parsePersonas(tabs.personas);
  } catch (e) {
    if (e instanceof SheetError) {
      console.error('sync FAILED, the sheet does not validate:\n');
      for (const p of e.problems) console.error(`  ${p}`);
      console.error('\nNothing was written. Fix the sheet and run again.');
      process.exit(1);
    }
    throw e;
  }

  // Carried into the generated file so the browser can find the sheet too.
  let sheetId = null;
  let gids = { rules: null, products: null, personas: null };
  try {
    const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
    sheetId = cfg.sheetId;
    gids = cfg.tabs;
  } catch { /* a --csv-dir run needs no config */ }

  const next = render(bundles, personas, tabs.source, sheetId, gids);
  const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';

  // Diff against what is committed, so the log says what actually moved.
  let previous = [];
  if (current) {
    try { previous = (await import(`file://${TARGET.replace(/\\/g, '/')}?t=${Date.now()}`)).SHEET_BUNDLES; }
    catch { previous = []; }
  }

  console.log(`parsed ${bundles.length} bundles and ${personas.length} personas`);
  for (const w of bundles.warnings || []) console.warn(`  WARNING  ${w}`);
  const changes = reportDiff(previous, bundles);
  if (!changes) console.log('  no changes');

  if (CHECK_ONLY) {
    if (next !== current) {
      console.error('\nsync --check FAILED: src/quiz/sheet-data.js is out of date. Run: npm run sync');
      process.exit(1);
    }
    console.log('\nsync --check ok: the committed data matches the sheet');
    return;
  }

  if (next === current) { console.log('\nsrc/quiz/sheet-data.js is already up to date'); return; }
  writeFileSync(TARGET, next);
  console.log(`\nwrote src/quiz/sheet-data.js (${bundles.length} bundles)`);
  console.log('Next: npm run check');
}

main();
