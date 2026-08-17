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

  // Every internal link must resolve to a real file.
  for (const l of new Set([...h.matchAll(/href="([a-z0-9._-]+\.html)"/gi)].map(m => m[1]))) {
    if (!existsSync(join(OUT, l))) fail(`${p.file}: broken internal link -> ${l}`);
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
