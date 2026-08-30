/**
 * Homegym.sg, Bundle matching logic.
 *
 * PURE MODULE. No DOM access, no imports from the component, no side effects.
 * Everything here is deterministic: same answers in, same bundle out, on every
 * engine. That is what makes the sweep in scripts/sweep.js a valid regression test.
 *
 * Public API:
 *   match(answers, bundles) -> { primary, alternates, fallback, debug }
 */

/** Level ordering, used for the "steps away" distance in levelScore. */
const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

/** Scoring weights. Must total 100. */
export const WEIGHTS = { fn: 40, budget: 25, space: 20, level: 15 };

/** Fallback tiers, in the order the ladder relaxes constraints. */
export const FALLBACK = {
  NONE: null,
  BUDGET: 'budget',   // tier 1, budget relaxed 10%
  SPACE: 'space',     // tier 2, shorter dimension relaxed 0.5m
  SMALLEST: 'space-only', // tier 3, space fit only, budget ignored
  CONTACT: 'contact'  // tier 4, nothing fits at all
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Does the bundle fit the user's floor space in EITHER orientation?
 * A 1.5 x 2.5 machine fits a 2.5 x 1.5 room, you just turn it round.
 */
export function fits(bundle, userLength, userDepth) {
  const { length: bL, depth: bD } = bundle.footprint;
  return (bL <= userLength && bD <= userDepth) || (bL <= userDepth && bD <= userLength);
}

/**
 * Coverage of the user's selected functions, plus a small bonus for capability
 * they did not ask for. A machine that does MORE than asked is a mild plus and
 * never a minus, so there is no penalty term here.
 */
export function functionScore(selected, bundleFunctions) {
  if (!selected || selected.length === 0) return 0;
  const set = new Set(bundleFunctions);
  const hits = selected.filter((f) => set.has(f)).length;
  const covered = hits / selected.length;

  const selectedSet = new Set(selected);
  const extra = bundleFunctions.filter((f) => !selectedSet.has(f)).length;
  const bonus = Math.min(0.15, 0.05 * extra);

  return clamp(covered + bonus, 0, 1);
}

/** Rewards using the budget well without wasting it. */
export function budgetScore(price, budget) {
  if (!budget) return 0;
  const ratio = price / budget;
  if (ratio >= 0.75) return 1.0;
  if (ratio >= 0.55) return 0.8;
  if (ratio >= 0.40) return 0.55;
  return 0.3;
}

/**
 * Rewards filling the room. A bigger machine in the same space is more capable,
 * so a bundle that uses 90% of the floor beats one that uses 30% of it.
 */
export function spaceScore(bundle, userLength, userDepth) {
  const userArea = userLength * userDepth;
  if (!userArea) return 0;
  const bundleArea = bundle.footprint.length * bundle.footprint.depth;
  return clamp(bundleArea / userArea, 0, 1);
}

/** Exact match 1.0, one step away 0.6, two steps away 0.2. */
export function levelScore(userLevel, bundleLevel) {
  const a = LEVEL_ORDER.indexOf(userLevel);
  const b = LEVEL_ORDER.indexOf(bundleLevel);
  if (a === -1 || b === -1) return 0;
  const distance = Math.abs(a - b);
  return distance === 0 ? 1.0 : distance === 1 ? 0.6 : 0.2;
}

/** Full 0-100 score plus the component breakdown, for the debug payload. */
export function scoreBundle(bundle, answers) {
  const fn = functionScore(answers.functions, bundle.functions);
  const budget = budgetScore(bundle.price, answers.budget);
  const space = spaceScore(bundle, answers.length, answers.depth);
  const level = levelScore(answers.level, bundle.level);

  const score =
    WEIGHTS.fn * fn +
    WEIGHTS.budget * budget +
    WEIGHTS.space * space +
    WEIGHTS.level * level;

  return {
    bundle,
    score,
    parts: { fn, budget, space, level },
    // Raw coverage without the capability bonus, tie-break (a) uses this, so a
    // bundle that genuinely covers more of what you asked for wins over one that
    // merely does more things in general.
    coverage: answers.functions && answers.functions.length
      ? answers.functions.filter((f) => bundle.functions.includes(f)).length / answers.functions.length
      : 0,
    area: bundle.footprint.length * bundle.footprint.depth
  };
}

/**
 * Tie-break chain from the spec: within 2 points, prefer higher function
 * coverage, then lower price, then smaller footprint, then lower bundle number.
 * Returns <0 if `a` should rank first.
 */
function compare(a, b) {
  if (Math.abs(a.score - b.score) > 2) return b.score - a.score;
  if (a.coverage !== b.coverage) return b.coverage - a.coverage;
  if (a.bundle.price !== b.bundle.price) return a.bundle.price - b.bundle.price;
  if (a.area !== b.area) return a.area - b.area;
  return a.bundle.id - b.bundle.id;
}

/**
 * Insertion sort, deliberately.
 *
 * `compare` is intentionally NOT transitive, "within 2 points" creates chains
 * where A ties B, B ties C, but A beats C outright. Array.prototype.sort is
 * allowed to produce engine-dependent output for such a comparator. Insertion
 * sort over 10 items is both trivially cheap and deterministic everywhere,
 * which is what the regression sweep depends on.
 */
function rank(scored) {
  const out = scored.slice();
  for (let i = 1; i < out.length; i++) {
    const item = out[i];
    let j = i - 1;
    while (j >= 0 && compare(out[j], item) > 0) {
      out[j + 1] = out[j];
      j--;
    }
    out[j + 1] = item;
  }
  return out;
}

/** Eligible = fits the space AND is inside the budget. */
function eligible(bundles, length, depth, budget) {
  return bundles.filter((b) => fits(b, length, depth) && b.price <= budget);
}

/**
 * Match a set of answers to a bundle.
 *
 * @param {{functions: string[], length: number, depth: number, level: string, budget: number}} answers
 * @param {Array} bundles
 * @returns {{primary: object|null, alternates: object[], fallback: string|null, debug: object}}
 */
export function match(answers, bundles) {
  const a = {
    functions: Array.isArray(answers?.functions) ? answers.functions.slice() : [],
    length: Number(answers?.length) || 0,
    depth: Number(answers?.depth) || 0,
    level: answers?.level || 'beginner',
    budget: Number(answers?.budget) || 0
  };

  const debug = { answers: a, tier: FALLBACK.NONE, considered: 0, scores: [] };

  const finish = (pool, tier, extra = {}) => {
    const scored = rank(pool.map((b) => scoreBundle(b, a)));
    debug.tier = tier;
    debug.considered = pool.length;
    debug.scores = scored.map((s) => ({
      id: s.bundle.id,
      name: s.bundle.name,
      score: Math.round(s.score * 100) / 100,
      parts: s.parts
    }));
    return {
      primary: scored[0] ? scored[0].bundle : null,
      alternates: scored.slice(1, 3).map((s) => s.bundle),
      fallback: tier,
      debug: { ...debug, ...extra }
    };
  };

  // ── Normal path ────────────────────────────────────────────────────────────
  const exact = eligible(bundles, a.length, a.depth, a.budget);
  if (exact.length) return finish(exact, FALLBACK.NONE);

  // ── Tier 1: relax budget by 10% ────────────────────────────────────────────
  const relaxedBudget = a.budget * 1.1;
  const tier1 = eligible(bundles, a.length, a.depth, relaxedBudget);
  if (tier1.length) {
    const res = finish(tier1, FALLBACK.BUDGET);
    res.debug.overBudgetBy = res.primary ? Math.max(0, res.primary.price - a.budget) : 0;
    return res;
  }

  // ── Tier 2: relax the SHORTER dimension by 0.5m, original budget ───────────
  // Only the shorter side is relaxed: it is the one most likely to have been
  // measured short (a nook, a wardrobe door), and relaxing both would let us
  // recommend a machine that cannot physically enter the room.
  const relaxL = a.length <= a.depth ? a.length + 0.5 : a.length;
  const relaxD = a.depth < a.length ? a.depth + 0.5 : a.depth;
  const tier2 = eligible(bundles, relaxL, relaxD, a.budget);
  if (tier2.length) {
    const res = finish(tier2, FALLBACK.SPACE);
    res.debug.relaxedSpace = { length: relaxL, depth: relaxD };
    return res;
  }

  // ── Tier 3: space fit only, budget ignored ─────────────────────────────────
  // Ranked cheapest-first, then smallest. That yields The Fast Track wherever it
  // physically fits, and The Silent Operator when the room is under 1.5m a side.
  const spaceOnly = bundles.filter((b) => fits(b, a.length, a.depth));
  if (spaceOnly.length) {
    const cheapestFirst = spaceOnly.slice().sort(
      (x, y) =>
        x.price - y.price ||
        x.footprint.length * x.footprint.depth - y.footprint.length * y.footprint.depth ||
        x.id - y.id
    );
    debug.tier = FALLBACK.SMALLEST;
    debug.considered = spaceOnly.length;
    debug.scores = [];
    return {
      primary: cheapestFirst[0],
      alternates: cheapestFirst.slice(1, 3),
      fallback: FALLBACK.SMALLEST,
      debug: { ...debug, overBudgetBy: Math.max(0, cheapestFirst[0].price - a.budget) }
    };
  }

  // ── Tier 4: nothing fits. Never fabricate a bundle. ────────────────────────
  debug.tier = FALLBACK.CONTACT;
  return { primary: null, alternates: [], fallback: FALLBACK.CONTACT, debug };
}

export default match;
