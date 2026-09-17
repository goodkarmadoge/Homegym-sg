# Bundle quiz: integration handoff

For whoever is putting the quiz onto homegym.sg. Everything here is mechanics.
The README is the reference for the component itself; this is the order to do
things in and the things that will bite.

The quiz is a **custom element with no dependencies**. No framework, no build
step, no npm install on your side. One JavaScript file and one tag.

---

> **Decision, 14 Sep 2026: the quiz ships as an iframe**, pointed at the
> deployment described in §7. That makes §7 the section to read and §1's
> recommendation a record of what was weighed rather than a live question.
>
> **The framing blocker is cleared.** The deployment used to send
> `X-Frame-Options: SAMEORIGIN`, which refused the embed outright. It now sends
> a `frame-ancestors` allowlist naming homegym.sg and its subdomains, so the
> iframe loads. Confirm it on the wire once before you schedule the work: see
> §7, *The frame has to be allowed to load*.
>
> Choosing the iframe also means quiz events do not reach your GTM on their
> own. The forwarder in §6 is what buys that back, and it is not optional if
> you want to measure anything.

---

## 0. Is this copy-paste?

Straight answer, because it decides how you schedule the work:

| | Copy-paste alone? | What else you do |
|---|---|---|
| **A. iframe** | **Yes.** | Nothing. Paste ~15 lines into a CMS block and it works. |
| **B. Script tag, self-hosted** | Almost. | Put **one file** where Magento serves static assets, then paste. |
| **C. Script tag, hot-linked** | **Yes.** | Nothing, but read the warning below. |

**A is genuinely zero-effort.** If the goal is to see the quiz live on a
homegym.sg page this afternoon, take it, and move to B later if you want the
quiz in the page flow rather than in a box.

**B is the one to launch on**, and the "one file" is the only step that is not
paste: `homegym-bundle-quiz.min.js`, 111 KB, no dependencies. Drop it in
`pub/media/` or your theme's `web/js/`, point the `<script src>` at it, done. It
is a static asset like any image you have ever uploaded.

**C means pointing `<script src>` at `https://homegym-sg.vercel.app/homegym-bundle-quiz.min.js`.**
That file is live and loading it cross-origin works. But that is the pro bono
review deployment, not production infrastructure: it is served `noindex`, nobody
has promised it uptime, and anything pushed to it changes what your visitors run
with no review on your side. **Fine for a staging trial, wrong for launch.** If
you use it to try the quiz out, budget the ten minutes to switch to B before it
goes in front of customers.

> **One catch on C right now.** The file currently at that URL is built from the
> `main` branch, which does **not** yet include the `heading-level` attribute
> described in §5. Until the handoff branch merges, hot-linking gets you a quiz
> whose headings will not nest under your page's own. Self-host from a build of
> the handoff branch and you get it today.

---

## 1. Pick a path

Two ways in. They are not equivalent, and the choice is yours to make because it
depends on things about your deployment we cannot see from outside.

| | **Script tag** | **iframe** |
|---|---|---|
| What you host | one 111 KB JS file | nothing |
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

Two ways, and you do **not** need the repository for the first:

1. **Ask for it.** `homegym-bundle-quiz.min.js` is a single static file. Have it
   emailed or dropped in shared storage. Nothing in it is environment-specific,
   so the file you are handed is the file that runs in production.
2. **Build it**, if you have the repo: `npm run build` writes it to `dist/`.
   There is nothing to install first — the repo has no dependencies and the
   build is plain Node.

Either way, copy it to wherever Magento serves static assets, for example
`pub/media/homegym/` or your theme's `web/js/`.

It is 111 KB raw, **27.6 KB gzipped**, which is what your visitors actually
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

**On the iframe, this is required, not optional.** The quiz fires its events on
the iframe's own document, so your GTM on homegym.sg hears nothing by default:
no funnel, no conversion, no idea anyone took the quiz. The page forwards them
to the parent and this is the listener that receives them. It is the §7 height
snippet with one extra branch, so **use this version and not both.**

```html
<script>
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
</script>
```

Verified end to end in a browser against a real cross-document iframe, not
assumed: `quiz_start`, three `quiz_step`s and `quiz_complete` all arrive in the
parent's `dataLayer` with their payloads intact.

*(If you ever switch to the script-tag embed, drop all of this and just listen
for the events on your own `document` — no forwarding involved. The README's
**Events** section has that version.)*

`quiz:complete` is the one that matters: it carries the full answer set, the
matched bundle, its price, and whether the fallback ladder was used. The README's
**Events** section has the payload for each.

**Two values in `answers.functions` are not training functions.** Question one
has two shortcuts and both reach your `dataLayer`: all six tags means the visitor
ticked **All of the above**, and `["_any"]` means they ticked **No preference**
and declined the question. Segment on `_any` rather than filtering it out —
"didn't know what they wanted" is the cohort most likely to need a salesperson,
and it is worth knowing how big it is.

**Worth instrumenting from day one:** the share of sessions where `quiz:complete`
reports `fallbackUsed`, and the share that reach the "let's talk" card with no
bundle at all. Swept across all 112,875 realistic answer combinations, the
fallback ladder is used by **38.9%** and **13.1%** end with no bundle. Those are
combinations, not visitors, and real traffic will not be spread evenly across
them, which is exactly why it is worth measuring. If the live numbers land near
these, the honest reading is a catalogue gap at particular room sizes rather than
a quiz that needs retuning.

---

## 7. The iframe embed

This is the chosen path. Paste this where the quiz should appear, then add the
§6 listener — or, better, paste §6's version of the script, which does both jobs.

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

The `height` in the style attribute is only what shows before the first message
arrives; 900px is about a first question, so the page does not jump.

Without the height script the quiz still works; it just sits in a fixed box and
scrolls internally.

### The frame has to be allowed to load

This is a response header on the quiz's deployment, not something your page can
grant itself. It used to be the one blocker between you and a working embed;
**it is now cleared.** The deployment sends:

```
Content-Security-Policy: frame-ancestors 'self' https://homegym.sg https://*.homegym.sg
```

That permits homegym.sg and **any subdomain of it**, so a staging or shop
subdomain works without asking us for anything. What it does *not* cover is a
different domain entirely, or homegym.sg over plain `http` — both are refused
with an empty box and a console error rather than a warning.

It previously sent `X-Frame-Options: SAMEORIGIN`, which refuses cross-origin
framing outright. That header is gone rather than loosened: it has no allowlist
form current browsers honour, and where both headers are present it wins. So
when you check, **`X-Frame-Options` should be absent from the output, not merely
permissive**:

```
curl -I https://homegym-sg.vercel.app/bundle-quiz.html
```

Worth running once before you conclude anything else is broken. `npm run verify`
fails the build if either half regresses — the header returning, or
`frame-ancestors` ceasing to cover homegym.sg.

### What you are depending on

That URL is the pro bono review deployment. It is served `noindex`, nobody has
committed to its uptime, and anything pushed to it changes what your visitors
run with no review on your side. That is an accepted trade for not hosting
anything; it is worth revisiting once the quiz is earning its keep, and §0's
option B is the ten-minute move away from it.

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
