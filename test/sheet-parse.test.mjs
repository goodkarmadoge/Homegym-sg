// Guards the Google Sheet reader.
//
// The sheet is edited by hand by people who are not looking at this code, so
// the interesting cases are not the happy path. They are: a column moved, a
// word typed differently, a row half-filled. Each of those must either be
// understood or refused with a message that says which cell is wrong. Silently
// dropping a bundle would take it out of the quiz with nothing to show for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, parseRules, parseProducts, parsePersonas,
  buildSheetBundles, SheetError
} from '../src/quiz/sheet-parse.js';
import { SHEET_BUNDLES } from '../src/quiz/sheet-data.js';
import { BUNDLES, PRODUCTS_BY_URL, STYLE_OPTIONS, composeBundles } from '../src/quiz/bundles.js';

const RULES = [
  ',,,,,',
  'Functions,Size,Style,Budget,Bundle,Bundle Name',
  'smith;power rack;cable,2 x 3,Practical / Value Seeker,3000,1,TBD',
  'Cable;smart,1 x 2,Guided / Accountability User,6000,2,The Quiet One'
].join('\n');

/** assert.throws does not hand the error back, and these tests are about what
 *  the message actually says, so catch it explicitly. */
const caught = (fn) => {
  try { fn(); } catch (e) { return e; }
  throw new Error('expected a throw, got none');
};

const A = 'https://homegym.sg/a.html';
const B = 'https://homegym.sg/b.html';

/** The layout the sheet holds today: one row per bundle, URLs running across. */
const PRODUCTS_CSV = [
  'Bundle no,Name,,,',
  `1,Tinytitan,${A},${B}`,
  `2,Cube,${B},`
].join('\n');

/** The original layout: one column per bundle, products running down. */
const PRODUCTS_CSV_BY_COLUMN = [
  'Product #,1,2',
  `A,${A},${B}`,
  `B,${B},`
].join('\n');

/* CSV ---------------------------------------------------------------------- */

test('the CSV reader handles quotes, embedded commas and embedded newlines', () => {
  const rows = parseCsv('a,"b,1",c\n"multi\nline","say ""hi""",z');
  assert.deepEqual(rows[0], ['a', 'b,1', 'c']);
  assert.deepEqual(rows[1], ['multi\nline', 'say "hi"', 'z']);
});

test('the CSV reader does not invent a trailing row from a trailing newline', () => {
  assert.equal(parseCsv('a,b\nc,d\n').length, 2);
});

test('CRLF from Google does not leak into the last field of a row', () => {
  assert.deepEqual(parseCsv('a,b\r\nc,d')[0], ['a', 'b']);
});

/* Rules -------------------------------------------------------------------- */

test('the rules tab parses into bundles, skipping the blank spacer row', () => {
  const out = parseRules(RULES);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].functions, ['smith', 'power_rack', 'cable']);
  assert.deepEqual(out[0].footprint, { length: 2, depth: 3 });
  assert.deepEqual(out[0].styles, ['value']);
  assert.equal(out[0].budgetCeiling, 3000);
});

// Two of the five style names contain a slash. Splitting on it would shred
// "Practical / Value Seeker" into two unrecognised fragments, so the separators
// are comma and semicolon only.
test('a style name containing a slash survives intact', () => {
  assert.deepEqual(parseRules(RULES)[1].styles, ['guided']);
});

test('a bundle can be assigned more than one style, comma separated', () => {
  const csv = [
    'Functions,Size,Style,Budget,Bundle',
    'cable,2 x 2,"Maximum Function User,Serious Strength Trainer",3000,1'
  ].join('\n');
  assert.deepEqual(parseRules(csv)[0].styles, ['max_function', 'strength']);
});

test('an unrecognised style is refused, and the message names it', () => {
  const csv = ['Functions,Size,Style,Budget,Bundle', 'cable,2 x 2,Wizard,3000,1'].join('\n');
  const err = caught(() => parseRules(csv));
  assert.ok(err instanceof SheetError);
  assert.match(err.problems[0], /Wizard/);
  assert.match(err.problems[0], /convenience/);
});

test('"TBD" is not a name, but a real name is kept', () => {
  const out = parseRules(RULES);
  assert.equal(out[0].name, null, 'TBD should leave the curated name in place');
  assert.equal(out[1].name, 'The Quiet One');
});

// This is the property that makes the sheet safe to edit: someone inserting a
// column or dragging one left must not silently shift every field by one.
test('columns are found by name, so reordering them changes nothing', () => {
  const shuffled = [
    'Bundle,Budget,Bundle Name,Style,Size,Functions',
    '1,3000,TBD,Practical / Value Seeker,2 x 3,smith;power rack;cable'
  ].join('\n');
  const [a] = parseRules(shuffled);
  const [b] = parseRules(RULES);
  assert.deepEqual(a.functions, b.functions);
  assert.deepEqual(a.footprint, b.footprint);
  assert.equal(a.budgetCeiling, b.budgetCeiling);
});

test('function and style wording is case and punctuation tolerant', () => {
  const csv = [
    'Functions,Size,Style,Budget,Bundle',
    'POWER_RACK;Leg Press,2 x 2,convenience seeker,3000,1'
  ].join('\n');
  const [b] = parseRules(csv);
  assert.deepEqual(b.functions, ['power_rack', 'leg_press']);
  assert.deepEqual(b.styles, ['convenience']);
});

test('a budget typed as $4,000 is still four thousand', () => {
  const csv = ['Functions,Size,Style,Budget,Bundle', 'cable,2 x 2,Convenience Seeker,"$4,000",1'].join('\n');
  assert.equal(parseRules(csv)[0].budgetCeiling, 4000);
});

test('an unknown function is refused, and the message names the cell and the options', () => {
  const csv = ['Functions,Size,Style,Budget,Bundle', 'trampoline,2 x 2,Convenience Seeker,3000,1'].join('\n');
  const err = caught(() => parseRules(csv));
  assert.ok(err instanceof SheetError);
  assert.match(err.problems[0], /row 2/);
  assert.match(err.problems[0], /trampoline/);
  assert.match(err.problems[0], /power_rack/);
});

test('a malformed size is refused rather than guessed at', () => {
  const csv = ['Functions,Size,Style,Budget,Bundle', 'cable,about 2m,Convenience Seeker,3000,1'].join('\n');
  assert.throws(() => parseRules(csv), /not in "length x depth" form/);
});

test('every problem is reported at once, not just the first', () => {
  const csv = [
    'Functions,Size,Style,Budget,Bundle',
    'trampoline,nonsense,Wizard,free,1'
  ].join('\n');
  const err = caught(() => parseRules(csv));
  assert.ok(err instanceof SheetError);
  assert.ok(err.problems.length >= 4, `expected 4+ problems, got ${err.problems.length}`);
});

test('a duplicated bundle number is refused', () => {
  const csv = [
    'Functions,Size,Style,Budget,Bundle',
    'cable,2 x 2,Convenience Seeker,3000,1',
    'smith,2 x 2,Convenience Seeker,3000,1'
  ].join('\n');
  assert.throws(() => parseRules(csv), /listed more than once/);
});

/* Products ----------------------------------------------------------------- */

test('the product matrix reads across each bundle row, keeping column order', () => {
  const out = parseProducts(PRODUCTS_CSV);
  assert.deepEqual(out.get(1).urls, [A, B], 'the first URL must stay first, it is the anchor machine');
  assert.deepEqual(out.get(2).urls, [B]);
});

// The client has used both layouts. Rearranging a tab is a spreadsheet
// decision, so both must read the same, rather than one of them being a
// migration that needs a code change to land.
test('the original column-per-bundle layout still reads identically', () => {
  const out = parseProducts(PRODUCTS_CSV_BY_COLUMN);
  assert.deepEqual(out.get(1).urls, [A, B]);
  assert.deepEqual(out.get(2).urls, [B]);
});

test('the products tab carries the internal label, which is not the shown name', () => {
  const out = parseProducts(PRODUCTS_CSV);
  assert.equal(out.get(1).label, 'Tinytitan');
  assert.equal(parseProducts(PRODUCTS_CSV_BY_COLUMN).get(1).label, null);
});

test('a product pasted twice into one bundle is counted once, not charged twice', () => {
  const out = parseProducts(['Bundle no,Name,,', `1,Twice,${A},${A}`].join('\n'));
  assert.deepEqual(out.get(1).urls, [A]);
});

test('a non-URL in the product matrix is refused, in either layout', () => {
  assert.throws(() => parseProducts(['Bundle no,Name,', '1,Nope,ask Derek'].join('\n')), /is not a URL/);
  assert.throws(() => parseProducts(['Product #,1', 'A,ask Derek'].join('\n')), /is not a URL/);
});

test('a duplicated bundle row in the product matrix is refused', () => {
  const csv = ['Bundle no,Name,', `1,One,${A}`, `1,Again,${B}`].join('\n');
  assert.throws(() => parseProducts(csv), /listed more than once/);
});

/* Assembly ----------------------------------------------------------------- */

test('rules and products are joined by bundle number', () => {
  const out = buildSheetBundles(RULES, PRODUCTS_CSV);
  assert.deepEqual(out.find((b) => b.id === 1).productUrls, [A, B]);
});

// "bf900" and "im2000" are how the client refers to these internally. Showing
// one as the headline on a result page would be a regression in the copy, so
// the label is carried for diagnostics and the shown name stays with the rules
// tab's "Bundle Name" column and the curated names behind it.
test('the products tab label is carried as a label, not promoted to the name', () => {
  const [first] = buildSheetBundles(RULES, PRODUCTS_CSV);
  assert.equal(first.sheetLabel, 'Tinytitan');
  assert.equal(first.name, null, 'TBD in the rules tab must still mean "no name yet"');
});

test('a bundle with rules but no products fails loudly instead of shipping empty', () => {
  assert.throws(() => buildSheetBundles(RULES, ['Bundle no,Name,', `1,Tinytitan,${A}`].join('\n')),
    /bundle 2 is defined on the rules tab but has no products/);
});

test('a product row with no rules row fails too', () => {
  const rules = ['Functions,Size,Style,Budget,Bundle', 'cable,2 x 2,Convenience Seeker,3000,1'].join('\n');
  assert.throws(() => buildSheetBundles(rules, PRODUCTS_CSV), /row for bundle 2, but no rules row/);
});

/* Personas ----------------------------------------------------------------- */

test('styles split into the quote and the explanation', () => {
  const [p] = parsePersonas('Convenience Seeker,"""I just want to work out."" Minimal setup"');
  assert.equal(p.name, 'Convenience Seeker');
  assert.equal(p.quote, 'I just want to work out.');
  assert.equal(p.description, 'Minimal setup');
});

// This is what wires the tab to the rules column: without a tag the style can
// be read but never matched, so it must not be offered as an answer either.
test('a style carries the tag the rules column assigns bundles by', () => {
  const [p] = parsePersonas('Practical / Value Seeker,"""Enough."" Value for money"');
  assert.equal(p.tag, 'value');
});

test('a style the matcher has no tag for is kept but left untagged', () => {
  const [p] = parsePersonas('Weekend Warrior,"""Saturdays only."" Trains twice a week"');
  assert.equal(p.name, 'Weekend Warrior');
  assert.equal(p.tag, null);
});

// Every style offered as an answer has to be reachable, or the quiz promises a
// match it cannot make.
test('every style the quiz offers is assigned to at least one bundle', () => {
  const assigned = new Set(SHEET_BUNDLES.flatMap((b) => b.styles));
  for (const o of STYLE_OPTIONS) {
    assert.ok(assigned.has(o.value), `no bundle in the sheet is built for "${o.label}"`);
  }
});

test('every bundle in the sheet is assigned at least one style', () => {
  for (const b of SHEET_BUNDLES) {
    assert.ok(b.styles.length, `bundle ${b.id} (${b.sheetLabel}) has no style`);
  }
});

/* Composition against the real catalogue ----------------------------------- */

test('every product URL in the committed sheet data resolves to a catalogue entry', () => {
  for (const b of SHEET_BUNDLES) {
    for (const url of b.productUrls) {
      assert.ok(PRODUCTS_BY_URL[url], `bundle ${b.id}: no catalogue product for ${url}`);
    }
  }
});

test('each bundle price is exactly the sum of its products, never a typed-in figure', () => {
  for (const b of BUNDLES) {
    const sum = b.products.reduce((t, id) => t + PRODUCTS_BY_URL[
      Object.values(PRODUCTS_BY_URL).find((p) => p.id === id).url
    ].price, 0);
    assert.equal(b.price, sum, `bundle ${b.id} price does not reconcile`);
  }
});

// The whole point of the change: a new row in the spreadsheet becomes a working
// bundle without anyone touching the code.
test('a bundle added to the sheet with no copy written yet still composes', () => {
  const known = Object.values(PRODUCTS_BY_URL)[0];
  const { bundles, problems } = composeBundles([{
    id: 999,
    name: null,
    functions: ['cable'],
    footprint: { length: 2, depth: 2 },
    styles: ['value'],
    budgetCeiling: 9000,
    productUrls: [known.url]
  }]);

  assert.equal(problems.length, 0);
  const b = bundles[0];
  assert.equal(b.name, 'Bundle 999', 'an unnamed bundle needs a usable fallback name');
  assert.equal(b.price, known.price, 'it must price itself from the catalogue');
  assert.ok(b.tagline.length > 0, 'it needs a tagline to render');
  assert.ok(b.pitch.includes(known.name), 'the generated pitch should say what is in it');
  assert.deepEqual(b.trains, [], 'no invented movement list');
});

test('a bundle naming a product not in the catalogue fails the build', () => {
  assert.throws(() => composeBundles([{
    id: 998, name: null, functions: ['cable'],
    footprint: { length: 2, depth: 2 }, styles: ['value'], budgetCeiling: 9000,
    productUrls: ['https://homegym.sg/does-not-exist.html']
  }]), /no product in the catalogue matches/);
});

// The live-fetch path must never take the whole quiz down over one bad row.
test('in lenient mode a broken bundle is dropped and the rest survive', () => {
  const known = Object.values(PRODUCTS_BY_URL)[0];
  const { bundles, problems } = composeBundles([
    { id: 1, name: null, functions: ['cable'], footprint: { length: 2, depth: 2 },
      styles: ['value'], budgetCeiling: 9000, productUrls: ['https://homegym.sg/nope.html'] },
    { id: 2, name: null, functions: ['cable'], footprint: { length: 2, depth: 2 },
      styles: ['value'], budgetCeiling: 9000, productUrls: [known.url] }
  ], { strict: false });

  assert.equal(bundles.length, 1, 'only the broken bundle should be dropped');
  assert.equal(bundles[0].id, 2);
  assert.equal(problems.length, 1);
});
