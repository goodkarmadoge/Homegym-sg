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
| [`bundle-quiz.html`](bundle-quiz.html) | A four-question quiz matching the visitor to a complete priced bundle built from real catalogue products. Bundle data comes from a Google Sheet. Ships bare, for embedding into homegym.sg. |

## About the prototype

`prototype.html` is a **design concept, not a live HomeGym.sg page.** It cannot take orders. Prices tagged `LIVE PRICE` were verified against homegym.sg on 16 August 2026; everything else is a clearly-labelled placeholder that would bind to real catalogue data in production.

The recommendation engine is a rules engine running in the page. All 3,072 possible answer combinations were tested: nine distinct build outcomes, zero budget violations, no empty or malformed results.

---

# The bundle quiz

`bundle-quiz.html` is a **standalone page**. It carries no site navigation and links to nothing else in this engagement, so it can be deployed on its own at `homegym.sg/bundle-quiz` without dragging the teardown with it.

Four questions (what you want to train, floor space, experience level, budget) matched against ten pre-defined bundles. The result view shows the bundle, its total, every product inside it with image, price and a link to its live product page, and two next steps.

The same code ships twice from one source:

1. **The page:** `dist/bundle-quiz.html`, fully self-contained with the component inlined.
2. **The embed:** `dist/homegym-bundle-quiz.min.js`, a single 66 KB file that registers `<homegym-bundle-quiz>` on any page.

## Embedding it

This is the quiz's main use. `bundle-quiz.html` is deliberately bare: no
masthead, no hero, no footer, transparent background. It is the quiz and
nothing else, so the host page supplies all surrounding chrome. Drop it in an
iframe, or skip the page entirely and use the component directly:

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
| `accent` | Any CSS colour. Hex values are contrast-corrected; see below |
| `currency` | Currency code. `SGD` renders as `S$2,241`; anything else goes through `Intl.NumberFormat` |
| `cart-endpoint` | Optional. If set, an **Add all to cart** button appears alongside the WhatsApp CTA and POSTs the product list here. Unset by default, so WhatsApp is the only call to action |
| `contact-url` | Fallback CTA target. Only used when no `whatsapp` number is configured, so a host embedding this can never end up with a result and no way to act on it |
| `whatsapp` | WhatsApp Business number in E.164 digits, no `+` and no spaces. **This is the primary CTA** |
| `start-step` | Deep-link straight to a step, 1 to 4 |
| `sheet-live` | Present, no value. Re-read the Google Sheet after first paint so sheet edits appear without a redeploy. Needs the tab gids in `config/sheet.json`. Falls back silently to the built-in data on any failure |
| `sheet-id` | Override which spreadsheet `sheet-live` reads. Defaults to the one baked in at sync time |

All styling lives inside a shadow root, so the component cannot be reached by the host page's CSS and cannot leak into it. It drops onto a Bootstrap or Tailwind page with no visual bleed in either direction.

### Design language

The quiz follows the **Modernist design system**, per the design handoff of 30 Aug 2026 (`design_handoff_gym_builder_quiz`):

| Token | Value |
|---|---|
| Ground | `#ffffff` (white, not the system ground `#f3f2f2`, since the quiz sits on the site content area) |
| Text | `#201e1d` |
| Accent | `#ec3013` |
| Type | Archivo 400 / 600 / 800 throughout |
| Corner radius | `0px` everywhere, non-negotiable in this system |
| Rules | 2px at 40% ink, never softened to a hairline |
| Alignment | Flush left, including labels inside wide buttons |
| Photography | Grayscale, via the `.grayscale` wrapper |

**Two deliberate deviations, both to hold WCAG AA.** Each steps one notch along the system own ramp, which is the mechanism the system prescribes for text on tinted fills:

1. White on `--accent` is **4.20:1**, under the 4.5 needed for the option-card title at its small end (16px) and its 14px description. Surfaces that carry white text use `--accent-600` (`#dd2b0f`, 4.74:1). Chrome that carries no text, meaning the progress fill, section rules and plan outline, keeps the true accent.
2. `--neutral-600` is **4.30:1** on white. Small text the handoff assigns to it uses `--neutral-700` (6.52:1).

**Three further departures from the handoff, all decided with the client:**

- The result keeps a **single WhatsApp CTA in brand green** rather than the handoff two buttons in accent and outline.
- **No em dashes** anywhere in the copy, so the handoff option titles use colons.
- **No "against RRP" line.** The acronym is not one a shopper should have to decode; the discount still shows on each product card as a struck-through price with a SALE tag.

The standalone page carries the HomeGym logo, a masthead and a footer rather than a hand-copy of their Magento navigation, which would drift out of sync the moment they change a menu. Archivo loads from Google Fonts in the page head.

**It never navigates the host page.** Product links and CTAs open in a new tab; the cart POST targets `_blank`.

### Events

Every meaningful action fires a `CustomEvent` that bubbles and crosses the shadow boundary, so GTM can listen at `document` level without knowing the component exists.

| Event | `detail` |
|---|---|
| `quiz:start` | `{}` |
| `quiz:step` | `{ step, answers }` |
| `quiz:complete` | `{ answers, bundleId, bundleName, price, fallbackUsed }` |
| `quiz:product-click` | `{ bundleId, productId, productName, price, url }` |
| `quiz:cta-click` | `{ bundleId, bundleName, price, action }` where `action` is `whatsapp` or `add-to-cart` |
| `quiz:alternate-view` | `{ fromBundleId, toBundleId }` |
| `quiz:restart` | `{ completedBefore }` |

```js
document.addEventListener('quiz:complete', e => {
  dataLayer.push({ event: 'bundle_quiz_complete', ...e.detail });
});
```

## Where the data comes from

The bundles live in a **Google Sheet**, not in the code:

<https://docs.google.com/spreadsheets/d/1ntgik1NX9IjqNmaSI1E8Sj95r4bPAE-90cdKzjbnssU>

That sheet is the source of truth for **which bundles exist and how a customer
is matched to one**. Adding a bundle is a spreadsheet edit, not a code change.

| Tab | Owns |
|---|---|
| Bundle rules | One row per bundle: functions, size, style, budget ceiling, number, name |
| Product matrix | One column per bundle, product URLs down the rows. Row A is the anchor machine and stays first in the result grid |
| Personas | Four customer types. Read and versioned, but not yet used, see below |

The sheet holds no prices, no sales copy and no photographs, so those stay in
`src/quiz/bundles.js` and are joined on by bundle number.

| Lives in the sheet | Lives in `src/quiz/bundles.js` |
|---|---|
| Which bundles exist | Product catalogue: name, price, `was`, stock note, image |
| Functions, footprint, level, budget ceiling | Per-bundle `tagline`, `pitch`, `trains`, `hero` |
| Which products are in each bundle, by URL | The `ROOMS` strip |

**A bundle price is always the sum of its products.** It is never typed in
anywhere, which is what lets a new sheet row price itself and means a price can
never drift out of step with the items listed beside it.

### Adding a bundle

1. Add a row to the rules tab and a column to the product matrix.
2. If it uses a product the catalogue has never seen, add it to `PRODUCTS` in
   `src/quiz/bundles.js` with its price and image. `npm run sync` names the
   missing URL if you forget.
3. Wait for the hourly sync, or run `npm run sync` and commit.

That is enough to make it real. The bundle takes its name from the sheet's
**Bundle Name** column, prices itself, and renders with a generated tagline and
a product photo. Writing it a proper `tagline`, `pitch` and `trains` list in
`BUNDLE_COPY` is a separate improvement, not a blocker: until then the
"What you'll train" section is simply omitted rather than shown empty.

### Editing prices, copy and imagery

Still `src/quiz/bundles.js`:

- **Change a price.** Edit `price` in `PRODUCTS`. Bundle totals recompute; there is no second number to keep in step.
- **Put a product on sale.** Set `was` to the old price. The card shows it struck through with a `SALE` tag.
- **Flag stock.** Add `note: 'On backorder'`; it renders as a badge on the card.
- **Change the copy.** `tagline`, `pitch` and `trains` in `BUNDLE_COPY`, keyed by bundle number, used verbatim.

Run `npm test` after any edit. It checks that totals reconcile, that every
product has a valid URL and image, that nothing is duplicated, and that every
bundle is priced under its ceiling.

### Syncing

```bash
npm run sync           # pull the sheet, rewrite src/quiz/sheet-data.js
npm run sync:check     # fail if the committed data is out of date, for CI
npm run sync -- --csv-dir ./dir   # sync from exported CSVs instead of the network
```

`src/quiz/sheet-data.js` is **generated**. Editing it by hand is pointless; the
next sync overwrites it.

The sheet must be readable without signing in: open it, **Share**, **Anyone with
the link** as **Viewer**. That exposes only this sheet. It is shared, and the
tab gids are filled into `config/sheet.json`, so `npm run sync` works today. If
sharing is ever turned off the sync fails with a message saying so, and the quiz
keeps serving the last good committed data.

> **Do not switch the sync to `/gviz/tq?tqx=out:csv`.** It looks like the same
> CSV and is the endpoint most examples reach for, but it runs a query engine
> over the sheet and infers a header row. On this sheet that silently dropped
> both columns whose only value sat in the row it treated as a header: bundles 5
> and 8 came back with no products at all, with no error of any kind, while
> every other column looked fine. `/export?format=csv` returns the sheet
> verbatim, blank spacer rows and all. Both endpoints were compared on
> 7 Sep 2026; the strict "defined but has no products" check is what caught it.

`.github/workflows/sync-sheet.yml` runs the sync hourly and on demand. It
commits only when something actually changed, and only after `npm run check`
passes, so a sheet edit that breaks the quiz stops in CI rather than on a
customer's screen.

### Why the data is committed rather than fetched live

The quiz ships as one static file with no runtime dependencies, and the
64,575-combination sweep only means anything if the data it swept is the data
that ships. Committing the sheet's contents keeps both properties.

If you want sheet edits to appear without waiting for the hourly sync, add
`sheet-live` to the tag and fill in the tab gids in `config/sheet.json`. The
component then re-reads the sheet after first paint. It **fails silently by
design**: a private sheet, an offline visitor, a blocked request or a
half-edited row all leave the committed data in place, so what a customer sees
is never worse than the snapshot that shipped. Outcomes surface on the
`quiz:sheet` event and in the console.

### The personas tab

Parsed, versioned and exported as `PERSONAS`, but nothing reads it yet. The
sheet has no column linking a persona to a bundle, so using them in results
would mean inventing that mapping. Add a **Persona** column to the rules tab and
they can be wired up without another data migration.

## How the matching works

`src/quiz/matcher.js` is a pure function with no DOM access and no imports from the component, which is what makes it testable in isolation.

Two hard filters run first: the bundle must fit the stated floor **in either orientation**, and it must cost no more than the stated budget. Survivors are scored out of 100:

| Weight | Component |
|---|---|
| 40 | Function coverage: how much of what they asked for it does, plus up to +0.15 for capability beyond that |
| 25 | Budget fit: rewards using the budget without wasting it |
| 20 | Space fit: rewards filling the room, since a bigger machine in the same floor is more capable |
| 15 | Level match: exact 1.0, one step 0.6, two steps 0.2 |

When two bundles land within 2 points, the tie breaks on function coverage, then price, then footprint, then bundle number.

### The fallback ladder

If nothing passes both filters, constraints relax in a fixed order and the result view says so honestly rather than pretending:

1. Budget relaxed 10%. Banner: *"this one is S$X over"*
2. Shorter dimension relaxed 0.5 m. Banner: *"needs about 0.5 m more depth than you entered"*
3. Cheapest bundle that fits on space alone
4. Nothing fits, a **"Let's talk"** card with a contact CTA. It never fabricates a bundle.

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

32.0% of combinations hit the fallback ladder, almost all of them floors under 1.5 m on a side or budgets under S$2,750, rare in practice. 12.0% reach the "let's talk" card. The ladder never throws.

Rung 3 currently never fires: rung 2's space relaxation always unlocks something affordable first. It is kept because a future price or footprint change could open that gap.

## The WhatsApp CTA

WhatsApp is **the** call to action on the result view. It opens WhatsApp with the whole match pre-written, answers, bundle, every product and price, addressed to the business number, and the visitor taps send. The message closes by asking to confirm availability and book a showroom visit, which is what the supporting line under the button promises.

**A web page cannot send a WhatsApp message on someone's behalf.** There is no browser API for it. Automatic sending requires the WhatsApp Business Cloud API called from a server holding an access token, and that token can never live in client-side JavaScript, publishing it would let anyone send messages as HomeGym. The deep link is the honest version: one tap, no backend, no per-message cost, and it arrives as a real conversation you can reply to.

If genuinely automatic sending is wanted later, the shape is: the component POSTs the match to a small server endpoint, and that endpoint calls the Cloud API with the token. That is a backend change, not a component change, `quiz:complete` already carries everything such an endpoint would need.

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

**Three of HomeGym's own colours fail AA and were adjusted for text use only.** Their link blue `#22B4FF` is 2.32:1 on white, the CTA orange is 2.88:1 as text, and the sale red is 3.68:1. Backgrounds keep the exact brand colours, the SALE tag is still `#F64127`, just with black text instead of white. **Worth raising with them: the same blue fails on their live site too, on every product link.**

**Limitation:** named CSS colours and `oklch()`/`rgb()` accents are passed through untouched, because the correction needs to parse the value and only hex is parsed. Use a hex accent if you change it.

All motion is 150-200 ms ease-out, and `prefers-reduced-motion: reduce` disables every transition and skips the 1.2 s matching delay entirely.

## Before this goes live

Seven things need a decision from HomeGym. They are flagged in code at the exact lines they affect.

1. **Prices are a 30 Aug 2026 snapshot** and several are promotional, TinyTitan, Bodyx Cube, Titan X20, IM2000, Folding Rack, the Olympic set and both bars. They will drift. The durable fix is a nightly job that reads the Magento product API and rewrites `PRODUCTS`.
2. **The Vigor X20 Sliding Bench is out of stock**, and its URL slug says `b20` while the product page title says `X20`. It currently renders an "On backorder" badge. Confirm the correct SKU.
3. **Image URLs are CloudFront cache paths.** The `/cache/c0dcb29ef.../` segment changes when Magento regenerates its image cache, which would 404 every image at once. The initial-letter fallback tile stops the grid breaking; resolving images from the product API is the real fix.
4. **Footprints are unverified.** They came from the source spreadsheet, not from measuring machines, and they read as working areas including clearance. A customer who buys on a wrong footprint is a returned 338 kg machine. **This is the highest-risk item on the list.**
5. **Bundles 1, 4, 7 and 9 share identical function tags** (`smith` + `power_rack` + `cable`), separated only by space, level and price. Adding a distinguishing tag to each, `folding`, `self_spotting`, `connected`, plus a matching quiz option would sharpen them.
6. **`contact-url` points at `https://homegym.sg/contact`,** which has not been confirmed. Check it resolves before launch.
6b. **Their link blue `#22B4FF` fails WCAG AA at 2.32:1 on white**, here and on the live site, on every product link. The quiz uses a darkened `#0077B3` for text. Worth fixing site-wide.
7. **The budget slider starts at S$2,500** while the cheapest bundle is S$2,241, so every bundle clears its floor. Dropping the minimum to S$2,000 would capture sub-S$2,500 traffic but needs a lighter bundle to answer it with.

One correction to the source brief: it gives The Barbell Purist's saving as S$208. The catalogue data gives **S$200** (Folding Rack S$151 + Olympic set S$49). The page shows the computed figure, not the quoted one.

## Scope and limitations

This is an **unsolicited external review**. Everything in it was observed from outside the business, as a customer would see it, with no access to analytics, revenue, margin or stock data. Findings are ranked by expected impact, not measured loss. Each document ends with a section setting out explicitly what was verified and what was inferred.

HomeGym.sg is an independent business. This review is not affiliated with, commissioned by, or endorsed by it.

## Search indexing

This site is served with `robots.txt` disallowing all crawlers and `noindex, nofollow` on every page. It is shareable by link but not intended to be discoverable through search.

## Layout

```
src/         page fragments (title + style + body), the source of truth
src/quiz/    the bundle-quiz web component (ES modules, no build step in dev)
scripts/     build, engine tests, sweep, output verification
test/        unit tests for the bundle matcher
dist/        generated site (gitignored, produced by the build)
```

## Commands

```bash
npm run sync     # pull bundle data from the Google Sheet into src/quiz/sheet-data.js
npm run build    # src/ -> dist/, including the inlined and standalone quiz bundles
npm test         # prototype engine (3,072 combinations) + matcher and sheet-parser units
npm run sweep    # assert every bundle is reachable across 64,575 combinations
npm run verify   # validate dist/ structure, noindex tags, internal links, quiz bundle
npm run check    # all four, in order, this is what CI and Vercel run

npm run check:images   # confirm every hotlinked HomeGym image still resolves
```

No dependencies; Node 20+ only.

The quiz is bundled by `scripts/build-quiz.mjs`, a ~60-line concatenator, rather than esbuild. That is deliberate: Vercel's `installCommand` is `echo 'no dependencies'` and CI never runs `npm ci`, so a devDependency in the build path would fail the first push. The module graph is a handful of files with no external imports, so a real resolver buys nothing.

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
- any bundle becomes unreachable, or the matcher throws on any of 64,575 combinations
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
