// Checks every externally-hotlinked image still resolves.
// Deliberately NOT part of `npm run check`: it depends on a third party's CDN,
// so a HomeGym outage should not be able to fail our deploy. Run it manually,
// or on a schedule, to catch image rot.
//
// Product image URLs are built at runtime by IMG(), so scanning the HTML for
// literals is not enough. The catalogue block is evaluated the same way
// test-engine.mjs evaluates the engine.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
const urls = new Map();   // url -> where it came from

// 1. Literal URLs sitting in the built HTML (logo lockups, etc).
for (const f of readdirSync(OUT).filter(f => f.endsWith('.html'))) {
  const html = readFileSync(join(OUT, f), 'utf8');
  for (const m of html.matchAll(/src="(https:\/\/d101vd00cis701\.cloudfront\.net\/[^"]+)"/g)) {
    urls.set(m[1], f);
  }
}

// 2. URLs constructed inside the prototype's catalogue.
const src = readFileSync(join(ROOT, 'src/prototype.html'), 'utf8');
const a = src.indexOf('/* ─────────── product imagery ───────────');
const b = src.indexOf('/* ─────────── questions ─────────── */');
if (a < 0 || b < 0) { console.error('catalogue markers not found in src/prototype.html'); process.exit(1); }
const { SHOP, C } = new Function(`${src.slice(a, b)}\nreturn {SHOP, C};`)();

SHOP.forEach(s => { if (s.img) urls.set(s.img, 'SHOP grid'); });
Object.entries(C).forEach(([k, v]) => { if (v.img) urls.set(v.img, `catalogue.${k}`); });

const list = [...urls.keys()];
console.log(`checking ${list.length} hotlinked images\n`);

const results = await Promise.all(list.map(async u => {
  try {
    const r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    return { u, status: r.status, type: r.headers.get('content-type') || '' };
  } catch (e) {
    return { u, status: 0, type: 'ERR ' + e.message };
  }
}));

for (const r of results.sort((x, y) => x.status - y.status)) {
  const short = r.u.replace(/^https:\/\/d101vd00cis701\.cloudfront\.net\//, '').slice(-58);
  const ok = r.status === 200 && r.type.startsWith('image/');
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${String(r.status).padEnd(4)} ${short}   [${urls.get(r.u)}]`);
}

const bad = results.filter(r => !(r.status === 200 && r.type.startsWith('image/')));
if (bad.length) {
  console.error(`\n${bad.length} of ${list.length} image(s) not resolving`);
  process.exit(1);
}
console.log(`\nall ${list.length} images resolve as images`);
