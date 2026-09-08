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

/**
 * The Style column, sheet wording to internal tag.
 *
 * The sheet's Style column USED TO CARRY A TRAINING LEVEL (Beginner /
 * Intermediate / Advance). It now carries the customer style the bundle is
 * built for, drawn from the same five names as the Style tab. That is a
 * deliberate change of meaning, not a rename: level asked how strong someone
 * already is, style asks what they want out of the machine, which is what the
 * client's own personas describe and what actually separates these bundles.
 *
 * The full names are listed first, because those are what the sheet says. The
 * short forms after them are there so nobody has to type "Guided /
 * Accountability User" exactly to add a row.
 */
export const STYLE_ALIASES = {
  convenienceseeker: 'convenience',
  convenience: 'convenience',

  maximumfunctionuser: 'max_function',
  maximumfunction: 'max_function',
  maxfunction: 'max_function',

  seriousstrengthtrainer: 'strength',
  strengthtrainer: 'strength',
  strength: 'strength',

  guidedaccountabilityuser: 'guided',
  guidedaccountability: 'guided',
  accountability: 'guided',
  guided: 'guided',

  practicalvalueseeker: 'value',
  practicalvalue: 'value',
  valueseeker: 'value',
  practical: 'value',
  value: 'value'
};

/** Every style tag, in the order the quiz offers them. */
export const STYLE_TAGS = ['convenience', 'value', 'strength', 'max_function', 'guided'];

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

    // Style, one or more customer styles, comma or semicolon separated.
    //
    // SPLIT ON , AND ; ONLY, NEVER ON "/". Two of the five names contain a
    // slash ("Practical / Value Seeker", "Guided / Accountability User"), so
    // treating it as a separator would shred them into four unrecognised
    // fragments. Bundle 3 is the row that carries two styles today.
    const styleRaw = at(row, 'style');
    const styles = [];
    for (const part of styleRaw.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
      const tag = STYLE_ALIASES[norm(part)];
      if (!tag) {
        problems.push(
          where + ': style "' + part + '" is not recognised. Known: ' +
          [...new Set(Object.values(STYLE_ALIASES))].join(', ')
        );
      } else if (!styles.includes(tag)) {
        styles.push(tag);
      }
    }
    if (!styles.length && !styleRaw) problems.push(where + ': bundle ' + id + ' has no style');

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

    bundles.push({ id, functions, footprint, styles, budgetCeiling, name, productUrls: [] });
  }

  if (!bundles.length) problems.push('the rules tab has no bundle rows');
  if (problems.length) throw new SheetError(problems);
  return bundles.sort((a, b) => a.id - b.id);
}

/* Tab 2, the product matrix ------------------------------------------------ */

/**
 * Parse the products tab into bundle id to ordered product URLs.
 *
 * TWO LAYOUTS ARE ACCEPTED, because the client has used both.
 *
 *   ROW PER BUNDLE, which is what the sheet holds today. A header row naming
 *   "Bundle no", then one row per bundle: the number, an internal label, then
 *   the product URLs running left to right.
 *
 *     Bundle no | Name      | (url) | (url) | (url)
 *     1         | Tinytitan | .../tinytitan | .../bench | .../plates
 *
 *   COLUMN PER BUNDLE, the original shape. A header row naming "Product", with
 *   the bundle numbers running across it and the products down the rows.
 *
 *     Product # | 1 | 2
 *     A         | (url) | (url)
 *
 * Reading in the sheet's own order preserves the intended order either way, so
 * the anchor machine written first stays first in the result page's grid.
 *
 * Supporting both is cheap and it protects the promise the sheet is supposed to
 * make: rearranging a tab is a spreadsheet decision, not a code change.
 */
export function parseProducts(csv) {
  const rows = parseCsv(csv);
  const rowWise = rows.findIndex((r) => r.map(norm).some((c) => c === 'bundleno' || c === 'bundlenumber'));
  return rowWise >= 0 ? parseProductsByRow(rows, rowWise) : parseProductsByColumn(rows);
}

/** One row per bundle: number, internal label, then URLs left to right. */
function parseProductsByRow(rows, head) {
  const cells = rows[head].map(norm);
  const idCol = cells.findIndex((c) => c === 'bundleno' || c === 'bundlenumber');
  const nameCol = cells.findIndex((c) => c === 'name');

  const problems = [];
  const byBundle = new Map();

  for (let i = head + 1; i < rows.length; i++) {
    const row = rows[i];
    const idRaw = (row[idCol] || '').trim();
    if (!idRaw) continue;                       // blank spacer or a notes row

    const id = Number(idRaw);
    if (!Number.isInteger(id) || id < 1) {
      problems.push('product matrix row ' + (i + 1) + ': bundle number "' + idRaw + '" is not a positive whole number');
      continue;
    }
    if (byBundle.has(id)) {
      problems.push('product matrix row ' + (i + 1) + ': bundle ' + id + ' is listed more than once');
      continue;
    }

    const urls = [];
    for (let c = 0; c < row.length; c++) {
      if (c === idCol || c === nameCol) continue;
      const cell = (row[c] || '').trim();
      if (!cell) continue;
      if (!/^https?:\/\//i.test(cell)) {
        problems.push('product matrix row ' + (i + 1) + ', bundle ' + id + ': "' + cell + '" is not a URL');
        continue;
      }
      // A product listed twice in one row is a copy-paste slip, not an
      // instruction to charge for it twice.
      if (!urls.includes(cell)) urls.push(cell);
    }

    byBundle.set(id, { urls, label: nameCol >= 0 ? (row[nameCol] || '').trim() || null : null });
  }

  if (!byBundle.size) problems.push('the product matrix has no bundle rows under its header');
  if (problems.length) throw new SheetError(problems);
  return byBundle;
}

/** One column per bundle: bundle numbers across the header, products down. */
function parseProductsByColumn(rows) {
  const head = findHeader(rows, ['product'], 'product matrix');

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
  const byBundle = new Map([...colToBundle.values()].map((id) => [id, { urls: [], label: null }]));

  for (let i = head + 1; i < rows.length; i++) {
    for (const [col, id] of colToBundle) {
      const cell = (rows[i][col] || '').trim();
      if (!cell) continue;
      if (!/^https?:\/\//i.test(cell)) {
        problems.push('product matrix row ' + (i + 1) + ', bundle ' + id + ': "' + cell + '" is not a URL');
        continue;
      }
      const list = byBundle.get(id).urls;
      if (!list.includes(cell)) list.push(cell);
    }
  }

  if (problems.length) throw new SheetError(problems);
  return byBundle;
}

/* Tab 3, the styles -------------------------------------------------------- */

/**
 * Parse the styles tab, one record per customer style.
 *
 * These are the same five names the rules tab's Style column draws on, and
 * since that column now names them the quiz reads this tab for real: the copy
 * on the third question is the client's own wording, not a paraphrase of it.
 * Change the sentence in the sheet and the question changes with it.
 *
 * A style whose name does not map to a tag is kept rather than dropped, with a
 * null tag. It simply is not offered as an answer. That way an extra row of
 * notes on the tab cannot take the quiz down, while a real new style still
 * needs its tag added to STYLE_ALIASES before it can match anything.
 */
export function parsePersonas(csv) {
  const rows = parseCsv(csv);
  const out = [];
  for (const row of rows) {
    const name = (row[0] || '').trim();
    const body = (row[1] || '').trim();
    if (!name || !body) continue;
    if (norm(name) === 'persona' || norm(name) === 'style') continue;   // a header row, if one is ever added

    // The body is a quote followed by the explanation, for example:
    //   "I just want to work out." Minimal setup, quick weight changes
    const m = body.match(/^["“](.+?)["”]\s*([\s\S]*)$/);
    out.push({
      name,
      tag: STYLE_ALIASES[norm(name)] || null,
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
    const entry = byBundle.get(b.id);
    if (!entry || !entry.urls.length) {
      problems.push('bundle ' + b.id + ' is defined on the rules tab but has no products in its column');
    } else {
      b.productUrls = entry.urls;
      // The products tab's Name column is an INTERNAL SHORTHAND, not the
      // customer-facing name: it reads "bf900", "im2000", "xpress pro". The
      // name a shopper sees comes from the rules tab's "Bundle Name" column,
      // and falls back to the curated names in bundles.js while that column
      // still says TBD. This is carried only so sync logs and error messages
      // can say which bundle they mean in the client's own words.
      b.sheetLabel = entry.label;
    }
  }

  for (const id of byBundle.keys()) {
    if (!bundles.some((b) => b.id === id)) {
      problems.push('the product matrix has a row for bundle ' + id + ', but no rules row defines it');
    }
  }

  if (problems.length) throw new SheetError(problems);
  return bundles;
}
