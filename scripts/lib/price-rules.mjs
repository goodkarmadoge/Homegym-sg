// When a scraped price may replace a committed one, and when it may not.
//
// SEPARATED FROM sync-prices.mjs SO IT CAN BE TESTED.
//   These are the rules that decide whether a number a customer reads gets
//   rewritten by a machine at 02:30 in the morning with nobody watching. The
//   script around them fetches 23 pages and edits a file, which makes it awkward
//   to exercise; a pure function of (committed, parsed) is not. Everything here
//   is decided from its two arguments, so a test of it means something.
//
// THE POSTURE: A MIS-READ AND A BARGAIN LOOK IDENTICAL FROM HERE.
//   Nothing in this file can tell "HomeGym halved the price" from "the pattern
//   started matching the related-items carousel". Both arrive as a smaller
//   number on a page that returned HTTP 200. So the only safe reading of a large
//   move is "this is probably a bug", and the only safe action is to keep the
//   committed price and say so. A stale price is a disappointed customer; an
//   invented one is a wrong invoice.

/**
 * How far a price may move before a human has to look.
 *
 * 35% clears every real promotion in the catalogue as at 30 Aug 2026 — the
 * widest committed discount is the Olympic set, 580 from 820, which is 29% —
 * while still catching the failure this guard is for: a pattern that reports a
 * $292 bench as $29 or $2,920.
 *
 * Raising it is a decision about how much a machine may change unattended, not
 * a tuning knob. If a genuine promotion is ever refused, the right move is to
 * apply that one by hand and leave the limit alone.
 */
export const MAX_MOVE = 0.35;

/**
 * Refuse the whole run if more than this share of the catalogue yields no price.
 *
 * A third is deliberately generous. The signal is not "a page is broken" but
 * "the site no longer looks the way this code believes", and in that state a
 * price that DID parse is as likely to be wrong as right.
 */
export const MAX_FAILED_SHARE = 1 / 3;

/**
 * What to do about one product.
 *
 * `committed` is `{ key, price, was }` as it stands in PRODUCTS. `parsed` is
 * what product-page.mjs read, or `{ error }` if the page would not load.
 *
 * Returns one of:
 *   { kind: 'keep' }                           the page agrees, nothing to do
 *   { kind: 'update', price?, was? }           apply these; each is { from, to }
 *   { kind: 'refuse', reason, counts }         leave it alone and report
 *
 * `counts` on a refusal says whether it counts towards MAX_FAILED_SHARE: a page
 * that would not load or would not parse is evidence about the SITE, while a
 * price that parsed cleanly but moved too far is evidence about one PRODUCT. Only
 * the former should be able to abort the whole run.
 */
export function decidePrice(committed, parsed) {
  const money = (n) => (n == null ? 'none' : String(n));

  if (!parsed || parsed.error) {
    return {
      kind: 'refuse',
      counts: true,
      reason: `page would not load (${parsed?.error || 'no response'}). Keeping ${money(committed.price)}.`
    };
  }

  const { price, was, wasRaw, wasRejected } = parsed;

  if (price == null) {
    return {
      kind: 'refuse',
      counts: true,
      reason: `no price could be read from the page. Keeping ${money(committed.price)}.`
    };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return {
      kind: 'refuse',
      counts: true,
      reason: `the page yielded a price of ${price}, which is not a price. Keeping ${money(committed.price)}.`
    };
  }

  // Guard against a committed zero as well as a scraped one: the move is a
  // ratio, and a committed 0 would make every move infinite.
  if (!Number.isFinite(committed.price) || committed.price <= 0) {
    return {
      kind: 'refuse',
      counts: false,
      reason: `the committed price is ${money(committed.price)}, which cannot be compared. Fix it by hand.`
    };
  }

  const move = Math.abs(price - committed.price) / committed.price;
  if (move > MAX_MOVE) {
    return {
      kind: 'refuse',
      counts: false,
      reason:
        `page says ${price}, committed is ${committed.price}, a ${(move * 100).toFixed(0)}% move. ` +
        'Too big to apply unattended — check the page, then edit PRODUCTS by hand.'
    };
  }

  const priceChanged = price !== committed.price;
  const wasChanged = (was ?? null) !== (committed.was ?? null);
  if (!priceChanged && !wasChanged) return { kind: 'keep' };

  return {
    kind: 'update',
    price: priceChanged ? { from: committed.price, to: price } : null,
    was: wasChanged ? { from: committed.was ?? null, to: was ?? null } : null,
    // Report-only. A page offering a was-price BELOW its selling price is the
    // mis-read documented in product-page.mjs, and seeing it in the log is how
    // anyone would learn the page had changed shape.
    wasRejected: wasRejected ? wasRaw : null
  };
}

/** True when this many failures out of this many products should abort the run. */
export const shouldAbort = (failed, total) => total > 0 && failed / total > MAX_FAILED_SHARE;
