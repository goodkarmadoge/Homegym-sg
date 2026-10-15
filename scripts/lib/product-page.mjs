// Reading a homegym.sg product page: name, price, was-price, image, dimensions.
//
// WHY THIS IS ITS OWN FILE.
//   Two scripts need the same knowledge and they must not drift apart.
//   new-products.mjs reads a page to print a new catalogue entry; sync-prices.mjs
//   reads the same page nightly to correct the price in an entry that already
//   exists. If each kept its own copy of these patterns, the nightly job would
//   eventually extract a different number from the same markup than the tool
//   that set it, and the diff would look like a price change at HomeGym rather
//   than a bug here. The repo already carries one hand-synced pair of pattern
//   tables, SIGNATURE in sync-images.mjs and check-heroes.mjs, and that is a
//   wart, not a model to copy.
//
// WHY SCRAPING AND NOT THE MAGENTO API.
//   README's Known Issue 1 proposes "a nightly job that reads the Magento
//   product API". That would be better: typed numbers rather than inferred ones.
//   But these patterns are the ones PROVEN to work against the real pages, in
//   CI, on 22 Sep 2026, and no API endpoint on homegym.sg has been shown to be
//   reachable without a token. Scraping something that works beats an API that
//   might not exist. If the API turns up, replace parseProductPage and nothing
//   above it changes.
//
// WHAT MAGENTO ACTUALLY SERVES, LEARNED THE HARD WAY.
//   Every pattern below exists because the simpler version of it failed on a
//   real page. See the comments on each.

/**
 * HTML entities out of a Magento string.
 *
 * Magento escapes its own product names, so og:title arrives as
 * "Vigor&#x20;Titan&#x20;G9". Left alone that string reaches a customer
 * verbatim, spaces and all.
 */
export function decode(s) {
  if (s == null) return null;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/** First capture of the first pattern that matches, or null. */
export const first = (html, patterns) => {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1].trim();
  }
  return null;
};

/** A money string to a number, or null. `|| null` also eats a parsed 0. */
export const money = (s) => (s == null ? null : Number(String(s).replace(/[^0-9.]/g, '')) || null);

/**
 * Every dimension-shaped run of numbers on the page, with its surrounding words.
 *
 * The first version of this split the de-tagged page into LINES and kept the
 * ones mentioning cm. It found nothing on any of the eight pages, because
 * Magento puts the spec in a table and each cell is its own element: by the time
 * tags became newlines, "209 x 92 x 225cm" had been cut into three pieces. So
 * this matches the numbers wherever they sit and carries the neighbouring text
 * along, which is what names the axes.
 */
export function dimensionLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const flat = decode(text);
  const re = /(\d{1,3}(?:\.\d+)?)\s*[x×*]\s*(\d{1,3}(?:\.\d+)?)(?:\s*[x×*]\s*(\d{1,3}(?:\.\d+)?))?\s*(cm|mm|m\b)/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(flat)) !== null) {
    const from = Math.max(0, m.index - 90);
    const to = Math.min(flat.length, m.index + m[0].length + 90);
    out.add(('...' + flat.slice(from, to) + '...').replace(/\s+/g, ' '));
    if (out.size >= 8) break;
  }
  return [...out];
}

/**
 * The catalogue-shaped facts on a product page.
 *
 * Returns `{ name, price, was, wasRaw, wasRejected, image }`. A field that could
 * not be read is null — NEVER a guess and never a zero, because a caller that
 * wrote a guessed price would put a wrong number in front of a customer.
 */
export function parseProductPage(html) {
  const name = decode(first(html, [
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
    /<span[^>]+itemprop="name"[^>]*>([^<]+)</i,
    /<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>\s*(?:<span[^>]*>)?([^<]+)/i,
    /<title>([^<]+)<\/title>/i
  ]));

  // Ordered most to least trustworthy. The bare data-price-amount is third
  // because it also appears on related-item tiles further down the page, so it
  // is a fallback, not a first choice.
  const price = money(first(html, [
    /<meta[^>]+itemprop="price"[^>]+content="([^"]+)"/i,
    /data-price-type="finalPrice"[^>]*data-price-amount="([^"]+)"/i,
    /data-price-amount="([^"]+)"/i,
    /"final_price"\s*:\s*"?([0-9.]+)/i
  ]));

  // A "was" that is not ABOVE the selling price is a mis-read, not a discount.
  // Both showed up on the real pages: one product reported was === price, and
  // the dumbbell reported 175 against a price of 580, picked up from a related
  // item's markup. Either would have rendered a nonsense strikethrough.
  const wasRaw = money(first(html, [
    /data-price-type="oldPrice"[^>]*data-price-amount="([^"]+)"/i,
    /"oldPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"?([0-9.]+)/i,
    /"regular_price"\s*:\s*"?([0-9.]+)/i
  ]));
  const was = (wasRaw != null && price != null && wasRaw > price) ? wasRaw : null;

  const image = first(html, [
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
    /"(https:\/\/[^"]*cloudfront\.net\/catalog\/product\/cache\/[^"]+\.(?:jpg|jpeg|png|webp))"/i
  ]);

  return { name, price, was, wasRaw, wasRejected: wasRaw != null && was == null, image };
}

/** Fetch a product page. `{ html }` or `{ error }`; never throws. */
export async function fetchProductPage(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': 'homegym-quiz-catalogue/1.0' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { html: await res.text() };
  } catch (err) {
    return { error: err.message };
  }
}
