/**
 * GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Written by scripts/sync-sheet.mjs from the Google Sheet that owns the bundle
 * data. Any hand edit here is lost on the next sync. To change a bundle, or to
 * add one, edit the sheet and run:
 *
 *   npm run sync
 *
 * Source: https://docs.google.com/spreadsheets/d/1ntgik1NX9IjqNmaSI1E8Sj95r4bPAE-90cdKzjbnssU
 *
 * WHAT THIS FILE CARRIES: which bundles exist, the rules that match a customer
 * to one (functions, footprint, personas, budget ceiling), and the products in
 * each, by URL. It carries no prices, copy or imagery, because the sheet holds
 * none. Those are joined on in src/quiz/bundles.js.
 *
 * "label" is the short working name from the products tab ("Cube", "bf900").
 * It is an internal handle for talking about a bundle, NOT customer-facing
 * copy, and nothing rendered to a visitor uses it.
 */

export const SHEET_SOURCE = "https://docs.google.com/spreadsheets/d/1ntgik1NX9IjqNmaSI1E8Sj95r4bPAE-90cdKzjbnssU";

/**
 * Where the live-override path fetches from.
 *
 * Baked in at sync time so <homegym-bundle-quiz sheet-live> needs no second
 * copy of the configuration. A null tab means that gid has not been filled into
 * config/sheet.json yet, and live mode reports that rather than guessing.
 */
export const SHEET_ID = "1ntgik1NX9IjqNmaSI1E8Sj95r4bPAE-90cdKzjbnssU";
export const SHEET_TABS = {"rules":0,"products":1201616033,"personas":1303527735};

export const SHEET_BUNDLES = [
  {
    id: 1,
    name: null,
    label: "Tinytitan",
    functions: ["smith","power_rack","cable"],
    footprint: { length: 2, depth: 3 },
    personas: ["Practical / Value Seeker"],
    budgetCeiling: 3000,
    productUrls: [
      "https://homegym.sg/strength/multi-functional.html/space-saving/vigor-tinytitan-all-in-1-trainer.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html",
    ]
  },
  {
    id: 2,
    name: null,
    label: "Cube",
    functions: ["smith","cable"],
    footprint: { length: 1.5, depth: 2 },
    personas: ["Convenience Seeker"],
    budgetCeiling: 4000,
    productUrls: [
      "https://homegym.sg/strength/multi-functional.html/functional-trainer/bodyx-folding-cube-smith-machine-functional-trainer-combo.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
    ]
  },
  {
    id: 3,
    name: null,
    label: "X20",
    functions: ["smith","power_rack","cable","leg_press"],
    footprint: { length: 3, depth: 3 },
    personas: ["Maximum Function User","Serious Strength Trainer"],
    budgetCeiling: 7000,
    productUrls: [
      "https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-titan-x20-all-in-1-trainer.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/vigor-b20-sliding-bench.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-bars/olympic-bar.html",
    ]
  },
  {
    id: 4,
    name: null,
    label: "bf900",
    functions: ["smith","power_rack","cable"],
    footprint: { length: 1.5, depth: 2.5 },
    personas: ["Convenience Seeker"],
    budgetCeiling: 4000,
    productUrls: [
      "https://homegym.sg/strength/multi-functional.html/cable-machine/vigor-bf900-pro-connected-all-in-1-system.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
    ]
  },
  {
    id: 5,
    name: null,
    label: "xpress pro",
    functions: ["multigym"],
    footprint: { length: 1.6, depth: 2 },
    personas: ["Convenience Seeker"],
    budgetCeiling: 2500,
    productUrls: [
      "https://homegym.sg/strength/multi-functional/multi-gym-85.html/vigor-xpress-pro-home-gym-station.html",
    ]
  },
  {
    id: 6,
    name: null,
    label: "Infinity 2in1",
    functions: ["power_rack","cable"],
    footprint: { length: 2, depth: 3 },
    personas: ["Serious Strength Trainer"],
    budgetCeiling: 3500,
    productUrls: [
      "https://homegym.sg/strength.html/infinity-series/infinity-half-rack-dual-cable-combo.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-bars/1-83m-olympic-bar.html",
    ]
  },
  {
    id: 7,
    name: null,
    label: "infinity 3in1",
    functions: ["smith","power_rack","cable"],
    footprint: { length: 2.5, depth: 3 },
    personas: ["Serious Strength Trainer"],
    budgetCeiling: 4000,
    productUrls: [
      "https://homegym.sg/strength.html/infinity-series/infinity-all-in-1-trainer.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-bars/1-83m-olympic-bar.html",
    ]
  },
  {
    id: 8,
    name: null,
    label: "Aeke",
    functions: ["cable","smart"],
    footprint: { length: 1, depth: 2 },
    personas: ["Guided / Accountability User"],
    budgetCeiling: 6000,
    productUrls: [
      "https://homegym.sg/strength/multi-functional.html/space-saving/aeke-s1-pro-smart-home-gym.html",
    ]
  },
  {
    id: 9,
    name: null,
    label: "im2000",
    functions: ["smith","power_rack","cable"],
    footprint: { length: 2, depth: 2 },
    personas: ["Practical / Value Seeker"],
    budgetCeiling: 3000,
    productUrls: [
      "https://homegym.sg/strength/multi-functional.html/space-saving/ironmaster-im2000-self-spotting-system.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html",
    ]
  },
  {
    id: 10,
    name: null,
    label: "Folding rack",
    functions: ["power_rack","cable"],
    footprint: { length: 2.5, depth: 3 },
    personas: ["Practical / Value Seeker"],
    budgetCeiling: 2500,
    productUrls: [
      "https://homegym.sg/strength/squat-racks/power-rack.html/vigor-folding-power-rack.html",
      "https://homegym.sg/strength/weight-benches/flat-adjustable-bench.html/multi-adjustable-bench.html",
      "https://homegym.sg/strength/weights.html/build-your-own-dumbbell-barbell/olympic-weights/olympic-set.html",
    ]
  }
];

/**
 * Customer personas from the sheet's third tab.
 *
 * These now DRIVE QUESTION THREE of the quiz. The options a visitor picks from
 * are generated from this list, and the rules tab's Style column says which
 * personas each bundle is built for, so adding a persona here and using it
 * there is enough to change what the quiz asks. Order is the sheet's order.
 */
export const PERSONAS = [
  {
    name: "Convenience Seeker",
    quote: "I just want to work out.",
    description: "Minimal setup, quick weight changes, easy start"
  },
  {
    name: "Maximum Function User",
    quote: "Give me everything in one machine.",
    description: "Wants maximum exercise variety"
  },
  {
    name: "Serious Strength Trainer",
    quote: "I want to progressively get stronger.",
    description: "Cares about load, stability and equipment quality"
  },
  {
    name: "Guided / Accountability User",
    quote: "Tell me what to do.",
    description: "Wants programs, coaching, tracking and motivation"
  },
  {
    name: "Practical / Value Seeker",
    quote: "I don't need everything. Just give me enough to train my whole body.",
    description: "Their priority is value for money, not maximum features."
  }
];
