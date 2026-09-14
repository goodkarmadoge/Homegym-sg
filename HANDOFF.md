# Bundle quiz: integration handoff

For whoever is putting the quiz onto homegym.sg. Everything here is mechanics.
The README is the reference for the component itself; this is the order to do
things in and the things that will bite.

The quiz is a **custom element with no dependencies**. No framework, no build
step, no npm install on your side. One JavaScript file and one tag.

---

## 1. Pick a path

Two ways in. They are not equivalent, and the choice is yours to make because it
depends on things about your deployment we cannot see from outside.

| | **Script tag** | **iframe** |
|---|---|---|
| What you host | one 107 KB JS file | nothing |
| Sits in page flow | yes, natively | needs the height script |
| Shares page fonts, scroll, focus | yes | no |
| Analytics | events reach your `dataLayer` directly | needs `postMessage` plumbing |
| Breaks if the quiz is redeployed | no, you hold the file | no, but you inherit changes instantly |
| Content-Security-Policy work | possible, see §4 | none |
| Updating the bundle data | redeploy the file | automatic |

**Recommendation: the script tag.** It is the reason the component was built as a
custom element rather than a page. The quiz renders inside the host page's own
document, so it inherits the page width, scrolls as one document, keeps focus
order intact, and fires analytics events straight into `dataLayer` with no
cross-frame plumbing. The iframe path exists for the case where adding a script
to the Magento theme is more trouble than it is worth.

Everything below assumes the script tag unless it says otherwise.

---

## 2. Get the file

```
npm run build
```

Writes `dist/homegym-bundle-quiz.min.js`. Copy it to wherever Magento serves
static assets, for example `pub/media/homegym/` or your theme's `web/js/`.

It is 107 KB raw, **26.5 KB gzipped**, which is what your visitors actually
download. It has no external requests of its own beyond the product images,
which already come from your CloudFront.

Serve it with a long `Cache-Control` and a version in the filename or query
string. It changes only when the bundle data or the quiz itself changes.

---

## 3. Paste this in

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap">

<style>
  homegym-bundle-quiz:not(:defined) { display: block; min-height: 620px; }
</style>

<script src="/media/homegym/homegym-bundle-quiz.min.js" defer></script>

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

Four things in there are easy to drop, and each has a visible consequence:

- **The Archivo `<link>`s.** Drop them only if homegym.sg already loads Archivo
  400/600/800. Otherwise the quiz falls back to the system font and stops
  matching the design system. Font loading is document-scoped, not shadow-root
  scoped, so it has to happen on your page, not inside the component.
- **The `:not(:defined)` rule.** Without it the page reflows when the element
  upgrades, which on a slow connection is a visible jump.
- **`heading-level`.** Set it one below the nearest heading above the quiz. Under
  a page `<h1>`, use `2`. Inside a section that already has an `<h2>`, use `3`.
  This is not cosmetic; see §5.
- **`whatsapp`.** This is the primary call to action. Without it the quiz falls
  back to `contact-url`, which converts worse.

The component carries its own styles in a shadow root, so it will not collide
with your theme's CSS in either direction, and you do not need to scope anything.

---

## 4. Check your Content-Security-Policy

Magento 2.4 ships a CSP, report-only by default. If yours is enforced:

- **`script-src`** must allow the bundle. Self-hosting under your own domain
  means `'self'` covers it.
- **`style-src`** must allow the component's stylesheet. It is a `<style>`
  element created at runtime and injected into the shadow root, and a
  nonce-based policy without `'unsafe-inline'` blocks it. **The failure mode is
  quiet:** the quiz renders as unstyled markup rather than throwing, so it looks
  broken without telling you why. Check the console for CSP violations before
  concluding the quiz is at fault.

`style-src-attr` is safe either way. The component uses no `style=""` attributes
at all; the one computed width, the progress bar, is set through the CSSOM,
which CSP does not govern.

---

## 5. Headings, and why they are not cosmetic

A shadow root scopes **styles**, not the accessibility tree. An `<h1>` inside the
component is an `<h1>` in your page's outline no matter how deeply it is nested.

Left at the default on a page that already has an `<h1>`, the quiz contributes a
second one. A screen-reader user navigating by heading hears two page titles and
the result's sections hang off the wrong one.

Set `heading-level` and all three tiers move together. On a page running `h1`
then `h2`, with `heading-level="3"`:

```
H1  [your page]  Home Gym Equipment Singapore
H2  [your page]  Build your bundle
H3  [quiz]       The Smart Smith
H4  [quiz]       What's in the bundle
H5  [quiz]       Vigor BF900 Pro Connected All-in-1 System
H4  [quiz]       Rooms we've built
```

Tiers stop at `h6` rather than emitting invalid tags.

---

## 6. Wire up analytics

Every meaningful action fires a `CustomEvent` that bubbles and crosses the shadow
boundary, so you can listen at `document` level without knowing the component is
there:

```html
<script>
['quiz:start','quiz:step','quiz:complete','quiz:product-click','quiz:cta-click',
 'quiz:alternate-view','quiz:restart'].forEach(function (name) {
  document.addEventListener(name, function (e) {
    window.dataLayer = window.dataLayer || [];
    dataLayer.push({ event: name.replace(':', '_'), ...e.detail });
  });
});
</script>
```

`quiz:complete` is the one that matters: it carries the full answer set, the
matched bundle, its price, and whether the fallback ladder was used. The README's
**Events** section has the payload for each.

**Worth instrumenting from day one:** the share of sessions where `quiz:complete`
reports `fallbackUsed`, and the share that reach the "let's talk" card with no
bundle at all. Swept across all 107,625 realistic answer combinations, the
fallback ladder is used by **38.9%** and **13.1%** end with no bundle. Those are
combinations, not visitors, and real traffic will not be spread evenly across
them, which is exactly why it is worth measuring. If the live numbers land near
these, the honest reading is a catalogue gap at particular room sizes rather than
a quiz that needs retuning.

---

## 7. If you go the iframe route instead

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
    if (e.origin !== origin) return;
    if (!e.data || e.data.type !== 'homegym-quiz:height') return;
    f.style.height = e.data.height + 'px';
  });
}());
</script>
```

The `e.origin` check is not optional. Without it any page in any other tab can
post a height at yours.

**The frame must be allowed to load,** which is a response header on the quiz's
deployment, not something your page can grant. It currently sends:

```
Content-Security-Policy: frame-ancestors 'self' https://homegym.sg https://www.homegym.sg
```

Embedding from a staging host or any other domain is refused by the browser, with
an empty box and a console error. Tell us the origin and it goes on the list.

Without the height script the quiz still works; it just sits in a fixed box and
scrolls internally.

---

## 8. Before you switch it on

Integration is the easy half. These are open questions about the **data**, and
they are the ones that cost money if they are wrong. Full detail in the README
under *Before this goes live*.

1. **Footprints are unverified.** They came from the source spreadsheet, not from
   measuring machines. The quiz tells people what fits their room. A customer who
   buys on a wrong footprint is a returned 338 kg machine. **Highest risk on the
   list, and worth an afternoon with a tape measure before launch.**
2. **Prices are a 30 Aug 2026 snapshot** and several are promotional. They will
   drift. The durable fix is a nightly job reading the Magento product API.
3. **Image URLs are CloudFront cache paths.** The `/cache/c0dcb29ef.../` segment
   changes when Magento regenerates its image cache, which would 404 every image
   at once. There is a fallback tile so the grid does not break, but resolving
   images from the product API is the real fix.
4. **The Vigor X20 Sliding Bench is out of stock** and its URL slug disagrees
   with its product page title. Confirm the SKU.

---

## 9. Changing the bundles later

Bundle data lives in a Google Sheet, not in the code. Edit the sheet, and a
nightly GitHub Action regenerates `src/quiz/sheet-data.js` and opens the change
as a commit. Rebuild and redeploy the one JS file to pick it up.

You do not need us for this. README, *Where the data comes from*, has the tab
layout and the rules for adding a bundle.

---

## Questions this handoff cannot answer

- Which Magento template the quiz should live in, and whether your theme's
  container already constrains width (the component fills its parent).
- Whether your CSP is enforced or report-only.
- Whether `cart-endpoint` should be wired up. It is off by default, so WhatsApp
  is the only call to action. Turning it on adds an **Add all to cart** button
  that POSTs the product list to an endpoint you specify.
