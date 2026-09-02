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

/**
 * Product catalogue, keyed by id. Prices in SGD.
 *   price, current sale price. This is what the bundle total is built from.
 *   was    pre-sale price, or null. Drives the struck-through price and SALE tag.
 *   note   optional availability badge shown on the product card.
 */
export const PRODUCTS = {
  'tinytitan': {
    name: 'Vigor TinyTitan All-in-1 Trainer',
    price: 2200,
    was: 2799,
    url: 'https://homegym.sg/strength/multi-functional.html/space-saving/vigor-tinytitan-all-in-1-trainer.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/t/i/tinytitan11.jpg'
  },
  'bodyx-cube': {
    name: 'Bodyx Folding Cube Smith Machine Functional Trainer Combo',
    price: 3520,
    was: 3999,
    url: 'https://homegym.sg/strength/multi-functional.html/functional-trainer/bodyx-folding-cube-smith-machine-functional-trainer-combo.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/c/u/cube_2_35.jpg'
  },
  'titan-x20': {
    name: 'Vigor Titan X20 All-in-1 Trainer',
    price: 4899,
    was: 5899,
    url: 'https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-titan-x20-all-in-1-trainer.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/x/2/x20-main2.jpg'
  },
  'bf900-pro': {
    name: 'Vigor BF900 Pro Connected All-in-1 System',
    price: 3599,
    was: null,
    url: 'https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-bf900-pro-connected-all-in-1-system.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/b/f/bf900.jpg'
  },
  'xpress-pro': {
    name: 'Vigor Xpress Pro Home Gym Station',
    price: 2350,
    was: null,
    url: 'https://homegym.sg/strength/multi-functional/multi-gym-85.html/vigor-xpress-pro-home-gym-station.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/h/g/hg8000.jpg'
  },
  'infinity-halfrack': {
    name: 'Infinity Half Rack Dual Cable Combo',
    price: 2299,
    was: null,
    url: 'https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/i/m/img_4453.jpg'
  },
  'infinity-aio': {
    name: 'Infinity All-in-1 Trainer',
    price: 2899,
    was: null,
    url: 'https://homegym.sg/strength.html/infinity-series/infinity-all-in-1-trainer.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/i/n/infinity-31in1_1.jpg'
  },
  'aeke-s1-pro': {
    name: 'AEKE S1 PRO Smart Home Gym',
    price: 5899,
    was: null,
    url: 'https://homegym.sg/strength/multi-functional.html/space-saving/aeke-s1-pro-smart-home-gym.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/a/e/aeke_s1_pro_22.jpg'
  },
  'im2000': {
    name: 'Ironmaster IM2000 Self Spotting System',
    price: 1999,
    was: 2500,
    url: 'https://homegym.sg/strength/multi-functional.html/space-saving/ironmaster-im2000-self-spotting-system.html',
    image: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/i/m/im2000-1_512x512.jpg'
  },
  'folding-rack': {
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
 * The ten bundles.
 *
 * KNOWN ISSUE 4, FOOTPRINTS ARE UNVERIFIED.
 *   These come from the client's source spreadsheet, not from measuring machines.
 *   They read as working-area figures that already include pull-out clearance.
 *   MUST be confirmed before go-live: a customer who buys on a wrong footprint
 *   is a returned 338kg machine.
 *
 * KNOWN ISSUE 5, BUNDLES 1, 4, 7 AND 9 SHARE IDENTICAL FUNCTION TAGS
 *   (smith + power_rack + cable). They are separated only by space, level and
 *   price, which is exactly why the scorer weights space and budget so heavily.
 *   To differentiate them properly, add a distinguishing tag to each
 *   (e.g. `folding`, `self_spotting`, `connected`) and a matching quiz option.
 *
 * Fields:
 *   functions      capability tags, matched against the user's Step 1 answers.
 *   footprint      metres. Matched in EITHER orientation (see matcher.js).
 *   level          beginner | intermediate | advanced.
 *   price          MUST equal the sum of its products' prices (asserted in tests).
 *   budgetCeiling  the client's guide ceiling. Not used by the matcher; the
 *                    matcher filters the user's own budget against `price`.
 */
export const BUNDLES = [
  {
    id: 1,
    name: 'The Apartment Titan',
    tagline: 'One machine, three disciplines, a spare bedroom.',
    functions: ['smith', 'power_rack', 'cable'],
    footprint: { length: 2.0, depth: 3.0 },
    level: 'beginner',
    price: 2942,
    budgetCeiling: 3000,
    products: ['tinytitan', 'mab-bench', 'olympic-set'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/522969686_18519237319005504_7228295298475325837_n.jpg',
    heroSource: 'instagram',
    pitch: "Smith, rack and cable in a single frame, plus the bench and plates to make it a real gym on day one. If you've got a spare room and you're starting from nothing, start here.",
    trains: ['Squat', 'Bench press', 'Deadlift', 'Lat pulldown', 'Cable rows', 'Overhead press']
  },
  {
    id: 2,
    name: 'The Foldaway Beast',
    tagline: '338kg of machine that folds to 60cm in 30 seconds.',
    functions: ['smith', 'cable'],
    footprint: { length: 1.5, depth: 2.0 },
    level: 'intermediate',
    price: 3812,
    budgetCeiling: 4000,
    products: ['bodyx-cube', 'mab-bench'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/729579068_18600535006005504_1282245155372288029_n.jpg',
    heroSource: 'instagram',
    pitch: "Full commercial-grade Smith and functional trainer that collapses from 120cm to 60cm deep when you're done. Built for the guy whose gym has to disappear.",
    trains: ['Smith squat', 'Smith bench', 'Lat pulldown', 'Low row', 'Chin-ups', 'Cable flys']
  },
  {
    id: 3,
    name: 'The Iron Fortress',
    tagline: '100+ exercises. Dual 90kg stacks. No compromises.',
    functions: ['smith', 'power_rack', 'cable', 'leg_press'],
    footprint: { length: 3.0, depth: 3.0 },
    level: 'advanced',
    price: 6567,
    budgetCeiling: 7000,
    products: ['titan-x20', 'x20-bench', 'olympic-set', 'bar-22m'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/720486969_18595990591005504_7491168024045430756_n.jpg',
    heroSource: 'instagram',
    pitch: 'Power rack, counterbalanced Smith, dual-stack functional trainer and a leg press in one integrated unit. This is the end of the road. You will not outgrow it.',
    trains: ['Squat', 'Bench press', 'Deadlift', 'Leg press', 'Hack squat', 'Lat pulldown', 'Cable work', 'Hip abduction']
  },
  {
    id: 4,
    name: 'The Smart Smith',
    tagline: 'Dual 90kg stacks, no loose plates, half the footprint.',
    functions: ['smith', 'power_rack', 'cable'],
    footprint: { length: 1.5, depth: 2.5 },
    level: 'intermediate',
    price: 3891,
    budgetCeiling: 4000,
    products: ['bf900-pro', 'mab-bench'],
    hero: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/a6ce66133903ca2f04cf70ed120904eb/b/f/bf900.jpg',
    heroSource: 'gallery',
    pitch: 'The integrated stack means you load the Smith bar straight off the weight stack: no plates to rack, no plates to store, roughly half the floor space of a traditional all-in-one.',
    trains: ['Smith squat', 'Smith bench', 'Lat pulldown', 'Tricep pushdown', 'Chin-ups', 'Cable rows']
  },
  {
    id: 5,
    name: 'The Fast Track',
    tagline: 'Sit down, pin the weight, go.',
    functions: ['multigym'],
    footprint: { length: 1.5, depth: 2.0 },
    level: 'beginner',
    price: 2350,
    budgetCeiling: 2500,
    products: ['xpress-pro'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/733309572_18602787556005504_5869793302032627450_n.jpg',
    heroSource: 'instagram',
    pitch: '90kg stack, 12 training angles, nothing to learn and nothing to load. The lowest-friction way to actually train four times a week.',
    trains: ['Chest press', 'Lat pulldown', 'Seated row', 'Leg curl', 'Functional cable work']
  },
  {
    id: 6,
    name: 'The Level Up',
    tagline: 'Half rack plus 2 × 75kg cable stacks, room to grow.',
    functions: ['power_rack', 'cable'],
    footprint: { length: 2.0, depth: 3.0 },
    level: 'intermediate',
    price: 3220,
    budgetCeiling: 3500,
    products: ['infinity-halfrack', 'mab-bench', 'olympic-set', 'bar-18m'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/761573833_18611551303005504_1908722346053536433_n.jpg',
    heroSource: 'instagram',
    pitch: 'Barbell work in a proper half rack with dual cable stacks bolted on, and an add-on path (Smith kit, dip station, landmine) for whenever you want more.',
    trains: ['Squat', 'Bench press', 'Deadlift', 'Lat pulldown', 'Low row', 'Chin-ups']
  },
  {
    id: 7,
    name: 'The All-Rounder',
    tagline: '31 stations. Barbell, Smith and cable in one rack.',
    functions: ['smith', 'power_rack', 'cable'],
    footprint: { length: 2.5, depth: 3.0 },
    level: 'intermediate',
    price: 3820,
    budgetCeiling: 4000,
    products: ['infinity-aio', 'mab-bench', 'olympic-set', 'bar-18m'],
    hero: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/a6ce66133903ca2f04cf70ed120904eb/i/n/infinity-31in1_1.jpg',
    heroSource: 'gallery',
    pitch: 'Half rack for free weights, 1.8m Smith bar for solo pressing, dual stacks for everything else. The most complete setup at this price.',
    trains: ['Squat', 'Bench press', 'Deadlift', 'Smith press', 'Lat pulldown', 'Low row', 'Chin-ups', 'Dips']
  },
  {
    id: 8,
    name: 'The Silent Operator',
    tagline: '350+ movements from a machine the size of a bookshelf.',
    functions: ['cable', 'smart'],
    footprint: { length: 1.0, depth: 2.0 },
    level: 'beginner',
    price: 5899,
    budgetCeiling: 6000,
    products: ['aeke-s1-pro'],
    hero: 'https://d101vd00cis701.cloudfront.net/catalog/product/cache/c0dcb29ef46d222f886111be6e10f76c/s/1/s1pro-114.jpg',
    heroSource: 'gallery',
    pitch: 'Digital resistance to 220lb in 1lb steps, AI form correction across 42 skeletal points, 165+ guided programmes, and no plates to wake the neighbours. Replaces 23 machines in 2 square metres.',
    trains: ['Chest press', 'Rows', 'Squats', 'Core work', 'Pilates', 'Rowing', '185 training angles']
  },
  {
    id: 9,
    name: 'The Solo Lifter',
    tagline: 'Patented self-spotting bar. Train heavy, train alone.',
    functions: ['smith', 'power_rack', 'cable'],
    footprint: { length: 2.0, depth: 2.0 },
    level: 'beginner',
    price: 2741,
    budgetCeiling: 3000,
    products: ['im2000', 'mab-bench', 'olympic-set'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/627627547_18407289532131119_4104113445378468616_n.jpg',
    heroSource: 'instagram',
    pitch: 'Rated to 1,000lb with lockout holes down the full travel, so a failed rep is a non-event. The safest way to push heavy when there is nobody to spot you.',
    trains: ['Smith bench', 'Smith squat', 'Lat pulldown', 'Low row', 'Calf raises']
  },
  {
    id: 10,
    name: 'The Barbell Purist',
    tagline: 'Squat, bench, deadlift. Folds flat against the wall.',
    functions: ['power_rack', 'cable'],
    footprint: { length: 2.5, depth: 3.0 },
    level: 'intermediate',
    price: 2241,
    budgetCeiling: 2500,
    products: ['folding-rack', 'mab-bench', 'olympic-set'],
    hero: 'https://d101vd00cis701.cloudfront.net/ox_instagram/733271344_18602786473005504_1565312074247429973_n.jpg',
    heroSource: 'instagram',
    pitch: 'A real power rack with high and low pulleys that folds to a third of its depth. 50+ exercise variations, lifetime frame warranty, and your floor back when you are done.',
    trains: ['Squat', 'Bench press', 'Deadlift', 'Chin-ups', 'Dips', 'Lat pulldown', 'Landmine']
  }
];

/** Step 1 options. `tag` is the value stored in answers.functions. */
export const FUNCTION_OPTIONS = [
  { tag: 'power_rack', label: 'Barbell lifts: squat, bench, deadlift', help: 'Free-weight barbell work in a rack' },
  { tag: 'smith',      label: 'Guided pressing, safe to do solo',       help: 'Smith machine bar on fixed rails' },
  { tag: 'cable',      label: 'Cable work: lat pulldown, rows, flys',  help: 'Dual weight-stack functional trainer' },
  { tag: 'leg_press',  label: 'Leg press & hack squat',                 help: 'Dedicated leg press station' },
  { tag: 'multigym',   label: 'Simple pin-loaded machine circuit',      help: 'One station, seated, easy to learn' },
  { tag: 'smart',      label: 'App-guided digital resistance',          help: 'Smart cable with on-screen coaching' }
];

/** Step 3 options. */
export const LEVEL_OPTIONS = [
  { value: 'beginner',     label: 'Beginner',     help: 'New to lifting, or coming back after a long break' },
  { value: 'intermediate', label: 'Intermediate', help: 'Comfortable with the main lifts, training consistently' },
  { value: 'advanced',     label: 'Advanced',     help: 'Years under the bar, chasing specific numbers' }
];

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
 * Rooms already built, for the result page strip.
 *
 * HomeGym's own Instagram posts, mirrored onto their CloudFront CDN by the
 * store's Instagram extension. Nothing is scraped from Instagram and nothing of
 * theirs is redistributed: it is their photography served from their own
 * origin, exactly as the product shots already are. Each was checked by eye for
 * showing a finished room rather than a studio cut-out.
 *
 * KNOWN ISSUE 6, IMAGE ROT. The /ox_instagram/ filenames are Instagram media
 * ids and the extension prunes its cache as the feed moves on, so these can 404
 * in time exactly as the catalogue cache paths can. Cards fall back to a
 * "photo to follow" plate rather than breaking the strip, and
 * `npm run check:images` reports any that have gone.
 */
export const ROOMS = [
  { image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/526209345_18520440175005504_9147665945938720146_n.jpg' },
  { image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/702119213_18589419337005504_2796203445602589252_n.jpg' },
  { image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/670629594_18579725329005504_7675040595692490561_n.jpg' },
  { image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/719598557_18595988128005504_8448550947109249164_n.jpg' },
  { image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/760242206_18611550190005504_3346270900337644903_n.jpg' },
  { image: 'https://d101vd00cis701.cloudfront.net/ox_instagram/759676739_18611546479005504_846082442829319540_n.jpg' }
];
