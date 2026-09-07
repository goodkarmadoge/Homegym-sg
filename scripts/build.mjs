// Builds the deployable site from the fragments in src/.
// Each source file is a <title> + <style> + body fragment; this wraps them into
// complete documents, injects the noindex tags, and writes them to the repo root.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle as buildQuizBundle, SIZE_LIMIT } from './build-quiz.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
export const OUT = join(ROOT, 'dist');

export const PAGES = [
  { file: 'index.html', emoji: '🏠',
    desc: 'A pro bono site and business teardown of HomeGym.sg, with a positioning brief and a working guided-selling prototype.' },
  { file: 'teardown.html', emoji: '🔍',
    desc: 'Plain-English review of homegym.sg for the owner: twelve problems, a three-thing shortlist, and seven jobs a machine could take over.' },
  { file: 'messaging.html', emoji: '💬',
    desc: 'Positioning and messaging: the gym-cost wedge, four value pillars, graded lines, five objections and the leaking funnel.' },
  { file: 'prototype.html', emoji: '🏋️',
    desc: 'Concept landing page with a six-question quiz that sizes a gym build to your floor, ceiling and budget.' },
  { file: 'bundle-quiz.html', emoji: '🎯',
    desc: 'Four questions about function, floor space, level and budget, matched to a complete priced home gym bundle.',
    // Archivo 400/600/800, the Modernist system's only family. Loaded here so
    // it is available inside the shadow root too: font loading is
    // document-scoped, not tree-scoped.
    head: '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
          '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap">\n' },
];

// The dev-time module tag in src/bundle-quiz.html, swapped for the inlined
// single-file bundle at build time. Kept as one exact string so a rename in the
// fragment fails the build loudly instead of shipping a page with no quiz.
const QUIZ_SCRIPT_TAG = '<script type="module" src="quiz/homegym-bundle-quiz.js"></script>';

const RESET = `*,*::before,*::after{box-sizing:border-box}html{-moz-text-size-adjust:none;-webkit-text-size-adjust:none;text-size-adjust:none}body{margin:0}img,picture,svg,video{max-width:100%}input,button,textarea,select{font:inherit}`;

const favicon = e =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${e}</text></svg>`)}`;

export function buildPage({ title, style, body, desc, emoji, head = '' }) {
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
${head}<style>${RESET}</style>
${style}
</head>
<body>
${body}
</body>
</html>
`;
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // Built once and used twice: inlined into bundle-quiz.html so the page is
  // self-contained, and emitted as its own file so any Homegym.sg page can
  // embed the quiz with a single <script src> tag.
  const quizBundle = buildQuizBundle();
  const quizBytes = Buffer.byteLength(quizBundle);
  if (quizBytes > SIZE_LIMIT) {
    console.error(`quiz bundle is ${(quizBytes / 1024).toFixed(1)} KB, over the ${SIZE_LIMIT / 1024} KB budget`);
    process.exit(1);
  }
  writeFileSync(join(OUT, 'homegym-bundle-quiz.min.js'), quizBundle);

  for (const p of PAGES) {
    const raw = readFileSync(join(SRC, p.file), 'utf8');
    const title = (raw.match(/<title>([\s\S]*?)<\/title>/) || [, 'HomeGym.sg'])[1].trim();
    const style = (raw.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
    let body = raw
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace(/<style>[\s\S]*?<\/style>/, '')
      .trim();

    if (p.file === 'bundle-quiz.html') {
      if (!body.includes(QUIZ_SCRIPT_TAG)) {
        console.error(`${p.file}: the quiz module tag is missing, expected exactly:\n  ${QUIZ_SCRIPT_TAG}`);
        process.exit(1);
      }
      // Replacer FUNCTION, not a replacement string: the bundle contains
      // `'S$' + value` for the SGD prefix, and in a replacement string `$'`
      // means "everything after the match", it silently ate the quote and
      // shipped a page whose script would not parse.
      body = body.replace(QUIZ_SCRIPT_TAG, () => `<script>\n${quizBundle}\n</script>`);
    }

    writeFileSync(join(OUT, p.file), buildPage({ title, style, body, desc: p.desc, emoji: p.emoji, head: p.head }));
    console.log(`built dist/${p.file.padEnd(18)} ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB  "${title}"`);
  }

  console.log(`built dist/${'homegym-bundle-quiz.min.js'.padEnd(18)} ${(quizBytes / 1024).toFixed(0)} KB  embeddable component`);

  writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(OUT, '.nojekyll'), '');
  console.log('\nbuilt dist/robots.txt and dist/.nojekyll');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
