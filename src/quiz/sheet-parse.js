/**
 * Homegym.sg, Google Sheet parsing.
 *
 * ISOMORPHIC MODULE. No DOM, no Node built-ins, no imports. It runs in three
 * places and must behave identically in all of them:
 *   1. scripts/sync-sheet.mjs, to regenerate the committed src/quiz/sheet-data.js
 *   2. test/sheet-parse.test.mjs, to guard the vocabularies below
 *   3. the browser, when <homegym-bundle-quiz sheet-src> pulls live CSV
 *
 * It takes raw CSV text and returns validated bundle rules. It never touches
 * prices, copy or imagery: those live in bundles.js because the sheet does not
 * carry them. See bundles.js, "WHAT THE SHEET OWNS".
 *
 * DESIGN NOTE, COLUMNS ARE FOUND BY NAME.
 *   Every lookup below is by header text, never by column index. The client can
 *   reorder columns, insert a column, or add a bundle row, and this keeps
 *   working. That is the whole point of the sheet being the source of truth:
 *   adding bundle 11 must not require a code change.
 */

/* CSV ---------------------------------------------------------------------- */

/**
 * RFC 4180 CSV to a grid of strings.
 *
 * Hand-rolled rather than pulled from npm because this module ships to the
 * browser inside the quiz bundle and the repo installs no dependencies.
 * Handles quoted fields, embedded commas, embedded newlines and doubled-quote
 * escapes, which is everything Google's CSV export can emit.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  // Normalise line endings first so CRLF does not leak into the last field.
  const s = String(text).replace(/\r\n?/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   // a doubled quote is one literal quote
        else quoted = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { quoted = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else { field += c; }
  }

  // Flush the trailing field, but not a phantom row from a trailing newline.
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.map((r) => r.map((f) => f.trim()));
}

/* Vocabularies ------------------------------------------------------------- */

/**
 * Sheet wording to internal tag.
 *
 * Keys are normalised (lowercased, punctuation and spaces stripped) before
 * lookup, so "Power Rack", "power rack", "power_rack" and "POWERRACK" all land
 * on the same tag. Every alias is listed explicitly rather than guessed at by
 * fuzzy matching, because a silent mis-map would quietly change which bundles a
 * customer can be shown.
 */
export const FUNCTION_ALIASES = {
  smith: 'smith',
  smithmachine: 'smith',
  powerrack: 'power_rack',
  rack: 'power_rack',
  squatrack: 'power_rack',
  halfrack: 'power_rack',
  cable: 'cable',
  cablemachine: 'cable',
  functionaltrainer: 'cable',
  legpress: 'leg_press',
  multigym: 'multigym',
  machine: 'multigym',
  smart: 'smart',
  smarttrainer: 'smart'
};

/** "Advance" is what the sheet says; the quiz has always called it advanced. */
export const LEVEL_ALIASES = {
  beginner: 'beginner',
  novice: 'beginner',
  intermediate: 'intermediate',
  advance: 'advanced',
  advanced: 'advanced',
  expert: 'advanced'
};

const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');

/* Errors ------------------------------------------------------------------- */

/**
 * A parse failure carries every problem found, not just the first.
 *
 * Someone fixing their sheet should see all ten broken cells in one pass rather
 * than re-running the sync ten times.
 */
export class SheetError extends Error {
  constructor(problems) {
    super('the sheet has ' + problems.length + ' problem(s):\n  ' + problems.join('\n  '));
    this.name = 'SheetError';
    this.problems = problems;
  }
}

/* Tab 1, the bundle rules -------------------------------------------------- */

/** Find the header row by the columns it must contain, not by position. */
function findHeader(rows, required, what) {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map(norm);
    if (required.every((r) => cells.includes(r))) return i;
  }
  throw new SheetError([
    'could not find the ' + what + ' header row. Expected a row containing: ' + required.join(', ')
  ]);
}

/**
 * Parse the rules tab into one record per bundle.
 *
 * Blank rows are skipped rather than treated as errors, because leaving a gap
 * above a notes row is normal spreadsheet behaviour.
 */
export function parseRules(csv) {
  const rows = parseCsv(csv);
  const head = findHeader(rows, ['functions', 'budget', 'bundle'], 'bundle rules');
  const cols = {};
  rows[head].forEach((name, i) => { if (norm(name) && cols[norm(name)] == null) cols[norm(name)] = i; });

  const at = (row, key) => (cols[key] == null ? '' : (row[cols[key]] || '').trim());
  const problems = [];
  const bundles = [];
  const seen = new Set();

  for (let i = head + 1; i < rows.length; i++) {
    const row = rows[i];
    const where = 'rules row ' + (i + 1);

    // A row counts as present only if it names a bundle number. Everything else
    // on the tab (blank spacers, notes, totals) is ignored.
    const idRaw = at(row, 'bundle');
    if (!idRaw) continue;

    const id = Number(idRaw);
    if (!Number.isInteger(id) || id < 1) {
      problems.push(where + ': bundle number "' + idRaw + '" is not a positive whole number');
      continue;
    }
    if (seen.has(id)) { problems.push(where + ': bundle ' + id + ' is listed more than once'); continue; }
    seen.add(id);

    // Functions, semicolon separated.
    const fnRaw = at(row, 'functions');
    const functions = [];
    for (const part of fnRaw.split(';').map((p) => p.trim()).filter(Boolean)) {
      const tag = FUNCTION_ALIASES[norm(part)];
      if (!tag) {
        problems.push(
          where + ': function "' + part + '" is not recognised. Known: ' +
          [...new Set(Object.values(FUNCTION_ALIASES))].join(', ')
        );
      } else if (!functions.includes(tag)) {
        functions.push(tag);
      }
    }
    if (!functions.length) problems.push(where + ': bundle ' + id + ' lists no recognised functions');

    // Size, "2 x 3" or "2.5 X 3".
    const sizeRaw = at(row, 'size');
    const m = sizeRaw.match(/^\s*([\d.]+)\s*[xX×]\s*([\d.]+)\s*$/);
    let footprint = null;
    if (!m) {
      problems.push(where + ': size "' + sizeRaw + '" is not in "length x depth" form, for example "2 x 3"');
    } else {
      const length = Number(m[1]);
      const depth = Number(m[2]);
      if (!(length > 0) || !(depth > 0)) problems.push(where + ': size "' + sizeRaw + '" has a zero or negative side');
      else footprint = { length, depth };
    }

    // Style, the training level.
    const levelRaw = at(row, 'style');
    const level = LEVEL_ALIASES[norm(levelRaw)];
    if (!level) {
      problems.push(
        where + ': style "' + levelRaw + '" is not recognised. Known: ' +
        [...new Set(Object.keys(LEVEL_ALIASES))].join(', ')
      );
    }

    // Budget ceiling. Tolerates "$4,000" as well as "4000".
    const budgetRaw = at(row, 'budget').replace(/[$,\s]/g, '');
    const budgetCeiling = Number(budgetRaw);
    if (!Number.isFinite(budgetCeiling) || budgetCeiling <= 0) {
      problems.push(where + ': budget "' + at(row, 'budget') + '" is not a positive number');
    }

    // The name column is optional and is "TBD" for every row today. An unnamed
    // bundle is not an error: bundles.js falls back to its own curated name,
    // and to a generated one for a bundle it has never seen.
    const nameRaw = at(row, 'bundlename');
    const name = nameRaw && norm(nameRaw) !== 'tbd' ? nameRaw : null;

    bundles.push({ id, functions, footprint, level, budgetCeiling, name, productUrls: [] });
  }

  if (!bundles.length) problems.push('the rules tab has no bundle rows');
  if (problems.length) throw new SheetError(problems);
  return bundles.sort((a, b) => a.id - b.id);
}

/* Tab 2, the product matrix ------------------------------------------------ */

/**
 * Parse the products tab into bundle id to ordered product URLs.
 *
 * The tab is transposed relative to the rules tab: bundles run across as
 * columns and products down as rows (A, B, C and an unlabelled fourth). Reading
 * rows top to bottom preserves the intended order, so the anchor machine in row
 * A stays first in the result page's product grid.
 */
export function parseProducts(csv) {
  const rows = parseCsv(csv);
  const head = findHeader(rows, ['product'], 'product matrix');

  // Map each column that holds a bundle number to that bundle.
  const colToBundle = new Map();
  rows[head].forEach((cell, i) => {
    const n = Number(String(cell).trim());
    if (Number.isInteger(n) && n >= 1) colToBundle.set(i, n);
  });

  if (!colToBundle.size) {
    throw new SheetError([
      'the product matrix header row ' + (head + 1) + ' has no bundle numbers across it'
    ]);
  }

  const problems = [];
  const byBundle = new Map([...colToBundle.values()].map((id) => [id, []]));

  for (let i = head + 1; i < rows.length; i++) {
    for (const [col, id] of colToBundle) {
      const cell = (rows[i][col] || '').trim();
      if (!cell) continue;
      if (!/^https?:\/\//i.test(cell)) {
        problems.push('product matrix row ' + (i + 1) + ', bundle ' + id + ': "' + cell + '" is not a URL');
        continue;
      }
      const list = byBundle.get(id);
      // A product listed twice in one column is a copy-paste slip, not an
      // instruction to charge for it twice.
      if (!list.includes(cell)) list.push(cell);
    }
  }

  if (problems.length) throw new SheetError(problems);
  return byBundle;
}

/* Tab 3, the personas ------------------------------------------------------ */

/**
 * Parse the personas tab.
 *
 * Nothing in the quiz reads these yet: the sheet has no column linking a
 * persona to a bundle, so wiring them to results would mean inventing that
 * mapping. They are carried through the sync so the copy is versioned alongside
 * everything else and is ready the moment that column exists.
 */
export function parsePersonas(csv) {
  const rows = parseCsv(csv);
  const out = [];
  for (const row of rows) {
    const name = (row[0] || '').trim();
    const body = (row[1] || '').trim();
    if (!name || !body) continue;
    if (norm(name) === 'persona') continue;   // a header row, if one is ever added

    // The body is a quote followed by the explanation, for example:
    //   "I just want to work out." Minimal setup, quick weight changes
    const m = body.match(/^["“](.+?)["”]\s*([\s\S]*)$/);
    out.push({
      name,
      quote: m ? m[1].trim() : null,
      description: m ? m[2].trim() : body
    });
  }
  return out;
}

/* Assembly ----------------------------------------------------------------- */

/**
 * Join the rules tab to the product matrix.
 *
 * A bundle with rules but no products cannot be priced or shown, so it is a
 * hard error rather than a bundle that silently renders as empty. A column of
 * products with no matching rules row is the same mistake seen from the other
 * side and fails just as loudly.
 */
export function buildSheetBundles(rulesCsv, productsCsv) {
  const bundles = parseRules(rulesCsv);
  const byBundle = parseProducts(productsCsv);
  const problems = [];

  for (const b of bundles) {
    const urls = byBundle.get(b.id);
    if (!urls || !urls.length) {
      problems.push('bundle ' + b.id + ' is defined on the rules tab but has no products in its column');
    } else {
      b.productUrls = urls;
    }
  }

  for (const id of byBundle.keys()) {
    if (!bundles.some((b) => b.id === id)) {
      problems.push('the product matrix has a column for bundle ' + id + ', but no rules row defines it');
    }
  }

  if (problems.length) throw new SheetError(problems);
  return bundles;
}
