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
// replacement STRING, and `$'` inside `'S$' + value` is a special replacement
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
  const inline = page.slice(page.indexOf('<script>') + 8, page.indexOf('</script>')).trim();

  if (!inline) fail('bundle-quiz.html: no inline quiz bundle found');
  else if (inline !== standalone) {
    fail(
      'bundle-quiz.html: the inlined bundle does not match dist/homegym-bundle-quiz.min.js ' +
      `(${inline.length} vs ${standalone.length} chars), something mangled it during inlining`
    );
  }
  if (!/customElements\.define/.test(inline)) fail('bundle-quiz.html: inlined bundle never defines the element');
  if (!/<homegym-bundle-quiz\b/.test(page)) fail('bundle-quiz.html: the component is never mounted');
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
