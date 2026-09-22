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
| `insights.html` | **Internal.** What the quiz is doing: sessions, screen dropoff, bundles viewed, CTA taps. Not linked from any page above, on purpose, and password-protected at the deployment. Deliberately not a link in this table either. See [The insights dashboard](#the-insights-dashboard). |

## About the prototype

`prototype.html` is a **design concept, not a live HomeGym.sg page.** It cannot take orders. Prices tagged `LIVE PRICE` were verified against homegym.sg on 16 August 2026; everything else is a clearly-labelled placeholder that would bind to real catalogue data in production.

The recommendation engine is a rules engine running in the page. All 3,072 possible answer combinations were tested: nine distinct build outcomes, zero budget violations, no empty or malformed results.

---

# The bundle quiz

`bundle-quiz.html` is a **standalone page**. It carries no site navigation and links to nothing else in this engagement, so it can be deployed on its own at `homegym.sg/bundle-quiz` without dragging the teardown with it.

Four questions (what you want to train, floor space, which customer you are, budget) matched against the bundles defined in the Google Sheet. The result view shows the bundle, its total, every product inside it with image, price and a link to its live product page, and two next steps.

**Question one has two escape hatches,** because a shopper who does not yet know what they want is the one this quiz is most useful to, and a required multi-select was turning them away at the first screen:

- **All of the above** ticks all seven functions. The function axis then rewards breadth, so the most capable bundle that still fits the room and the budget wins.
- **No preference** declines the question. The 40-point function axis stops discriminating entirely and floor space, budget and persona decide the match.

They are deliberately **not** the same answer. "I want everything" and "I don't mind" pull in different directions, and the matcher honours both: across a spread of rooms, budgets and personas the two land on a different bundle about a third of the time. Both are exclusive against the individual options, so no one can hold a contradiction like *barbell lifts* **and** *no preference*.

The same code ships twice from one source:

1. **The page:** `dist/bundle-quiz.html`, fully self-contained with the component inlined.
2. **The embed:** `dist/homegym-bundle-quiz.min.js`, a single 111 KB file that registers `<homegym-bundle-quiz>` on any page. One request, no dependencies, 74% of the 150 KB budget the build enforces, and **27.6 KB over the wire** once the host serves it gzipped, which any Magento install already does.

## Embedding it

> **Handing this to the client's developer?** [`HANDOFF.md`](HANDOFF.md) is the
> single page they need: the snippet to paste, the CSP checks, the analytics
> wiring, and the data questions to settle before launch. This section is the
> reference behind it.
>
> **The client chose the iframe on 14 Sep 2026.** Both paths are documented and
> supported below, but that is the one being shipped, so the iframe section and
> [Events through an iframe](#events-through-an-iframe) are the live ones.

This is the quiz's main use. `bundle-quiz.html` is deliberately bare: no
masthead, no hero, no footer, transparent background. It is the quiz and
nothing else, so the host page supplies all surrounding chrome. Drop it in an
iframe, or skip the page entirely and use the component directly:

```html
<!-- Archivo is the quiz's typeface. Without it the component falls back to
     system-ui and still works, it just stops looking like the design system.
     Skip these three lines if homegym.sg already loads Archivo. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap">

<style>
  /* Hold the space the quiz will occupy, so the page does not jump when the
     custom element upgrades, then release it so short views are not padded. */
  homegym-bundle-quiz:not(:defined) { display: block; min-height: 620px; }
</style>

<script src="/assets/homegym-bundle-quiz.min.js" defer></script>

<homegym-bundle-quiz
  heading-level="2"
  currency="SGD"
  contact-url="https://homegym.sg/contact"
  whatsapp="6580423952"
></homegym-bundle-quiz>

<noscript>
  <p>The quiz needs JavaScript. Browse the range at
    <a href="https://homegym.sg/strength.html">homegym.sg</a>,
    or message us on WhatsApp and we will size a build for you.</p>
</noscript>
```

Every attribute is optional, and the snippet shows the **production** values
rather than the defaults: `whatsapp` has no default and is the one that matters
most, since it is the primary call to action. Leave `theme` and `accent` off
entirely unless you want to move off the design system, which is what their
defaults already are.

**`heading-level` is the one to think about.** Set it one level below the
nearest heading above the quiz on the host page: under an `<h1>` page title use
`2`, inside a section that already has its own `<h2>` use `3`. See
[Headings](#headings) for why this is not cosmetic.

| Attribute | Purpose |
|---|---|
| `theme` | `light` (default, homegym.sg's own white ground) or `dark` |
| `accent` | Any CSS colour. Hex values are contrast-corrected; see below |
| `currency` | Currency code. `SGD` renders as `$2,241`; anything else goes through `Intl.NumberFormat` |
| `cart-endpoint` | Optional. If set, an **Add all to cart** button appears alongside the WhatsApp CTA and POSTs the product list here. Unset by default, so WhatsApp is the only call to action |
| `contact-url` | Fallback CTA target. Only used when no `whatsapp` number is configured, so a host embedding this can never end up with a result and no way to act on it |
| `whatsapp` | WhatsApp Business number in E.164 digits, no `+` and no spaces. **This is the primary CTA** |
| `heading-level` | `1` to `6`, default `1`. Where the quiz's own headings sit in the host page's outline. Anything outside that range, or unparseable, falls back to `1` |
| `booking-url` | Target for the **Schedule a visit** CTA on the result. Defaults to the appointment page baked in at build time; set it to point a campaign or a second showroom somewhere else |
| `start-step` | Deep-link straight to a step, 1 to 4 |
| `sheet-live` | Present, no value. Re-read the Google Sheet after first paint so sheet edits appear without a redeploy. Needs the tab gids in `config/sheet.json`. Falls back silently to the built-in data on any failure |
| `sheet-id` | Override which spreadsheet `sheet-live` reads. Defaults to the one baked in at sync time |

All styling lives inside a shadow root, so the component cannot be reached by the host page's CSS and cannot leak into it. It drops onto a Bootstrap or Tailwind page with no visual bleed in either direction.

### Headings

**A shadow root scopes styles, not the accessibility tree.** An `<h1>` inside
the component is an `<h1>` in the host document's outline, however deeply the
element is nested. Left at the default on a page that already has its own
`<h1>`, the quiz contributes a second one and the outline stops describing the
page: a screen-reader user navigating by heading hears two top-level titles,
and the sections under the result hang off the wrong one.

`heading-level` moves all three tiers at once. At `heading-level="3"`, on a page
whose own headings run `h1` then `h2`, the flattened outline comes out as:

```
H1  [page]  Home Gym Equipment Singapore
H2  [page]  Build your bundle
H3  [quiz]  The Smart Smith                  <- the view heading
H4  [quiz]  What's in the bundle             <- result sections
H5  [quiz]  Vigor BF900 Pro Connected        <- product cards
H4  [quiz]  Rooms we've built
```

The tiers stop at `h6` rather than running off the end, so a deliberately deep
`heading-level="6"` flattens to `h6` throughout instead of emitting invalid
tags. The standalone `bundle-quiz.html` is its own document with no competing
title, so it stays at the default `1` and the iframe embed needs no change.

### Content-Security-Policy

Two things to check if homegym.sg enforces a CSP. Magento 2.4 ships one, in
report-only mode by default, so this is worth a look before launch rather than
after.

- **`script-src`** has to allow the bundle. Self-hosting it under `/assets/`
  means `'self'` covers it; hot-linking it from another origin does not.
- **`style-src`** has to allow the component's stylesheet. It is a `<style>`
  element created at runtime and injected into the shadow root, which a
  nonce-based policy without `'unsafe-inline'` will block. The quiz then renders
  as unstyled markup rather than failing loudly, which is the worse outcome to
  debug. If the policy is strict, the fix is to serve the styles as their own
  file and let `style-src 'self'` cover them.

The component deliberately uses **no `style=""` attributes**, so a policy with
`style-src-attr 'none'` is fine: the one place that needed a computed width, the
progress bar, sets it through the CSSOM, which CSP does not govern.

### Or as an iframe

Use this when you would rather not host a script on homegym.sg. The quiz page
reports its own height to the parent, so the frame grows and shrinks with the
content instead of scrolling inside a fixed box:

```html
<iframe id="homegym-quiz"
        src="https://homegym-sg.vercel.app/bundle-quiz.html"
        title="Build your bundle"
        style="width:100%;border:0;display:block;height:900px"></iframe>

<script>
(function () {
  var f = document.getElementById('homegym-quiz');
  var origin = new URL(f.src).origin;
  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;                     // only trust the quiz
    if (!e.data) return;

    // Grow and shrink the frame with its content.
    if (e.data.type === 'homegym-quiz:height') {
      f.style.height = e.data.height + 'px';
    }

    // Put the top of the quiz back in view on a step change. The quiz cannot
    // do this itself: the iframe fits its content, so the child has nothing
    // to scroll, and the page that does scroll is this one.
    if (e.data.type === 'homegym-quiz:scroll-to-top') {
      // scrollIntoView on the FRAME, not scrollTo(0, 0) on the page. The quiz
      // is rarely the first thing on a page: scrolling the window to zero
      // flings the visitor up past the masthead and whatever copy sits above
      // the embed, on every single step. This puts the top of the quiz at the
      // top of the viewport, wherever the quiz happens to live.
      var motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      f.scrollIntoView({ block: 'start', behavior: motion && motion.matches ? 'auto' : 'smooth' });
    }
  });
}());
</script>
```

**Both messages matter on a phone.** Without the height one the frame is a
fixed box the quiz scrolls inside. Without the scroll one, tapping Continue
leaves the visitor looking at the middle of the next question with its heading
above the fold, which is exactly what makes step two feel broken: the floor
plan fills the screen and the sliders under it are never seen.

The `height` in the style attribute is only what shows before the first message
arrives; pick something close to a first question so the page does not jump.

**The message is one number and nothing else,** and the listener above checks
`e.origin` before trusting it. Without that check any page in any other tab
could post a height at yours.

If you skip the script entirely the quiz still works, it just sits in a fixed
box and scrolls internally.

**The frame has to be allowed to load at all,** and that is a response header on
this deployment, not something the embedding page can grant itself. `vercel.json`
sends:

```
Content-Security-Policy: frame-ancestors 'self' https://homegym.sg https://*.homegym.sg
```

Embedding from any other origin, a staging host or a different domain, is
refused by the browser: an empty box and a console error, with nothing in this
repo failing. Add the origin to that list first.

This was wrong until now. The header was `X-Frame-Options: SAMEORIGIN`, which
made the snippet above impossible on homegym.sg, while the README documented it
as the supported path. `X-Frame-Options` has no allowlist form that current
browsers honour, `ALLOW-FROM` having been dropped, and where both headers are
present it wins, so it is gone rather than loosened. `npm run verify` now fails
the build if it comes back or if `frame-ancestors` stops naming homegym.sg.

**A note on why it measures what it does.** The reporter measures the content
element, not the document. `document.scrollHeight` can never report less than
the iframe's own viewport, so once the parent has grown the frame to fit a
result page, the document keeps reporting that height forever and returning to
question one leaves a screen of empty space. Measured against the real page:
growing worked, shrinking silently did not. Verified both ways, 978px at
question one, 7,662px at a result, and back.

### iframe-resizer

The quiz page also loads **iframe-resizer v4's in-frame script**, added 17 Sep
2026 to help with mobile resizing:

```html
<script src="https://cdn.jsdelivr.net/npm/iframe-resizer@4/js/iframeResizer.contentWindow.min.js"></script>
```

**On its own it does nothing.** iframe-resizer is a two-part library: the script
above sits silent inside the frame until a parent page running the *other* half
calls `iframeResize()` on it. Adding it to the quiz page and changing nothing on
homegym.sg changes nothing on homegym.sg. The host side is:

```html
<iframe id="homegym-quiz" src="https://homegym-sg.vercel.app/bundle-quiz.html"
        title="Build your bundle" style="width:100%;border:0;display:block"></iframe>

<script src="https://cdn.jsdelivr.net/npm/iframe-resizer@4/js/iframeResizer.min.js"></script>
<script>iFrameResize({ log: false, checkOrigin: ['https://homegym-sg.vercel.app'] }, '#homegym-quiz');</script>
```

**Drive the frame from one mechanism or the other, never both.** The page still
posts `homegym-quiz:height` as before, so a host that has not adopted
iframe-resizer keeps working unchanged. But a host that runs iframe-resizer
*and* the height listener has two writers setting the same `style.height`, which
is how you get a frame that oscillates instead of settling. Adopt iframe-resizer
and you drop the height branch from the listener — keep the `homegym-quiz:event`
branch, since analytics forwarding is unrelated and iframe-resizer does not
carry it.

**The `@4` is doing licensing work.** v4 is MIT; v5 relicensed to GPLv3 with a
paid commercial exception. A one-character bump in that URL would put a
commercial site under a copyleft licence with nothing failing and nobody
noticing, so `npm run verify` fails the build if the major is ever not 4.

Two things worth deciding rather than inheriting: `@4` floats to the newest 4.x
on every page load, which is a third party able to change what runs inside the
client's page, and pinning an exact version with an `integrity` hash closes that
at the cost of manual updates. And the script is fetched from a CDN at runtime,
so an ad blocker, a corporate proxy or a jsDelivr outage means it never arrives.
That last case is tested rather than assumed: with the CDN blocked the quiz
still resized correctly at 390px, growing 1,627px to 6,507px through the
built-in reporter, with no console errors.

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

**`answers.functions` can carry two values that are not training functions.**
Question one has two shortcuts, and both show up here:

| value in `functions` | what the visitor did |
|---|---|
| all seven tags | ticked **All of the above** (or all seven by hand, which is the same answer) |
| `["_any"]` | ticked **No preference**, declining the question |

`_any` is a sentinel, never a tag: no bundle carries it and nothing in the sheet
can define it. Segment on it rather than filtering it out — "didn't know what
they wanted" is one of the more interesting things this quiz can tell you, and
it is the cohort most likely to need a salesperson.

### Events through an iframe

Events are fired on the **iframe's** document, not the host page's, so an
embedded quiz delivers nothing to the host's GTM on its own. `bundle-quiz.html`
forwards them to the parent; the host listens once and pushes into `dataLayer`:

```js
window.dataLayer = window.dataLayer || [];
(function () {
  var f = document.getElementById('homegym-quiz');
  var origin = new URL(f.src).origin;
  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;                     // only trust the quiz
    if (!e.data) return;
    if (e.data.type === 'homegym-quiz:height') { f.style.height = e.data.height + 'px'; return; }
    if (e.data.type === 'homegym-quiz:event') {
      dataLayer.push(Object.assign({ event: e.data.name.replace(':', '_') }, e.data.detail));
    }
  });
}());
```

That is the same listener as the height snippet with one more branch, so use
this version and not both.

`quiz:start` is emitted while the custom element upgrades, which is why the
forwarder is loaded **before** the quiz bundle on that page rather than after
it. Registered afterwards it hears every other event and misses that one, which
costs you the denominator of every funnel built on top of it. `npm run verify`
fails the build if the order is ever reversed.

## Where the data comes from

The bundles live in a **Google Sheet**, not in the code:

<https://docs.google.com/spreadsheets/d/1ntgik1NX9IjqNmaSI1E8Sj95r4bPAE-90cdKzjbnssU>

That sheet is the source of truth for **which bundles exist and how a customer
is matched to one**. Adding a bundle is a spreadsheet edit, not a code change.

| Tab | Owns |
|---|---|
| Bundle rules | One row per bundle: functions, size, **Style (the personas it is built for)**, budget ceiling, number, name |
| Products | One row per bundle: number, a short working name, then its product URLs running across. The first URL is the anchor machine and stays first in the result grid |
| Personas | The customer types. These **drive question three** of the quiz |

The sheet holds no prices, no sales copy and no photographs, so those stay in
`src/quiz/bundles.js` and are joined on by bundle number.

| Lives in the sheet | Lives in `src/quiz/bundles.js` |
|---|---|
| Which bundles exist | Product catalogue: name, price, `was`, stock note, image |
| Functions, footprint, personas, budget ceiling | Per-bundle `tagline`, `pitch`, `trains`, `hero` |
| Which products are in each bundle, by URL | The `ROOMS` strip |

**A bundle price is always the sum of its products.** It is never typed in
anywhere, which is what lets a new sheet row price itself and means a price can
never drift out of step with the items listed beside it.

### Adding a bundle

1. Add a row to the rules tab and a column to the product matrix.
2. If it uses a product the catalogue has never seen, add it to `PRODUCTS` in
   `src/quiz/bundles.js` with its price and image. `npm run sync` names the
   missing URL if you forget.
3. Wait for the nightly sync, or get it live now: **Actions → Sync bundle data
   from the Google Sheet → Run workflow**. No code checkout needed.

That is enough to make it real. The bundle takes its name from the sheet's
**Bundle Name** column, prices itself, and renders with a generated tagline and
a product photo. Writing it a proper `tagline`, `pitch` and `trains` list in
`BUNDLE_COPY` is a separate improvement, not a blocker: until then the
"What you'll train" section is simply omitted rather than shown empty.

### The free-weight split

**Status: the code is done, the sheet is not.** Until the cells below are
changed, `src/quiz/sheet-data.js` carries the corrected tags as a hand edit and
the nightly sync will revert them.

Question one gained a seventh option on 22 Sep 2026:

| | label | help line |
|---|---|---|
| `power_rack` | Barbell lifts: squat, bench, deadlift | A rack to lift inside, with safeties |
| `free_weight` | Free weight - barbell / dumbbell lifts | Loose barbell, plates or dumbbells |

`power_rack` used to mean both the frame and the iron — its help line read
"Free-weight barbell work in a rack" — which left a visitor who wanted a pair of
dumbbells nothing to tick, and forced bundle 16, a folding bench and a pair of
adjustable dumbbells, to be tagged as a rack to be reachable at all. It then
introduced itself to customers as **"Barbell in 1 x 1.5 m"** and was offered to
people who had asked to squat inside a rack.

**Change these cells in the rules tab's Function column:**

| Bundle | Label | From | To |
|---|---|---|---|
| 3 | The Iron Fortress | Smith; Power Rack; Cable; Leg Press | Smith; Power Rack; **Free Weight**; Cable; Leg Press |
| 6 | The Level Up | Power Rack; Cable | Power Rack; **Free Weight**; Cable |
| 7 | The All-Rounder | Smith; Power Rack; Cable | Smith; Power Rack; **Free Weight**; Cable |
| 15 | The Starting Barbell | Power Rack | Power Rack; **Free Weight** |
| 16 | The Dumbbell Corner | Power Rack | **Free Weight** *(replaces, does not add)* |

`Free Weight`, `Barbell`, `Dumbbell` and the plurals all map to the same tag, so
the exact wording in the cell does not matter. The parser is case- and
punctuation-insensitive as it is for every other function.

**Why only those five.** The tag means the bundle contains something you pick
up. Ten bundles contain plates, but only four contain a **barbell** (3, 6, 7,
15) and one contains **dumbbells** (16). In bundles 1, 9, 10, 11 and 12 the
plates load the machine's own Smith or rack bar — there is no loose bar in the
box, so a visitor ticking this option and receiving one of them could not do the
lift they asked for. Bundle 14's plates load the leg press sled.

Worth a separate decision: **bundle 10 is called The Barbell Purist and contains
no barbell.** A power rack, a bench and 107.5 kg of plates, and nothing to load
them onto. The same is true of bundles 1, 9, 11 and 12, where it matters less
because those machines have an integrated bar. Adding a 1.8 M Olympic Bar ($179)
to bundle 10's product row would fix the bundle and earn it the tag.

**The guard.** `test/matcher.test.mjs` asserts that every option on question one
is carried by at least one bundle. The sync workflow runs `npm run check` before
it commits, so if the sheet comes back without `free_weight` the sync fails and
refuses to push, and the quiz keeps serving the last good data rather than
offering an option nothing can answer.

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

`.github/workflows/sync-sheet.yml` runs the sync **daily at 06:30 Singapore
time**, and on demand from the Actions tab. It commits only when something
actually changed, and only after `npm run check` passes, so a sheet edit that
breaks the quiz stops in CI rather than on a customer's screen.

The schedule is written `30 22 * * *` because **GitHub cron is always UTC** and
has no timezone field: 06:30 SGT is 22:30 UTC the previous day. Singapore has
not observed daylight saving since 1935, so that offset is fixed all year and
the line never needs a seasonal correction. The job itself runs with
`TZ=Asia/Singapore`, so every timestamp it logs reads in local time.

**Timing:** the sheet is edited in Singapore office hours and the quiz is read
by Singapore customers, who browse in the evening. Running before the working
day puts yesterday's edits live before anyone arrives, and leaves a full
business day to spot a problem before the evening peak. An end-of-day sync would
instead push every change live at the exact hour traffic is highest.

So an edit made on Monday afternoon goes live early Tuesday. If that is too slow
for a particular change, **Run workflow** does it in about a minute.

One failure mode worth knowing: **GitHub disables scheduled workflows after 60
days of repository inactivity**, and emails only the repo owner. Sheet changes
produce commits, which reset that clock, but a long quiet stretch can still trip
it. If bundles stop tracking the sheet, check the Actions tab first; the fix is
an "Enable workflow" button, not a code change.

### Why the data is committed rather than fetched live

The quiz ships as one static file with no runtime dependencies, and the
exhaustive sweep only means anything if the data it swept is the data
that ships. Committing the sheet's contents keeps both properties.

If you want sheet edits to appear without waiting for the nightly sync, add
`sheet-live` to the tag and fill in the tab gids in `config/sheet.json`. The
component then re-reads the sheet after first paint. It **fails silently by
design**: a private sheet, an offline visitor, a blocked request or a
half-edited row all leave the committed data in place, so what a customer sees
is never worse than the snapshot that shipped. Outcomes surface on the
`quiz:sheet` event and in the console.

### The personas tab drives question three

The quiz's third question is generated from this tab. The options a visitor sees
are the personas' own quotes, with the explanation underneath as helper text,
and the rules tab's **Style** column says which personas each bundle is built
for. Adding a persona there and using it on the rules tab is enough to change
what the quiz asks, with no code change.

A bundle can serve more than one persona: put them in one cell separated by
commas, as bundle 3 does.

Two things are checked on every sync, because both names are typed by hand on
two different tabs weeks apart:

- a persona on the rules tab that is **not** on the personas tab **fails** the
  sync and names the typo, because it would create a bundle no customer could
  ever be matched to
- a persona that **no bundle is built for** logs a warning, because the option
  would show in the quiz but could never change the answer

Persona scoring is deliberately all or nothing. The question used to ask for a
training level, where beginner, intermediate and advanced sit on a line and
"one rung out" could sensibly score partial credit. Personas are not on a line:
a Convenience Seeker is not one step from a Serious Strength Trainer, they want
a different machine. Across 896 realistic answer sets, the persona picked
changes the matched bundle 33.6% of the time.

## How the matching works

`src/quiz/matcher.js` is a pure function with no DOM access and no imports from the component, which is what makes it testable in isolation.

Two hard filters run first: the bundle must fit the stated floor **in either orientation**, and it must cost no more than the stated budget. Survivors are scored out of 100:

| Weight | Component |
|---|---|
| 40 | Function coverage: how much of what they asked for it does, plus up to +0.15 for capability beyond that |
| 25 | Budget fit: rewards using the budget without wasting it |
| 20 | Space fit: rewards filling the room, since a bigger machine in the same floor is more capable |
| 15 | Persona match: 1 if the bundle is built for the persona picked, otherwise 0 |

When two bundles land within 2 points, the tie breaks on function coverage, then price, then footprint, then bundle number.

### The fallback ladder

If nothing passes both filters, constraints relax in a fixed order and the result view says so honestly rather than pretending:

1. Budget relaxed 10%. Banner: *"this one is $X over"*
2. Shorter dimension relaxed 0.5 m. Banner: *"needs about 0.5 m more depth than you entered"*
3. Cheapest bundle that fits on space alone
4. Nothing fits, a **"Let's talk"** card with a contact CTA. It never fabricates a bundle.

### When we simply don't stock it

The ladder relaxes *space* and *budget*. It cannot conjure a capability that is
not in the catalogue, and two options on question one are carried by exactly one
bundle each:

| Option | Only bundle | Needs |
|---|---|---|
| Simple pin-loaded machine circuit | The Fast Track | 1.6 × 2.0 m |
| App-guided digital resistance | The Silent Operator | $5,899 |

Anyone with a narrower room or a smaller budget than those demand cannot be
given what they asked for. The matcher already handled that sensibly — rung 2b
deliberately drops the relevance floor and returns a real bundle rather than the
contact card — but until 22 Sep 2026 **it did not say so**. Rung 2b returns
`FALLBACK.NONE`, and the banner only fired on a named rung, so the page showed a
substitute with no acknowledgement at all. Measured across the sweep space:

| Asked for, on its own | Shown a bundle containing none of it |
|---|---|
| App-guided digital resistance | 58.7% |
| Simple pin-loaded machine circuit | 36.0% |
| Guided pressing (Smith) | 17.1% |
| Cable work | 4.4% |

`match()` now returns a **`gaps`** array alongside `primary`. One entry per thing
the visitor asked for that the answer does not do, carrying why (`space`,
`budget`, `both`, `combination`) and the bundle to quote back at them. The result
view leads with it, under **No exact match** when the bundle covers nothing that
was asked for and **Partial match** when it covers some:

> **No exact match**
> Nothing we build with machine circuit fits your space. The smallest is The Fast Track, which needs 1.6 × 2.0 m.
> Here's the closest we have.

Naming the figure is the point. "We don't have one that fits" invites the reply
"then what would?", and the visitor is not in a position to ask — quoting the
smallest one we make, with its footprint, tells someone with a 1.5 m wall exactly
where they stand. `gaps` is empty on a clean match, and always empty for
**No preference**: the visitor declined the question, so there is nothing we can
have failed to give them.

### Coverage

`npm run sweep` runs every realistic answer combination (170,625 of them: function sets, room sizes, all five personas and the budget range) and asserts every bundle is reachable and nothing throws. Current distribution:

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

32.0% of combinations hit the fallback ladder, almost all of them floors under 1.5 m on a side or budgets under $2,750, rare in practice. 12.0% reach the "let's talk" card. The ladder never throws.

Rung 3 currently never fires: rung 2's space relaxation always unlocks something affordable first. It is kept because a future price or footprint change could open that gap.

## The insights dashboard

`/insights.html`, built from `src/insights.html`. Sessions, screen dropoff,
bundles viewed and CTA taps, read from the quiz's own events.

**It is not linked from anywhere, and that is enforced.** No page a customer can
reach mentions it; `npm run verify` fails the build if one ever does. Open it by
typing the URL.

### Turning it on

The database is live. Supabase project **`Homegym-sg`**
(`bsbqiupwdxyzfxgjxazs`, Sydney), with `db/001_quiz_events.sql` applied and
verified end to end on 22 Sep 2026: an insert through the publishable key is
accepted, a `SELECT` through the same key returns nothing, and
`quiz_insights()` reports the session correctly.

Two things are left, and both are in the Vercel console:

1. **Set two environment variables**, then redeploy. (The API token this repo's
   tooling uses is not permitted to write project env vars, which is why these
   are by hand.)

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | `https://bsbqiupwdxyzfxgjxazs.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → the **publishable** key (`sb_publishable_…`) |

   Use the publishable key, never the service role key. The publishable one is
   held to `INSERT` by the table's RLS policy and can read nothing back; the
   service role key bypasses RLS entirely and would turn a leaked function log
   into a full database compromise.

2. **Set a deployment password.** Vercel → the project → Settings → Deployment
   Protection → Password Protection. This is what actually keeps the numbers
   private, and it covers `/api/insights` and the page together with one
   setting. Until it is on, anyone with the URL can read the dashboard.

Until step 1 is done the page says exactly that, in plain words, rather than
showing a broken chart. The quiz is unaffected either way.

### How it flows

```
quiz event  ──►  collector in bundle-quiz.html  ──►  POST /api/collect
                 (batched, sendBeacon on exit)              │
                                                            ▼
                                                    public.quiz_events
                                                            │
insights.html  ◄──  GET /api/insights  ◄──  public.quiz_insights(days)
                                            (aggregates only, never rows)
```

**The browser never holds a database key.** Both directions go through a
serverless function. The key those functions hold can `INSERT` and nothing else:
there is deliberately no `SELECT` policy on the table, so that key cannot read
back a single row, and reads go through a `security definer` function that
returns counts and has no argument that will make it return a `session_id`.

### What it does not collect

No IP address, no user agent, no referrer, no cookie, no name, email or phone.
A `session_id` is random, minted in `sessionStorage`, and dies with the tab, so
it cannot join a visitor to a second visit, to another device, or to the details
they hand over on WhatsApp thirty seconds later. It exists to turn seven loose
events into one funnel row.

That is a deliberate position, not an oversight: under Singapore's PDPA it keeps
the table out of "personal data" altogether, which means no consent banner on
the quiz, no access-or-correction obligation, and nothing in it to breach. **Add
an IP column and all three of those stop being true.**

### Reading it honestly

- **Sessions are per tab.** One customer who comes back tomorrow is two sessions. There is no way to tell the difference without storing something that identifies them, which is the trade above.
- **Screen dropoff counts "ever reached", not "ended on".** Back exists: someone who reaches Budget and steps back to Floor space still counts as having reached Budget.
- **Matched and explored are kept apart** on the bundles chart, and summing them would hide the more interesting one. *Explored* is the visitor opening a bundle the matcher did not choose for them, which is them disagreeing with the match.
- **The component embed reports nothing.** The collector lives in `bundle-quiz.html`, so it covers the iframe embed, which is what the README recommends. A site that drops `homegym-bundle-quiz.min.js` straight onto a page instead gets no telemetry; a collector for that path belongs inside the bundle and is not written yet.

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
4. **Footprints are the equipment, not the room.** Confirmed with the client on 22 Sep 2026: the sheet's Size column is *the floor space the equipment will occupy*, and nothing more. It does **not** include room to stand, to walk round the frame, or to lie back on a bench and press. An earlier draft of this list said the opposite, that the figures "read as working areas including clearance". That was wrong, and it mattered: read the generous way, a 1.6 × 2.0 m machine circuit sounds like it needs a 1.6 × 2.0 m room, and it does not.

    In practice: bundle 16's `1 × 1.5 m` is the folding bench unfolded plus its pair of dumbbells beside it, not a corner anyone can train in. `npm run check:fit` measures against this convention, which is why it can report a bundle fitting with 5 cm spare and call that TIGHT rather than a failure, and why its closing line reminds you the bench, the plates and the lifter all need floor the column never counted. Question two asks the visitor for the space they have *available for equipment*, so both sides of the comparison agree — but a customer who reads their own answer as "the room I'll train in" will still be unhappy with a machine that technically fits. The figures themselves are also still unverified: they came from the source spreadsheet, not from measuring machines. A customer who buys on a wrong footprint is a returned 338 kg machine. **This is the highest-risk item on the list.**
5. **Bundles 1, 4, 7 and 9 share identical function tags** (`smith` + `power_rack` + `cable`), separated only by space, persona and price. Adding a distinguishing tag to each, `folding`, `self_spotting`, `connected`, plus a matching quiz option would sharpen them.
6. ~~**`contact-url` points at `https://homegym.sg/contact`,** which has not been confirmed.~~ Confirmed resolving (HTTP 200) on 8 Sep 2026. It is only ever used as a fallback when no `whatsapp` number is set, which is not the case in production.
6b. **Their link blue `#22B4FF` fails WCAG AA at 2.32:1 on white**, here and on the live site, on every product link. The quiz uses a darkened `#0077B3` for text. Worth fixing site-wide.
7. **The budget slider starts at $2,500** while the cheapest bundle is $2,241, so every bundle clears its floor. Dropping the minimum to $2,000 would capture sub-$2,500 traffic but needs a lighter bundle to answer it with.

One correction to the source brief: it gives The Barbell Purist's saving as $208. The catalogue data gives **$200** (Folding Rack $151 + Olympic set $49). The page shows the computed figure, not the quoted one.

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
npm run sync:images  # refresh install photos from the Instagram feed, report the rest
npm run sync:all     # both of the above, which is what the nightly job runs
npm run build    # src/ -> dist/, including the inlined and standalone quiz bundles
npm test         # prototype engine (3,072 combinations) + matcher and sheet-parser units
npm run sweep    # assert every bundle is reachable across 170,625 combinations
npm run verify   # validate dist/ structure, noindex tags, internal links, quiz bundle
npm run check    # all four, in order, this is what CI and Vercel run

npm run check:images   # confirm every hotlinked HomeGym image still resolves
npm run check:heroes   # confirm each bundle's install photo shows that bundle's machine
npm run check:fit      # confirm each anchor machine fits the footprint its row claims
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
- any bundle becomes unreachable, or the matcher throws on any of 170,625 combinations
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
