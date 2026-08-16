import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = join(SRC, 'site');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// artifact URL -> local page
const LINKS = {
  'https://claude.ai/code/artifact/4014cb8a-6578-4b55-9020-e15a7b00bb49': 'teardown.html',
  'https://claude.ai/code/artifact/ad05b8ed-4d0a-415c-a7eb-09c2f2b1d7d5': 'messaging.html',
  'https://claude.ai/code/artifact/ae30bf39-f57a-4bf3-adec-55f3080080c6': 'prototype.html',
};

const PAGES = [
  { src: 'homegym-index.html',     out: 'index.html',     emoji: '🏠',
    desc: 'A pro bono site and business teardown of HomeGym.sg, with a positioning brief and a working guided-selling prototype.' },
  { src: 'homegym-audit.html',     out: 'teardown.html',  emoji: '🔍',
    desc: 'Plain-English review of homegym.sg for the owner: twelve problems, a three-thing shortlist, and seven jobs a machine could take over.' },
  { src: 'homegym-messaging.html', out: 'messaging.html', emoji: '💬',
    desc: 'Positioning and messaging: the gym-cost wedge, four value pillars, graded lines, five objections and the leaking funnel.' },
  { src: 'homegym-prototype.html', out: 'prototype.html', emoji: '🏋️',
    desc: 'Concept landing page with a six-question quiz that sizes a gym build to your floor, ceiling and budget.' },
];

const favicon = e =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${e}</text></svg>`)}`;

const RESET = `*,*::before,*::after{box-sizing:border-box}html{-moz-text-size-adjust:none;-webkit-text-size-adjust:none;text-size-adjust:none}body{margin:0}img,picture,svg,video{max-width:100%}input,button,textarea,select{font:inherit}`;

function wrap({ title, style, body, desc, emoji }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="googlebot" content="noindex, nofollow">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<link rel="icon" href="${favicon(emoji)}">
<style>${RESET}</style>
${style}
</head>
<body>
${body}
</body>
</html>
`;
}

let rewrites = 0;
for (const p of PAGES) {
  let raw = readFileSync(join(SRC, p.src), 'utf8');

  for (const [url, local] of Object.entries(LINKS)) {
    const before = raw;
    raw = raw.split(url).join(local);
    if (before !== raw) rewrites++;
  }

  const title = (raw.match(/<title>([\s\S]*?)<\/title>/) || [, 'HomeGym.sg'])[1].trim();
  const styleMatch = raw.match(/<style>[\s\S]*?<\/style>/);
  const style = styleMatch ? styleMatch[0] : '';
  const body = raw
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .trim();

  writeFileSync(join(OUT, p.out), wrap({ title, style, body, desc: p.desc, emoji: p.emoji }));
  console.log(`built ${p.out.padEnd(16)} ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB  "${title}"`);
}

writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`\nartifact links rewritten to local paths: ${rewrites}`);
