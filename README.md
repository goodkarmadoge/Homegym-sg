# HomeGym.sg Teardown

A pro bono site and business review of [homegym.sg](https://homegym.sg), a Singapore home fitness equipment retailer, carried out on 16 August 2026.

**Live site:** https://goodkarmadoge.github.io/Homegym-sg/

## Contents

| Page | What it is |
|---|---|
| [`index.html`](index.html) | Cover page and summary |
| [`teardown.html`](teardown.html) | Twelve evidenced problems with the site and the operation, written for the business owner rather than a developer. Includes a prioritised order of work and seven automation projects. |
| [`messaging.html`](messaging.html) | Positioning and messaging brief: the gym-cost wedge, four value pillars, eight messaging lines graded, five objections with responses, and house-brand strategy. |
| [`prototype.html`](prototype.html) | A working concept homepage with a six-question quiz that sizes a gym build to the visitor's floor area, ceiling height and budget. |

## About the prototype

`prototype.html` is a **design concept, not a live HomeGym.sg page.** It cannot take orders. Prices tagged `LIVE PRICE` were verified against homegym.sg on 16 August 2026; everything else is a clearly-labelled placeholder that would bind to real catalogue data in production.

The recommendation engine is a rules engine running in the page. All 3,072 possible answer combinations were tested: nine distinct build outcomes, zero budget violations, no empty or malformed results.

## Scope and limitations

This is an **unsolicited external review**. Everything in it was observed from outside the business, as a customer would see it, with no access to analytics, revenue, margin or stock data. Findings are ranked by expected impact, not measured loss. Each document ends with a section setting out explicitly what was verified and what was inferred.

HomeGym.sg is an independent business. This review is not affiliated with, commissioned by, or endorsed by it.

## Search indexing

This site is served with `robots.txt` disallowing all crawlers and `noindex, nofollow` on every page. It is shareable by link but not intended to be discoverable through search.

## Layout

```
src/        page fragments (title + style + body) — the source of truth
scripts/    build, engine tests, output verification
dist/       generated site (gitignored, produced by the build)
```

## Commands

```bash
npm run build    # src/ -> dist/
npm test         # exercise the quiz engine across all 3,072 answer combinations
npm run verify   # validate dist/ structure, noindex tags and internal links
npm run check    # all three, in order — this is what CI and Vercel run

npm run check:images   # confirm every hotlinked HomeGym image still resolves
```

No dependencies; Node 20+ only.

### Images and logo

The HomeGym logo and all product photography are **hotlinked from HomeGym's own
CDN**, not copied into this repo. Nothing of theirs is redistributed here, and
the images stay current if they update them. The trade-off is that they can rot
if a URL changes, which is what `npm run check:images` is for. It is kept out of
`npm run check` on purpose: a HomeGym CDN outage should not be able to fail our
deploy.

## CI/CD

`.github/workflows/ci.yml` runs `npm run check` on every push and pull request. It fails the build if:

- any quiz answer combination produces an empty, malformed, duplicated or over-budget result
- a page is missing its doctype, `<head>`, `<title>` or noindex tags
- an absolute artifact URL leaks into the output
- any internal link points at a file that does not exist

On a green push to `main`, two deployments run from the same `dist/`:

| Host | URL |
|---|---|
| Vercel (production) | https://homegym-sg.vercel.app |
| GitHub Pages | https://goodkarmadoge.github.io/Homegym-sg/ |

Vercel runs the identical `npm run check` as its build command, so a broken commit fails to deploy rather than deploying broken.
