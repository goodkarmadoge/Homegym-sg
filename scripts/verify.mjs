// Validates the built site. Fails the build on anything that would ship broken.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
const problems = [];
const fail = m => problems.push(m);

for (const p of PAGES) {
  const path = join(OUT, p.file);
  if (!existsSync(path)) { fail(`${p.file}: missing from dist/`); continue; }
  const h = readFileSync(path, 'utf8');

  if (!h.startsWith('<!doctype html>'))            fail(`${p.file}: missing doctype`);
  if ((h.match(/<html/g) || []).length !== 1)      fail(`${p.file}: expected exactly one <html>`);
  if ((h.match(/<head>/g) || []).length !== 1)     fail(`${p.file}: expected exactly one <head>`);
  if ((h.match(/<title>/g) || []).length !== 1)    fail(`${p.file}: expected exactly one <title>`);
  if (!/<body>[\s\S]*<\/body>/.test(h))            fail(`${p.file}: missing body`);
  if (!/name="robots" content="noindex/.test(h))   fail(`${p.file}: missing noindex robots meta`);
  if (!/name="googlebot" content="noindex/.test(h))fail(`${p.file}: missing googlebot noindex meta`);
  if (h.indexOf('<style>') > h.indexOf('<body>'))  fail(`${p.file}: style leaked into body`);

  // No stale absolute links back to the Claude artifact hosts.
  const leaked = h.match(/https:\/\/claude\.ai\/code\/artifact\/[a-f0-9-]+/g);
  if (leaked) fail(`${p.file}: ${leaked.length} un-rewritten artifact URL(s)`);

  // Scroll-reveal must never hide content unless JS has already proven it can
  // put it back. A bare `.rise{opacity:0}` renders the page blank whenever
  // IntersectionObserver is unavailable, throws, or never fires.
  for (const [, rawSel, decls] of h.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const hidesUnscoped = rawSel
      .replace(/\/\*[\s\S]*?\*\//g, '')        // drop any comment above the rule
      .split(',')
      .some(s => s.trim() === '.rise');        // bare .rise, not html.reveal .rise
    if (hidesUnscoped && /opacity\s*:\s*0(?![.\d])/.test(decls)) {
      fail(`${p.file}: unguarded ".rise{opacity:0}", scope the hidden state to a JS-applied class, or the page renders blank whenever IntersectionObserver never fires`);
    }
  }

  // Every internal link must resolve to a real file.
  for (const l of new Set([...h.matchAll(/href="([a-z0-9._-]+\.html)"/gi)].map(m => m[1]))) {
    if (!existsSync(join(OUT, l))) fail(`${p.file}: broken internal link -> ${l}`);
  }
}

// The quiz bundle is inlined into bundle-quiz.html and also emitted on its own.
// The two must be byte-identical.
//
// This exists because they once were not: build.mjs inlined the bundle with a
// replacement STRING, and `$'` inside `'$' + value` is a special replacement
// pattern meaning "everything after the match". It ate the closing quote, and
// the page shipped with a script that would not parse, while the standalone
// file was perfectly fine. Comparing the two catches any repeat instantly.
const embedPath = join(OUT, 'homegym-bundle-quiz.min.js');
const quizPage = join(OUT, 'bundle-quiz.html');
if (!existsSync(embedPath)) {
  fail('homegym-bundle-quiz.min.js: missing from dist/');
} else if (existsSync(quizPage)) {
  const standalone = readFileSync(embedPath, 'utf8').trim();
  const page = readFileSync(quizPage, 'utf8');

  // Find the bundle by what it IS, not by where it sits.
  //
  // This used to take the first <script> on the page, which quietly made script
  // ORDER part of the contract: the page now carries two more inline scripts,
  // and the analytics bridge has to run BEFORE the bundle or it misses
  // quiz:start, which fires during element upgrade. Under the old rule, moving
  // it there made verify compare the bridge against the bundle and fail with a
  // length mismatch that said nothing about the real cause.
  const blocks = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());
  const inline = blocks.find((b) => /customElements\.define/.test(b)) || '';

  if (!inline) fail('bundle-quiz.html: no inline quiz bundle found (no inline script defines the element)');
  else if (inline !== standalone) {
    fail(
      'bundle-quiz.html: the inlined bundle does not match dist/homegym-bundle-quiz.min.js ' +
      `(${inline.length} vs ${standalone.length} chars), something mangled it during inlining`
    );
  }
  // Exactly one, not merely at least one: two copies of the bundle would each
  // define the element and each fire quiz:start, double-counting every session
  // in the client's analytics while the page still looked perfectly fine.
  const defining = blocks.filter((b) => /customElements\.define/.test(b)).length;
  if (defining > 1) fail(`bundle-quiz.html: the bundle is inlined ${defining} times, it must appear exactly once`);

  if (!/<homegym-bundle-quiz\b/.test(page)) fail('bundle-quiz.html: the component is never mounted');

  // The analytics bridge must run BEFORE the bundle. quiz:start is emitted
  // during element upgrade, which happens the moment the bundle calls
  // customElements.define, so a bridge registered after it never hears the
  // event and the client's funnel loses its denominator. Caught in the browser,
  // not in review: everything else arrived and only quiz:start was missing.
  //
  // Compared by SCRIPT BLOCK, not by position in the raw page. Searching the
  // page text finds these strings inside the HTML comments that explain them,
  // and the comment sits above the code it describes: the first version of this
  // check failed the build on a correctly ordered page because it matched its
  // own documentation.
  const bridgeIdx = blocks.findIndex((b) => /homegym-quiz:event/.test(b));
  const bundleIdx = blocks.findIndex((b) => /customElements\.define/.test(b));
  if (bridgeIdx === -1) fail('bundle-quiz.html: the analytics bridge is missing, the iframe embed would report nothing');
  else if (bundleIdx !== -1 && bridgeIdx > bundleIdx) {
    fail('bundle-quiz.html: the analytics bridge runs after the quiz bundle, so it will miss quiz:start');
  }
}

// ── The quiz page must stay framable by homegym.sg ─────────────────────────
//
// The whole point of bundle-quiz.html is to be embedded, and the README hands
// the client an iframe snippet pointing at this deployment. A response header
// that forbids cross-origin framing makes that snippet impossible: the browser
// refuses to render the frame and shows an empty box with a console error, on
// the client's live site, with nothing in this repo failing.
//
// It shipped that way. `X-Frame-Options: SAMEORIGIN` sat on `/(.*)` while the
// README told them to iframe it from homegym.sg. This is the guard so it
// cannot happen twice.
//
// X-Frame-Options has no working allowlist: ALLOW-FROM is obsolete and ignored
// by every current browser, and where both headers are present XFO wins. So
// the only header that can express "homegym.sg may frame this" is CSP
// frame-ancestors, and XFO must be absent rather than merely permissive.
const EMBED_HOSTS = ['https://homegym.sg', 'https://www.homegym.sg'];
const vercelPath = join(ROOT, 'vercel.json');
if (!existsSync(vercelPath)) {
  fail('vercel.json: missing, cannot verify the quiz stays framable');
} else {
  const headers = (JSON.parse(readFileSync(vercelPath, 'utf8')).headers || [])
    .flatMap((rule) => (rule.headers || []).map((h) => [h.key.toLowerCase(), h.value]));

  const xfo = headers.find(([k]) => k === 'x-frame-options');
  if (xfo) {
    fail(
      `vercel.json: X-Frame-Options "${xfo[1]}" blocks the iframe embed the README documents. ` +
      'It has no allowlist form that browsers honour, so remove it and express the policy ' +
      'with Content-Security-Policy frame-ancestors instead'
    );
  }

  const csp = headers.filter(([k]) => k === 'content-security-policy').map(([, v]) => v).join('; ');
  const ancestors = /frame-ancestors([^;]*)/.exec(csp);
  if (!ancestors) {
    fail('vercel.json: no Content-Security-Policy frame-ancestors, so nothing states who may embed the quiz');
  } else {
    const allowed = ancestors[1].trim();
    const missing = EMBED_HOSTS.filter((h) => !allowed.includes(h));
    if (allowed.includes("'none'")) {
      fail("vercel.json: frame-ancestors 'none' forbids the embed this page exists for");
    } else if (missing.length) {
      fail(`vercel.json: frame-ancestors does not permit ${missing.join(' or ')}, so the embed on the live site would be refused`);
    }
  }
}

if (!existsSync(join(OUT, 'robots.txt'))) fail('robots.txt: missing');
else if (!/Disallow: \//.test(readFileSync(join(OUT, 'robots.txt'), 'utf8')))
  fail('robots.txt: does not disallow crawling');

if (problems.length) {
  console.error(`\nverify FAILED (${problems.length}):`);
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log(`verify OK: ${PAGES.length} pages, structure + noindex + links all valid`);
