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

/** Scoring weights. Must total 100. */
export const WEIGHTS = { fn: 40, budget: 25, space: 20, persona: 15 };

/**
 * The "no preference" sentinel, stored in `answers.functions` like a tag.
 *
 * It is deliberately NOT a member of FUNCTION_OPTIONS: no bundle can carry it,
 * nothing in the sheet can define it, and it never reaches the product data. It
 * exists so a visitor who does not want to answer question one can say so in
 * the one field that question owns, rather than needing a second field that
 * every consumer of `answers` would then have to know about.
 *
 * The leading underscore keeps it out of the namespace a real tag could ever
 * occupy, so a tag added to the sheet can never collide with it.
 */
export const ANY_FUNCTION = '_any';

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
  // "No preference" is not a function anyone can train, so it cannot be scored
  // like one. It means the visitor has declined to use this axis, and the
  // honest reading of that is to stop discriminating on it: every bundle scores
  // the same 40 points and the ranking falls to space, budget and persona.
  //
  // Full marks rather than zero, deliberately. Both are neutral for RANKING,
  // since a constant shifts every bundle equally, but zero also drags the
  // absolute score down by the whole 40-point axis. Nothing reads the absolute
  // score today; the moment anything does, a floor of 60 for every visitor who
  // ticked one box would be a bug laid in advance.
  if (selected.includes(ANY_FUNCTION)) return 1;
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

/**
 * Does this bundle target the persona the customer picked?
 *
 * THIS REPLACED A DISTANCE SCORE, AND IT HAD TO.
 *   The old version matched training level, where beginner, intermediate and
 *   advanced sit on a line, so "one rung out" could sensibly score 0.6. The
 *   sheet now matches on persona instead, and personas are not on a line: a
 *   Convenience Seeker is not "one step" from a Serious Strength Trainer, they
 *   want a different machine. There is no honest partial credit to give, so
 *   this is deliberately all or nothing.
 *
 * A bundle can serve more than one persona; bundle 3 is built for both the
 * Maximum Function User and the Serious Strength Trainer.
 *
 * Comparison ignores case and punctuation so "Guided / Accountability User" and
 * "guided/accountability user" are the same person, which matters because the
 * name is typed by hand on two different tabs.
 */
const flat = (v) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');

export function personaScore(userPersona, bundlePersonas) {
  if (!userPersona || !Array.isArray(bundlePersonas) || !bundlePersonas.length) return 0;
  const want = flat(userPersona);
  return bundlePersonas.some((p) => flat(p) === want) ? 1 : 0;
}

/** Full 0-100 score plus the component breakdown, for the debug payload. */
export function scoreBundle(bundle, answers) {
  const fn = functionScore(answers.functions, bundle.functions);
  const budget = budgetScore(bundle.price, answers.budget);
  const space = spaceScore(bundle, answers.length, answers.depth);
  const persona = personaScore(answers.persona, bundle.personas);

  const score =
    WEIGHTS.fn * fn +
    WEIGHTS.budget * budget +
    WEIGHTS.space * space +
    WEIGHTS.persona * persona;

  return {
    bundle,
    score,
    parts: { fn, budget, space, persona },
    // Raw coverage without the capability bonus, tie-break (a) uses this, so a
    // bundle that genuinely covers more of what you asked for wins over one that
    // merely does more things in general.
    // Tie-break (a). "No preference" has to tie here too, not just in the
    // score: no bundle contains the sentinel, so this already computes 0 for
    // every one of them and the chain falls through to price, then footprint,
    // then bundle number. Spelled out rather than left to coincidence, because
    // a future tweak that made an unmatched selection score anything other than
    // 0 would quietly turn "I don't mind" into a preference.
    coverage: answers.functions && answers.functions.length && !answers.functions.includes(ANY_FUNCTION)
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
 * For each thing the customer asked for that the answer does not do, work out
 * WHY, and what it would have taken.
 *
 * WHY THIS EXISTS.
 *   Two of the seven options on question one are carried by exactly one bundle:
 *   `multigym` only by The Fast Track, which needs 1.6 x 2.0 m, and `smart`
 *   only by The Silent Operator, at $5,899. Anyone with a narrower room or a
 *   smaller budget than those single bundles demand cannot be given what they
 *   asked for, because it does not exist in the catalogue.
 *
 *   The ladder already handles that honestly at the matching level: tier 2b
 *   deliberately drops the relevance floor rather than showing the contact card,
 *   on the grounds that a real bundle that fits and is affordable beats nothing.
 *   What it did NOT do was SAY so. Measured over the sweep space before this
 *   was added, a visitor asking only for app-guided digital resistance was shown
 *   a bundle containing none of it in 58.7% of cases, and 36.0% for a machine
 *   circuit, with no banner at all, because tier 2b returns FALLBACK.NONE and
 *   the banner only fired on a named fallback rung.
 *
 *   So the page needs more than "we compromised". It needs to name the thing it
 *   could not give them, name the constraint that ruled it out, and quote the
 *   figure that would have changed the answer. That last part is what makes it
 *   actionable rather than an apology: "the smallest one we make needs 1.6 x
 *   2.0 m" tells someone with a 1.5 m wall exactly where they stand.
 *
 * WHAT `blocked` MEANS.
 *   space        no bundle carrying this fits the room, at any price
 *   budget       they all fit, but none is within budget
 *   both         neither gate can be cleared by any of them
 *   combination  some fit and some are affordable, but no single one is both
 *   none         nothing in the catalogue carries this tag at all. Not
 *                reachable from the quiz today, since every option on question
 *                one is checked against the data by the test suite, but a sheet
 *                edit could create it between syncs and a silent wrong answer
 *                here would be worse than an awkward one.
 */
export function explainGaps(a, bundles, primary) {
  const named = a.functions.filter((f) => f !== ANY_FUNCTION);
  if (!named.length || !primary) return [];

  return named
    .filter((fn) => !primary.functions.includes(fn))
    .map((fn) => {
      const carriers = bundles.filter((b) => b.functions.includes(fn));
      if (!carriers.length) return { fn, carriers: 0, blocked: 'none', smallest: null, cheapest: null };

      const fitsAny = carriers.some((b) => fits(b, a.length, a.depth));
      const affordAny = carriers.some((b) => b.price <= a.budget);
      const blocked =
        !fitsAny && !affordAny ? 'both'
        : !fitsAny ? 'space'
        : !affordAny ? 'budget'
        : 'combination';

      // The one to quote at them. Smallest by area for a space problem, cheapest
      // for a money problem: quoting the cheapest machine's footprint to someone
      // whose room is too narrow would be answering a question they did not ask.
      const area = (b) => b.footprint.length * b.footprint.depth;
      const smallest = carriers.slice().sort((x, y) => area(x) - area(y) || x.id - y.id)[0];
      const cheapest = carriers.slice().sort((x, y) => x.price - y.price || x.id - y.id)[0];

      return { fn, carriers: carriers.length, blocked, smallest, cheapest };
    });
}

/**
 * Match a set of answers to a bundle.
 *
 * @param {{functions: string[], length: number, depth: number, persona: string, budget: number}} answers
 * @param {Array} bundles
 * @returns {{primary: object|null, alternates: object[], fallback: string|null, debug: object}}
 */
export function match(answers, bundles) {
  const a = {
    functions: Array.isArray(answers?.functions) ? answers.functions.slice() : [],
    length: Number(answers?.length) || 0,
    depth: Number(answers?.depth) || 0,
    // No default persona. Guessing one would silently hand 15 points to
    // whichever bundles happen to serve it, on behalf of a customer who never
    // said that about themselves.
    persona: answers?.persona || null,
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
    const primary = scored[0] ? scored[0].bundle : null;
    return {
      primary,
      alternates: scored.slice(1, 3).map((s) => s.bundle),
      fallback: tier,
      // What the customer asked for that this answer does not do, and why.
      // Empty on the overwhelming majority of paths, which is the point: it is
      // only non-empty when the page owes the visitor an explanation.
      gaps: explainGaps(a, bundles, primary),
      debug: { ...debug, ...extra }
    };
  };

  /**
   * RELEVANCE FLOOR.
   *
   * A pool only counts if something in it does at least one of the things the
   * customer asked for. Without this, the ladder answers "I want a machine
   * circuit" with a leg press, purely because the leg press is small and cheap
   * enough to clear the space and budget gates while every actual machine
   * circuit is filtered out a few centimetres short.
   *
   * functionScore already discounts a bundle that covers nothing to 0.05, so it
   * loses every time it is ranked ALONGSIDE a relevant bundle. The gap this
   * closes is the case where it is the only thing left in the pool and so wins
   * by default. A relaxed tier that answers the question beats an exact tier
   * that does not, and the page already labels a relaxed result "Nearest match".
   *
   * Only applies when the customer named specific functions. "No preference"
   * and "all of the above" leave every pool exactly as it was.
   */
  const named = a.functions.length && !a.functions.includes(ANY_FUNCTION);
  const relevant = (pool) =>
    named ? pool.filter((b) => a.functions.some((fn) => b.functions.includes(fn))) : pool;

  // ── Normal path ────────────────────────────────────────────────────────────
  const exact = eligible(bundles, a.length, a.depth, a.budget);
  const exactRelevant = relevant(exact);
  if (exactRelevant.length) return finish(exactRelevant, FALLBACK.NONE);

  // ── Tier 1: relax budget by 10% ────────────────────────────────────────────
  const relaxedBudget = a.budget * 1.1;
  const tier1 = relevant(eligible(bundles, a.length, a.depth, relaxedBudget));
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
  const tier2 = relevant(eligible(bundles, relaxL, relaxD, a.budget));
  if (tier2.length) {
    const res = finish(tier2, FALLBACK.SPACE);
    res.debug.relaxedSpace = { length: relaxL, depth: relaxD };
    return res;
  }

  // ── Tier 2b: nothing relevant anywhere, so take the exact pool as it is ────
  // The floor above is a preference, not a veto. If no tier holds a bundle that
  // covers what was asked for, an in-budget bundle that fits the room is still
  // a better answer than skipping to the cheapest thing on the list, and far
  // better than the contact card.
  if (exact.length) return finish(exact, FALLBACK.NONE);

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
      gaps: explainGaps(a, bundles, cheapestFirst[0]),
      debug: { ...debug, overBudgetBy: Math.max(0, cheapestFirst[0].price - a.budget) }
    };
  }

  // ── Tier 4: nothing fits. Never fabricate a bundle. ────────────────────────
  // No gaps here, deliberately. There is no bundle to explain a shortfall in,
  // and the contact card already says the honest thing: nothing we make fits.
  debug.tier = FALLBACK.CONTACT;
  return { primary: null, alternates: [], fallback: FALLBACK.CONTACT, gaps: [], debug };
}

export default match;
