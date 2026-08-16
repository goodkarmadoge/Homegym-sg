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

## Building

The pages are static HTML with no dependencies, no build step required to serve. They were generated from source documents by `build-site.mjs`, which wraps each in a full HTML document, injects the noindex tags, and rewrites cross-document links to relative paths.
