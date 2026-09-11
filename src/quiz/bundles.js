/**
 * Homegym.sg, Bundle Quiz data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR ALL PRODUCTS, PRICES AND BUNDLES.
 * To change a price, swap a product or re-price a bundle, edit only this file.
 * See README.md → "Editing the data".
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * KNOWN ISSUE 1, PRICE SNAPSHOT.
 *   Every price below is a 30 Aug 2026 snapshot of homegym.sg SALE prices.
 *   Several are promotional and WILL drift: tinytitan, bodyx-cube, titan-x20,
 *   im2000, folding-rack, olympic-set, bar-22m, bar-18m (all carry a `was`).
 *   Re-verify before any campaign. A nightly job that reads the Magento product
 *   API and rewrites PRODUCTS is the durable fix, README → "Keeping prices honest".
 *
 * KNOWN ISSUE 2, IMAGE URLS ARE CLOUDFRONT CACHE PATHS.
 *   The `/cache/c0dcb29ef46d222f886111be6e10f76c/` segment is a Magento image-cache
 *   hash. It changes when the image cache is regenerated, silently 404ing every
 *   image at once. The result grid degrades to initial-letter tiles rather than
 *   breaking, but the real fix is resolving images from the product API.
 */

import { SHEET_BUNDLES, PERSONAS } from './sheet-data.js';

/**
 * Product catalogue, keyed by id. Prices in SGD.
 *   price, current sale price. This is what the bundle total is built from.
 *   was    pre-sale price, or null. Drives the struck-through price and SALE tag.
 *   note   optional availability badge shown on the product card.
 */
export const PRODUCTS = {
  'tinytitan': {
    // Published machine footprint, metres, from the product page:
    //   209 x 92 x 225cm (width x depth x height), Depth with safety arm: 115cm
    // depth is the 115cm safety-arm figure, since the arms are down in use
    footprint: { w: 2.09, d: 1.15 },
    name: 'Vigor TinyTitan All-in-1 Trainer',
    price: 2200,
    was: 2799,
    url: 'https://homegym.sg/strength/multi-functional.html/space-saving/vigor-tinytitan-all-in-1-trainer.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/t/i/tinytitan11.jpg'
  },
  'bodyx-cube': {
    // Published machine footprint, metres, from the product page:
    //   120 x 137 x 216cm, Folded: 60 x 124 x 216cm (Depth x Width x Height)
    // unfolded; the axis order is read from the folded triple, which is labelled
    footprint: { w: 1.37, d: 1.2 },
    name: 'Bodyx Folding Cube Smith Machine Functional Trainer Combo',
    price: 3520,
    was: 3999,
    url: 'https://homegym.sg/strength/multi-functional.html/functional-trainer/bodyx-folding-cube-smith-machine-functional-trainer-combo.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/c/u/cube_2_35.jpg'
  },
  'titan-x20': {
    // Published machine footprint, metres, from the product page:
    //   206.8 x 178.8 x 224cm (Width x Depth x Height)
    footprint: { w: 2.07, d: 1.79 },
    name: 'Vigor Titan X20 All-in-1 Trainer',
    price: 4899,
    was: 5899,
    url: 'https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-titan-x20-all-in-1-trainer.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/x/2/x20-main2.jpg'
  },
  'bf900-pro': {
    // Published machine footprint, metres, from the product page:
    //   153 x 132 x 218cm (L x W x H)
    footprint: { w: 1.53, d: 1.32 },
    name: 'Vigor BF900 Pro Connected All-in-1 System',
    price: 3599,
    was: null,
    url: 'https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-bf900-pro-connected-all-in-1-system.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/b/f/bf900.jpg'
  },
  'xpress-pro': {
    // Published machine footprint, metres, from the product page:
    //   174.4 x 152.3 x 211 cm (L x W x H)
    footprint: { w: 1.75, d: 1.53 },
    name: 'Vigor Xpress Pro Home Gym Station',
    price: 2350,
    was: null,
    url: 'https://homegym.sg/strength/multi-functional/multi-gym-85.html/vigor-xpress-pro-home-gym-station.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/h/g/hg8000.jpg'
  },
  'infinity-halfrack': {
    // No dimensions published on the product page, checked 8 Sep 2026.
    footprint: null,
    name: 'Infinity Half Rack Dual Cable Combo',
    price: 2299,
    was: null,
    url: 'https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/i/m/img_4453.jpg'
  },
  'infinity-aio': {
    // No dimensions published on the product page, checked 8 Sep 2026.
    footprint: null,
    name: 'Infinity All-in-1 Trainer',
    price: 2899,
    was: null,
    url: 'https://homegym.sg/strength.html/infinity-series/infinity-all-in-1-trainer.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/i/n/infinity-31in1_1.jpg'
  },
  'aeke-s1-pro': {
    // Published machine footprint, metres, from the product page:
    //   Folded: 71.5 x 42.5 x 185cm, Unfold: 71.5 x 135.5 x 185cm (L x W x H)
    // UNFOLDED. The folded 42.5cm depth is storage, not the footprint in use
    footprint: { w: 0.72, d: 1.36 },
    name: 'AEKE S1 PRO Smart Home Gym',
    price: 5899,
    was: null,
    url: 'https://homegym.sg/strength/multi-functional.html/space-saving/aeke-s1-pro-smart-home-gym.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/a/e/aeke_s1_pro_22.jpg'
  },
  'im2000': {
    // Published machine footprint, metres, from the product page:
    //   74"W x 48"D x 84.5"H
    // converted from inches
    footprint: { w: 1.88, d: 1.22 },
    name: 'Ironmaster IM2000 Self Spotting System',
    price: 1999,
    was: 2500,
    url: 'https://homegym.sg/strength/multi-functional.html/space-saving/ironmaster-im2000-self-spotting-system.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/i/m/im2000-1_512x512.jpg'
  },
  'folding-rack': {
    // No dimensions published on the product page, checked 8 Sep 2026.
    footprint: null,
    name: 'Vigor Folding Power Rack',
    price: 1499,
    was: 1650,
    url: 'https://homegym.sg/strength/squat-racks/power-rack.html/vigor-folding-power-rack.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/v/s/vs-vr-3.jpg'
  },
  'mab-bench': {
    name: 'Vigor Multi Adjustable Bench (BS-MAB)',
    price: 292,
    was: null,
    url: 'https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/b/s/bs-mab44.jpg'
  },
  'x20-bench': {
    name: 'Vigor X20 Sliding Bench',
    price: 1039,
    was: null,
    url: 'https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/vigor-b20-sliding-bench.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/b/2/b20-main.jpg',
    // KNOWN ISSUE 3, OUT OF STOCK at the 30 Aug 2026 snapshot, and the URL slug
    // says `b20` while the product page title says `X20`. Confirm the correct SKU
    // with the client, then delete this `note` line to remove the badge.
    note: 'On backorder'
  },
  'olympic-set': {
    name: 'Olympic Weight Set, 107.5kg rubber plates',
    price: 450,
    was: 499,
    url: 'https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/o/l/oly6-1.jpg'
  },
  'bar-22m': {
    name: '2.2M Olympic Bar',
    price: 179,
    was: 250,
    url: 'https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-bars/olympic-bar.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/p/o/power_bar.jpg'
  },
  'bar-18m': {
    name: '1.8M Olympic Bar',
    price: 179,
    was: 250,
    url: 'https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-bars/1-83m-olympic-bar.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/1/6/1628933011587.jpg'
  }
};

/**
 * Per-bundle copy and imagery, keyed by the bundle number in the sheet.
 *
 * WHAT THE SHEET OWNS vs WHAT THIS FILE OWNS
 *   The sheet decides which bundles exist and how a customer is matched to one:
 *   functions, footprint, personas, budget ceiling and the list of products. It
 *   holds no prices, no sales copy and no photographs, so those stay here and
 *   are joined on by bundle number in composeBundles() below.
 *
 *   A bundle added to the sheet with no entry here still works. It gets its
 *   name from the sheet's "Bundle Name" column and a plain generated tagline
 *   and pitch, and it renders without a photograph. That is the point: adding a
 *   bundle is a spreadsheet edit, and writing the copy for it is a separate,
 *   optional improvement rather than a blocker.
 */
export const BUNDLE_COPY = {
  1: {
    name: "The Apartment Titan",
    tagline: "One machine, three disciplines, a spare bedroom.",
    pitch: "Smith, rack and cable in a single frame, plus the bench and plates to make it a real gym on day one. If you've got a spare room and you're starting from nothing, start here.",
    trains: ["Squat", "Bench press", "Deadlift", "Lat pulldown", "Cable rows", "Overhead press"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/729964639_18600529420005504_3034992830324318055_n.jpg",
    heroSource: "instagram"
  },

  2: {
    name: "The Foldaway Beast",
    tagline: "338kg of machine that folds to 60cm in 30 seconds.",
    pitch: "Full commercial-grade Smith and functional trainer that collapses from 120cm to 60cm deep when you're done. Built for the guy whose gym has to disappear.",
    trains: ["Smith squat", "Smith bench", "Lat pulldown", "Low row", "Chin-ups", "Cable flys"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/729579068_18600535006005504_1282245155372288029_n.jpg",
    heroSource: "instagram"
  },

  3: {
    name: "The Iron Fortress",
    tagline: "100+ exercises. Dual 90kg stacks. No compromises.",
    pitch: "Power rack, counterbalanced Smith, dual-stack functional trainer and a leg press in one integrated unit. This is the end of the road. You will not outgrow it.",
    trains: ["Squat", "Bench press", "Deadlift", "Leg press", "Hack squat", "Lat pulldown", "Cable work", "Hip abduction"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/720486969_18595990591005504_7491168024045430756_n.jpg",
    heroSource: "instagram"
  },

  4: {
    name: "The Smart Smith",
    tagline: "Dual 90kg stacks, no loose plates, half the footprint.",
    pitch: "The integrated stack means you load the Smith bar straight off the weight stack: no plates to rack, no plates to store, roughly half the floor space of a traditional all-in-one.",
    trains: ["Smith squat", "Smith bench", "Lat pulldown", "Tricep pushdown", "Chin-ups", "Cable rows"],
    hero: "https://d101vd00cis701.cloudfront.net/catalog/product/cache/a6ce66133903ca2f04cf70ed120904eb/b/f/bf900.jpg",
    heroSource: "gallery"
  },

  5: {
    name: "The Fast Track",
    tagline: "Sit down, pin the weight, go.",
    pitch: "90kg stack, 12 training angles, nothing to learn and nothing to load. The lowest-friction way to actually train four times a week.",
    trains: ["Chest press", "Lat pulldown", "Seated row", "Leg curl", "Functional cable work"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/733309572_18602787556005504_5869793302032627450_n.jpg",
    heroSource: "instagram"
  },

  6: {
    name: "The Level Up",
    tagline: "Half rack plus 2 × 75kg cable stacks, room to grow.",
    pitch: "Barbell work in a proper half rack with dual cable stacks bolted on, and an add-on path (Smith kit, dip station, landmine) for whenever you want more.",
    trains: ["Squat", "Bench press", "Deadlift", "Lat pulldown", "Low row", "Chin-ups"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/761573833_18611551303005504_1908722346053536433_n.jpg",
    heroSource: "instagram"
  },

  7: {
    name: "The All-Rounder",
    tagline: "31 stations. Barbell, Smith and cable in one rack.",
    pitch: "Half rack for free weights, 1.8m Smith bar for solo pressing, dual stacks for everything else. The most complete setup at this price.",
    trains: ["Squat", "Bench press", "Deadlift", "Smith press", "Lat pulldown", "Low row", "Chin-ups", "Dips"],
    hero: "https://d101vd00cis701.cloudfront.net/catalog/product/cache/a6ce66133903ca2f04cf70ed120904eb/i/n/infinity-31in1_1.jpg",
    heroSource: "gallery"
  },

  8: {
    name: "The Silent Operator",
    tagline: "350+ movements from a machine the size of a bookshelf.",
    pitch: "Digital resistance to 220lb in 1lb steps, AI form correction across 42 skeletal points, 165+ guided programmes, and no plates to wake the neighbours. Replaces 23 machines in 2 square metres.",
    trains: ["Chest press", "Rows", "Squats", "Core work", "Pilates", "Rowing", "185 training angles"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/792133070_18623258032005504_2223476064121699011_n.jpg",
    heroSource: "instagram"
  },

  9: {
    name: "The Solo Lifter",
    tagline: "Patented self-spotting bar. Train heavy, train alone.",
    pitch: "Rated to 1,000lb with lockout holes down the full travel, so a failed rep is a non-event. The safest way to push heavy when there is nobody to spot you.",
    trains: ["Smith bench", "Smith squat", "Lat pulldown", "Low row", "Calf raises"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/627627547_18407289532131119_4104113445378468616_n.jpg",
    heroSource: "instagram"
  },

  10: {
    name: "The Barbell Purist",
    tagline: "Squat, bench, deadlift. Folds flat against the wall.",
    pitch: "A real power rack with high and low pulleys that folds to a third of its depth. 50+ exercise variations, lifetime frame warranty, and your floor back when you are done.",
    trains: ["Squat", "Bench press", "Deadlift", "Chin-ups", "Dips", "Lat pulldown", "Landmine"],
    hero: "https://d101vd00cis701.cloudfront.net/ox_instagram/733271344_18602786473005504_1565312074247429973_n.jpg",
    heroSource: "instagram"
  }
};

/**
 * Products indexed by their homegym.sg URL.
 *
 * The sheet lists the contents of each bundle as product URLs, because a URL is
 * the one identifier a non-technical editor can copy straight from the shop.
 * This is how those URLs become catalogue entries with a price and an image.
 */
export const PRODUCTS_BY_URL = Object.fromEntries(
  Object.entries(PRODUCTS).map(([id, p]) => [p.url, { id, ...p }])
);

/**
 * Join the sheet's rules to this file's catalogue and copy.
 *
 * The bundle price is the SUM OF ITS PRODUCTS, never a typed-in figure. That is
 * what lets a new sheet row price itself, and it means a price can never drift
 * out of step with the items listed beside it.
 *
 * Unresolvable product URLs are handled differently by caller:
 *   strict (build, tests)  throw, so a bad sheet fails CI rather than shipping
 *   lenient (live fetch)   drop just that bundle, so one bad row cannot take
 *                          the whole quiz down on a customer's screen
 */
export function composeBundles(sheetBundles, { strict = true } = {}) {
  const bundles = [];
  const problems = [];
  const warnings = [];

  for (const s of sheetBundles) {
    const products = [];
    let broken = false;

    for (const url of s.productUrls) {
      const p = PRODUCTS_BY_URL[url];
      if (!p) {
        problems.push(
          `bundle ${s.id}: no product in the catalogue matches ${url}. ` +
          'Add it to PRODUCTS in src/quiz/bundles.js, with its price and image.'
        );
        broken = true;
        continue;
      }
      products.push(p.id);
    }

    if (broken) continue;

    const c = BUNDLE_COPY[s.id] || {};
    const price = products.reduce((total, id) => total + PRODUCTS[id].price, 0);

    bundles.push({
      id: s.id,
      // CURATED COPY WINS, AND THE SHEET DOES NOT OVERRIDE IT.
      //
      // Confirmed with the client on 8 Sep 2026: the sheet's Bundle Name column
      // and the products tab's Name column are both INTERNAL. They hold stock
      // shorthand ("Cube", "bf900", "Infinity 2in1"), which is how the business
      // talks about a machine, not how it sells one. If the sheet won this,
      // someone tidying that column would push warehouse shorthand onto the
      // result page without realising it was customer-facing.
      //
      // Both are kept below as internal fields so they can still be used for
      // reconciling against the sheet.
      name: c.name || `Bundle ${s.id}`,
      sheetName: s.name || null,
      // The short working name off the products tab ("Cube", "bf900", "X20").
      // Internal shorthand for talking about a bundle in the sheet, never shown
      // to a visitor: "The Foldaway Beast" sells, "Cube" does not.
      label: s.label || null,
      tagline: c.tagline || autoTagline(s, products),
      functions: s.functions,
      footprint: s.footprint,
      personas: s.personas,
      price,
      budgetCeiling: s.budgetCeiling,
      products,
      hero: c.hero || PRODUCTS[products[0]]?.image || null,
      heroSource: c.hero ? c.heroSource : 'gallery',
      pitch: c.pitch || autoPitch(products),
      trains: c.trains || []
    });
  }

  // Not fatal, on purpose. A bundle with no copy still prices itself and still
  // renders, so blocking the sync on missing marketing text would break the one
  // thing the sheet exists for: adding a bundle without touching code. But it
  // WOULD reach a customer calling itself "Bundle 11", so it has to be said out
  // loud where whoever added the row will see it.
  for (const b of bundles) {
    if (!BUNDLE_COPY[b.id] || !BUNDLE_COPY[b.id].name) {
      warnings.push(
        `bundle ${b.id} has no customer-facing name and would show as "${b.name}". ` +
        'Add one to BUNDLE_COPY in src/quiz/bundles.js. The sheet\'s Bundle Name ' +
        'column is internal and deliberately does not feed this.'
      );
    }
  }

  if (problems.length && strict) {
    throw new Error('bundle data does not compose:\n  ' + problems.join('\n  '));
  }
  return { bundles, problems, warnings };
}

/** Plain, honest tagline for a bundle nobody has written copy for yet. */
function autoTagline(s, products) {
  const what = s.functions.map((f) => FUNCTION_SHORT[f] || f).join(', ');
  return `${what} in ${s.footprint.length} x ${s.footprint.depth} m.`;
}

/** Same, for the pitch: list what is in the box rather than invent a claim. */
function autoPitch(products) {
  const names = products.map((id) => PRODUCTS[id].name);
  const last = names.pop();
  return names.length
    ? `${names.join(', ')} and ${last}, priced and linked below.`
    : `${last}, priced and linked below.`;
}

/** Step 1 options. `tag` is the value stored in answers.functions. */
export const FUNCTION_OPTIONS = [
  { tag: 'power_rack', label: 'Barbell lifts: squat, bench, deadlift', help: 'Free-weight barbell work in a rack' },
  { tag: 'smith',      label: 'Guided pressing, safe to do solo',       help: 'Smith machine bar on fixed rails' },
  { tag: 'cable',      label: 'Cable work: lat pulldown, rows, flys',  help: 'Dual weight-stack functional trainer' },
  { tag: 'leg_press',  label: 'Leg press & hack squat',                 help: 'Dedicated leg press station' },
  { tag: 'multigym',   label: 'Simple pin-loaded machine circuit',      help: 'One station, seated, easy to learn' },
  { tag: 'smart',      label: 'App-guided digital resistance',          help: 'Smart cable with on-screen coaching' }
];

/**
 * Step 3 options, generated from the sheet's personas tab.
 *
 * NOT A HAND-WRITTEN LIST ANY MORE. Question three used to ask for a training
 * level from three fixed options. The sheet now matches bundles on persona
 * instead, so the question has to ask the thing the matcher actually uses, and
 * the options have to come from the same tab the rules reference. Adding a
 * persona to the sheet adds an option here with no code change.
 *
 * Each option shows all three parts of a persona: the segment name, the quote
 * underneath it, then the explanation. The name was hidden at first on the
 * grounds that it reads as a label pointed at the reader, and the client asked
 * for it back on 8 Sep 2026.
 */
export const PERSONA_OPTIONS = PERSONAS.map((p) => ({
  value: p.name,
  label: p.name,
  quote: p.quote,
  help: p.description || p.name
}));

/** Short human labels for the "why this one" chips on the result view. */
export const FUNCTION_SHORT = {
  power_rack: 'Barbell',
  smith: 'Smith',
  cable: 'Cable',
  leg_press: 'Leg press',
  multigym: 'Machine circuit',
  smart: 'Smart resistance'
};

/**
 * "Rooms we've built", the install strip on the result page.
 *
 * Twenty posts from homegym.sg/instagram, in feed order. HomeGym's own
 * photography, served from their own CloudFront origin by the store's Instagram
 * extension: nothing is scraped from Instagram and nothing of theirs is
 * redistributed.
 *
 * CURATED FOR ROOM-SCALE SETUPS, NOT PRODUCT SHOTS.
 *   All 49 posts in the feed were looked at rather than skimmed by caption, and
 *   the twenty here all show a machine standing in a finished room. Left out on
 *   purpose: bare dumbbell and plate racks, rooms with nothing in them but new
 *   matting, and single cardio machines against a blank wall. None of those
 *   show a room anyone built.
 *
 * EVERY TILE LINKS SOMEWHERE, AND THE LINK IS ACCURATE.
 *   linkKind 'product'  the post shows an item in the catalogue above, so the
 *                       tile links straight to that product page
 *   linkKind 'category' the machine is real but not one this quiz sells (the
 *                       Titan G9 and the Bodyx BK3058), so it links to the
 *                       category rather than to a plausible-looking wrong
 *                       product
 *   The mapping is written out by hand for that reason: a fuzzy caption match
 *   that sent a treadmill photo to a power rack page would be worse than no
 *   link at all.
 *
 * KNOWN ISSUE 6, IMAGE ROT. The /ox_instagram/ filenames are Instagram media
 * ids and the extension prunes its cache as the feed moves on, so these can 404
 * in time exactly as the catalogue cache paths can. Tiles fall back to a
 * "photo to follow" plate rather than breaking the strip. Re-run
 * scripts/check-images.mjs to find them.
 */
export const ROOMS = [
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/792133070_18623258032005504_2223476064121699011_n.jpg",
    title: "AEKE S1 Pro in a living room",
    date: "4 Sep 2026",
    href: "https://homegym.sg/strength/multi-functional.html/space-saving/aeke-s1-pro-smart-home-gym.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/761107252_18611552692005504_8740749186703023996_n.jpg",
    title: "Bodyx Cube Smith Pro with bench",
    date: "25 Aug 2026",
    href: "https://homegym.sg/strength/multi-functional.html/functional-trainer/bodyx-folding-cube-smith-machine-functional-trainer-combo.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/761573833_18611551303005504_1908722346053536433_n.jpg",
    title: "Infinity half rack with barbell set",
    date: "21 Aug 2026",
    href: "https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/760242206_18611550190005504_3346270900337644903_n.jpg",
    title: "Infinity half rack with pegboard",
    date: "17 Aug 2026",
    href: "https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/762107975_18611546767005504_6529779789667579583_n.jpg",
    title: "Treadmill and elliptical setup",
    date: "11 Aug 2026",
    href: "https://homegym.sg/cardio.html",
    linkKind: "category"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/759676739_18611546479005504_846082442829319540_n.jpg",
    title: "Vigor folding power rack gym set",
    date: "9 Aug 2026",
    href: "https://homegym.sg/strength/squat-racks/power-rack.html/vigor-folding-power-rack.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/760974318_18611553115005504_1009769436051274014_n.jpg",
    title: "Bench, dumbbells and rack",
    date: "6 Aug 2026",
    href: "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/760068554_18611544580005504_6537229001685739515_n.jpg",
    title: "Vigor TinyTitan with bench and plates",
    date: "2 Aug 2026",
    href: "https://homegym.sg/strength/multi-functional.html/space-saving/vigor-tinytitan-all-in-1-trainer.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/736448867_18602787841005504_7631076833331828894_n.jpg",
    title: "Vigor Titan G9 all-in-1 setup",
    date: "28 Jul 2026",
    href: "https://homegym.sg/strength.html",
    linkKind: "category"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/731158364_18602787226005504_3919957454936227618_n.jpg",
    title: "Infinity dual cable half rack",
    date: "24 Jul 2026",
    href: "https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/733271344_18602786473005504_1565312074247429973_n.jpg",
    title: "Vigor folding power rack with bench",
    date: "18 Jul 2026",
    href: "https://homegym.sg/strength/squat-racks/power-rack.html/vigor-folding-power-rack.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/729579068_18600535006005504_1282245155372288029_n.jpg",
    title: "Bodyx Cube Smith in a physio studio",
    date: "15 Jul 2026",
    href: "https://homegym.sg/strength/multi-functional.html/functional-trainer/bodyx-folding-cube-smith-machine-functional-trainer-combo.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/729364213_18600534748005504_7492638712585432183_n.jpg",
    title: "Infinity Smith machine setup",
    date: "13 Jul 2026",
    href: "https://homegym.sg/strength.html/infinity-series/infinity-all-in-1-trainer.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/731014406_18600533389005504_8914844780706475251_n.jpg",
    title: "Infinity functional trainer half rack",
    date: "10 Jul 2026",
    href: "https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/733309572_18602787556005504_5869793302032627450_n.jpg",
    title: "Vigor Xpress Pro home gym",
    date: "2 Jul 2026",
    href: "https://homegym.sg/strength/multi-functional/multi-gym-85.html/vigor-xpress-pro-home-gym-station.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/729964639_18600529420005504_3034992830324318055_n.jpg",
    title: "Vigor TinyTitan full gym setup",
    date: "27 Jun 2026",
    href: "https://homegym.sg/strength/multi-functional.html/space-saving/vigor-tinytitan-all-in-1-trainer.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/720486969_18595990591005504_7491168024045430756_n.jpg",
    title: "Vigor Titan X20 all-in-1 trainer",
    date: "19 Jun 2026",
    href: "https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-titan-x20-all-in-1-trainer.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/720206740_18595990204005504_1555444394403186457_n.jpg",
    title: "Bodyx BK3058 all-in-1 setup",
    date: "17 Jun 2026",
    href: "https://homegym.sg/strength.html",
    linkKind: "category"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/720040277_18595989928005504_6317610763181088945_n.jpg",
    title: "Vigor Titan X20 with bench",
    date: "15 Jun 2026",
    href: "https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-titan-x20-all-in-1-trainer.html",
    linkKind: "product"
  },
  {
    image: "https://d101vd00cis701.cloudfront.net/ox_instagram/719598557_18595988128005504_8448550947109249164_n.jpg",
    title: "Reebok SL8 with Vigor Xpress gym",
    date: "14 Jun 2026",
    href: "https://homegym.sg/strength/multi-functional/multi-gym-85.html/vigor-xpress-pro-home-gym-station.html",
    linkKind: "product"
  }
];

/**
 * The bundles the quiz shows.
 *
 * Deliberately a mutable array rather than a fresh one: when the component is
 * given a sheet-src and pulls live data, it replaces the CONTENTS of this array
 * in place. Every module that imported it keeps working without a re-import,
 * and there is exactly one list of bundles in the program at any moment.
 */
export const BUNDLES = composeBundles(SHEET_BUNDLES).bundles;
