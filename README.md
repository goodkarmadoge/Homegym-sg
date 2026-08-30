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
| [`bundle-quiz.html`](bundle-quiz.html) | A standalone four-question quiz matching the visitor to one of ten priced bundles built from real catalogue products. Also ships as an embeddable web component. |

## About the prototype

`prototype.html` is a **design concept, not a live HomeGym.sg page.** It cannot take orders. Prices tagged `LIVE PRICE` were verified against homegym.sg on 16 August 2026; everything else is a clearly-labelled placeholder that would bind to real catalogue data in production.

The recommendation engine is a rules engine running in the page. All 3,072 possible answer combinations were tested: nine distinct build outcomes, zero budget violations, no empty or malformed results.

---

# The bundle quiz

`bundle-quiz.html` is a **standalone page**. It carries no site navigation and links to nothing else in this engagement, so it can be deployed on its own at `homegym.sg/bundle-quiz` without dragging the teardown with it.

Four questions — what you want to train, floor space, experience level, budget — matched against ten pre-defined bundles. The result view shows the bundle, its total, every product inside it with image, price and a link to its live product page, and two next steps.

The same code ships twice from one source:

1. **The page** — `dist/bundle-quiz.html`, fully self-contained with the component inlined.
2. **The embed** — `dist/homegym-bundle-quiz.min.js`, a single 65 KB file that registers `<homegym-bundle-quiz>` on any page.

## Embedding it

```html
<script src="/assets/homegym-bundle-quiz.min.js" defer></script>

<homegym-bundle-quiz
  theme="light"
  accent="#FF6924"
  currency="SGD"
  contact-url="https://homegym.sg/contact"
  whatsapp="6580423952"
></homegym-bundle-quiz>
```

Every attribute is optional; the values above are the defaults.

| Attribute | Purpose |
|---|---|
| `theme` | `light` (default, homegym.sg's own white ground) or `dark` |
| `accent` | Any CSS colour. Hex values are contrast-corrected — see below |
| `currency` | Currency code. `SGD` renders as `S$2,241`; anything else goes through `Intl.NumberFormat` |
| `cart-endpoint` | Optional. If set, an **Add all to cart** button appears alongside the WhatsApp CTA and POSTs the product list here. Unset by default, so WhatsApp is the only call to action |
| `contact-url` | Fallback CTA target. Only used when no `whatsapp` number is configured, so a host embedding this can never end up with a result and no way to act on it |
| `whatsapp` | WhatsApp Business number in E.164 digits, no `+` and no spaces. **This is the primary CTA** |
| `start-step` | Deep-link straight to a step, 1–4 |

All styling lives inside a shadow root, so the component cannot be reached by the host page's CSS and cannot leak into it. It drops onto a Bootstrap or Tailwind page with no visual bleed in either direction.

### Design language

The quiz is styled to homegym.sg, using tokens read off the live site on 30 Aug 2026 so it reads as a page of their shop rather than a bolt-on:

| Token | Value | Where it came from |
|---|---|---|
| Ground | `#FFFFFF` | Site background |
| Body text | `#333333` | Site body colour |
| Body face | `"Open Sans", Helvetica, Arial` | 1,510 of 1,560 sampled elements |
| Display face | `Oswald` | Their nav and `.action` buttons |
| Primary CTA | `#FF6924`, **black** text, square | Their `.button` styling, unchanged |
| Links | `#22B4FF` | Site link colour |
| Sale red | `#F64127` | Site sale/price red |
| Corner radius | `0px` | Their entire UI is square |

The standalone page carries the HomeGym logo, a slim header and a simple footer rather than a hand-copy of their Magento navigation, which would drift out of sync the moment they change a menu. Fonts load from Google Fonts in the page head; on homegym.sg itself both faces are already loaded, so embedding costs nothing extra.

**It never navigates the host page.** Product links and CTAs open in a new tab; the cart POST targets `_blank`.

### Events

Every meaningful action fires a `CustomEvent` that bubbles and crosses the shadow boundary, so GTM can listen at `document` level without knowing the component exists.

| Event | `detail` |
|---|---|
| `quiz:start` | `{}` |
| `quiz:step` | `{ step, answers }` |
| `quiz:complete` | `{ answers, bundleId, bundleName, price, fallbackUsed }` |
| `quiz:product-click` | `{ bundleId, productId, productName, price, url }` |
| `quiz:cta-click` | `{ bundleId, bundleName, price, action }` — `action` is `whatsapp` or `add-to-cart` |
| `quiz:alternate-view` | `{ fromBundleId, toBundleId }` |
| `quiz:restart` | `{ completedBefore }` |

```js
document.addEventListener('quiz:complete', e => {
  dataLayer.push({ event: 'bundle_quiz_complete', ...e.detail });
});
```

## Editing the data

**`src/quiz/bundles.js` is the only file you need to touch.** Nothing else reads prices, product names, URLs or images.

- **Change a price** — edit `price` in `PRODUCTS`, then update the `price` on every bundle containing it. The tests assert `sum(products) === bundle.price` and will fail loudly if you miss one.
- **Put a product on sale** — set `was` to the old price. The card shows it struck through with a `SALE` tag automatically.
- **Flag stock** — add `note: 'On backorder'` to a product; it renders as a badge on the card.
- **Swap a product in a bundle** — change the id in that bundle's `products` array and correct its `price`.
- **Change the copy** — `tagline`, `pitch` and `trains` are per-bundle and used verbatim.

Run `npm test` after any edit. It checks the totals reconcile, that all 15 products have valid URLs and images, that nothing is duplicated, and that all ten bundles are still priced under their ceilings.

## How the matching works

`src/quiz/matcher.js` is a pure function — no DOM, no imports from the component — which is what makes it testable in isolation.

Two hard filters run first: the bundle must fit the stated floor **in either orientation**, and it must cost no more than the stated budget. Survivors are scored out of 100:

| Weight | Component |
|---|---|
| 40 | Function coverage — how much of what they asked for it does, plus up to +0.15 for capability beyond that |
| 25 | Budget fit — rewards using the budget without wasting it |
| 20 | Space fit — rewards filling the room, since a bigger machine in the same floor is more capable |
| 15 | Level match — exact 1.0, one step 0.6, two steps 0.2 |

When two bundles land within 2 points, the tie breaks on function coverage, then price, then footprint, then bundle number.

### The fallback ladder

If nothing passes both filters, constraints relax in a fixed order and the result view says so honestly rather than pretending:

1. Budget relaxed 10% — *"this one is S$X over"*
2. Shorter dimension relaxed 0.5 m — *"needs about 0.5 m more depth than you entered"*
3. Cheapest bundle that fits on space alone
4. Nothing fits — a **"Let's talk"** card with a contact CTA. It never fabricates a bundle.

### Coverage

`npm run sweep` runs all 64,575 realistic answer combinations and asserts every bundle is reachable and nothing throws. Current distribution:

| Bundle | Share of matched runs |
|---|---|
| The Fast Track | 22.8% |
| The Smart Smith | 21.8% |
| The Silent Operator | 17.5% |
| The Foldaway Beast | 11.5% |
| The Solo Lifter | 8.4% |
| The All-Rounder | 7.6% |
| The Apartment Titan | 5.1% |
| The Level Up | 2.7% |
| The Barbell Purist | 1.8% |
| The Iron Fortress | 0.8% |

32.0% of combinations hit the fallback ladder, almost all of them floors under 1.5 m on a side or budgets under S$2,750 — rare in practice. 12.0% reach the "let's talk" card. The ladder never throws.

Rung 3 currently never fires: rung 2's space relaxation always unlocks something affordable first. It is kept because a future price or footprint change could open that gap.

## The WhatsApp CTA

WhatsApp is **the** call to action on the result view. It opens WhatsApp with the whole match pre-written — answers, bundle, every product and price — addressed to the business number, and the visitor taps send. The message closes by asking to confirm availability and book a showroom visit, which is what the supporting line under the button promises.

**A web page cannot send a WhatsApp message on someone's behalf.** There is no browser API for it. Automatic sending requires the WhatsApp Business Cloud API called from a server holding an access token, and that token can never live in client-side JavaScript — publishing it would let anyone send messages as HomeGym. The deep link is the honest version: one tap, no backend, no per-message cost, and it arrives as a real conversation you can reply to.

If genuinely automatic sending is wanted later, the shape is: the component POSTs the match to a small server endpoint, and that endpoint calls the Cloud API with the token. That is a backend change, not a component change — `quiz:complete` already carries everything such an endpoint would need.

## Accessibility

Fully keyboard navigable end to end, with visible focus rings throughout. Selection state is a filled accent block rather than a border tint, so it survives a phone screen in daylight, and every touch target clears 44 × 44 px.

Hex accents are contrast-corrected at runtime: `--accent-ink` is darkened or lightened until text clears 4.5:1 against the background, so a client-supplied accent cannot quietly break WCAG AA. HomeGym's `#FF6924` scores only 2.88:1 as text on white, so accent-coloured text renders as `#BF4F1B` (4.83:1) while buttons keep the exact brand orange.

| Pair | Ratio |
|---|---|
| Body text `#333` on white | 12.63:1 |
| Muted helper `#666` | 5.74:1 |
| Links `#0077B3` | 4.90:1 |
| Accent text (auto-darkened) | 4.83:1 |
| Black on the `#FF6924` CTA | 7.30:1 |
| Black on the `#F64127` SALE tag | 5.70:1 |
| Sale text `#C62D14` | 5.55:1 |

**Three of HomeGym's own colours fail AA and were adjusted for text use only.** Their link blue `#22B4FF` is 2.32:1 on white, the CTA orange is 2.88:1 as text, and the sale red is 3.68:1. Backgrounds keep the exact brand colours — the SALE tag is still `#F64127`, just with black text instead of white. **Worth raising with them: the same blue fails on their live site too, on every product link.**

**Limitation:** named CSS colours and `oklch()`/`rgb()` accents are passed through untouched, because the correction needs to parse the value and only hex is parsed. Use a hex accent if you change it.

All motion is 150–200 ms ease-out, and `prefers-reduced-motion: reduce` disables every transition and skips the 1.2 s matching delay entirely.

## Before this goes live

Seven things need a decision from HomeGym. They are flagged in code at the exact lines they affect.

1. **Prices are a 30 Aug 2026 snapshot** and several are promotional — TinyTitan, Bodyx Cube, Titan X20, IM2000, Folding Rack, the Olympic set and both bars. They will drift. The durable fix is a nightly job that reads the Magento product API and rewrites `PRODUCTS`.
2. **The Vigor X20 Sliding Bench is out of stock**, and its URL slug says `b20` while the product page title says `X20`. It currently renders an "On backorder" badge. Confirm the correct SKU.
3. **Image URLs are CloudFront cache paths.** The `/cache/c0dcb29ef.../` segment changes when Magento regenerates its image cache, which would 404 every image at once. The initial-letter fallback tile stops the grid breaking; resolving images from the product API is the real fix.
4. **Footprints are unverified.** They came from the source spreadsheet, not from measuring machines, and they read as working areas including clearance. A customer who buys on a wrong footprint is a returned 338 kg machine. **This is the highest-risk item on the list.**
5. **Bundles 1, 4, 7 and 9 share identical function tags** (`smith` + `power_rack` + `cable`), separated only by space, level and price. Adding a distinguishing tag to each — `folding`, `self_spotting`, `connected` — plus a matching quiz option would sharpen them.
6. **`contact-url` points at `https://homegym.sg/contact`,** which has not been confirmed. Check it resolves before launch.
6b. **Their link blue `#22B4FF` fails WCAG AA at 2.32:1 on white** — here and on the live site, on every product link. The quiz uses a darkened `#0077B3` for text. Worth fixing site-wide.
7. **The budget slider starts at S$2,500** while the cheapest bundle is S$2,241, so every bundle clears its floor. Dropping the minimum to S$2,000 would capture sub-S$2,500 traffic but needs a lighter bundle to answer it with.

One correction to the source brief: it gives The Barbell Purist's saving as S$208. The catalogue data gives **S$200** (Folding Rack S$151 + Olympic set S$49). The page shows the computed figure, not the quoted one.

## Scope and limitations

This is an **unsolicited external review**. Everything in it was observed from outside the business, as a customer would see it, with no access to analytics, revenue, margin or stock data. Findings are ranked by expected impact, not measured loss. Each document ends with a section setting out explicitly what was verified and what was inferred.

HomeGym.sg is an independent business. This review is not affiliated with, commissioned by, or endorsed by it.

## Search indexing

This site is served with `robots.txt` disallowing all crawlers and `noindex, nofollow` on every page. It is shareable by link but not intended to be discoverable through search.

## Layout

```
src/         page fragments (title + style + body) — the source of truth
src/quiz/    the bundle-quiz web component (ES modules, no build step in dev)
scripts/     build, engine tests, sweep, output verification
test/        unit tests for the bundle matcher
dist/        generated site (gitignored, produced by the build)
```

## Commands

```bash
npm run build    # src/ -> dist/, including the inlined and standalone quiz bundles
npm test         # prototype engine (3,072 combinations) + bundle matcher unit tests
npm run sweep    # assert all 10 bundles are reachable across 64,575 combinations
npm run verify   # validate dist/ structure, noindex tags, internal links, quiz bundle
npm run check    # all four, in order — this is what CI and Vercel run

npm run check:images   # confirm every hotlinked HomeGym image still resolves
```

No dependencies; Node 20+ only.

The quiz is bundled by `scripts/build-quiz.mjs`, a ~60-line concatenator, rather than esbuild. That is deliberate: Vercel's `installCommand` is `echo 'no dependencies'` and CI never runs `npm ci`, so a devDependency in the build path would fail the first push. The module graph is four files with no external imports, so a real resolver buys nothing.

In development the page loads `src/quiz/*.js` as plain ES modules with no build step; `npm run build` swaps that script tag for the inlined bundle.

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
- a bundle's products no longer sum to its stated price
- any of the ten bundles becomes unreachable, or the matcher throws on any of 64,575 combinations
- the inlined quiz bundle does not match the standalone one byte for byte
- a page is missing its doctype, `<head>`, `<title>` or noindex tags
- an absolute artifact URL leaks into the output
- any internal link points at a file that does not exist

On a green push to `main`, two deployments run from the same `dist/`:

| Host | URL |
|---|---|
| Vercel (production) | https://homegym-sg.vercel.app |
| GitHub Pages | https://goodkarmadoge.github.io/Homegym-sg/ |

Vercel runs the identical `npm run check` as its build command, so a broken commit fails to deploy rather than deploying broken.
