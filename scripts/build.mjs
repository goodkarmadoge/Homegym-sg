// Builds the deployable site from the fragments in src/.
// Each source file is a <title> + <style> + body fragment; this wraps them into
// complete documents, injects the noindex tags, and writes them to the repo root.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

export const PAGES = [
  { file: 'index.html', emoji: '🏠',
    desc: 'A pro bono site and business teardown of HomeGym.sg, with a positioning brief and a working guided-selling prototype.' },
  { file: 'teardown.html', emoji: '🔍',
    desc: 'Plain-English review of homegym.sg for the owner: twelve problems, a three-thing shortlist, and seven jobs a machine could take over.' },
  { file: 'messaging.html', emoji: '💬',
    desc: 'Positioning and messaging: the gym-cost wedge, four value pillars, graded lines, five objections and the leaking funnel.' },
  { file: 'prototype.html', emoji: '🏋️',
    desc: 'Concept landing page with a six-question quiz that sizes a gym build to your floor, ceiling and budget.' },
];

const RESET = `*,*::before,*::after{box-sizing:border-box}html{-moz-text-size-adjust:none;-webkit-text-size-adjust:none;text-size-adjust:none}body{margin:0}img,picture,svg,video{max-width:100%}input,button,textarea,select{font:inherit}`;

const favicon = e =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${e}</text></svg>`)}`;

export function buildPage({ title, style, body, desc, emoji }) {
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

function main() {
  for (const p of PAGES) {
    const raw = readFileSync(join(SRC, p.file), 'utf8');
    const title = (raw.match(/<title>([\s\S]*?)<\/title>/) || [, 'HomeGym.sg'])[1].trim();
    const style = (raw.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
    const body = raw
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace(/<style>[\s\S]*?<\/style>/, '')
      .trim();

    writeFileSync(join(ROOT, p.file), buildPage({ title, style, body, desc: p.desc, emoji: p.emoji }));
    console.log(`built ${p.file.padEnd(16)} ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB  "${title}"`);
  }

  writeFileSync(join(ROOT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(ROOT, '.nojekyll'), '');
  console.log('\nbuilt robots.txt and .nojekyll');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
