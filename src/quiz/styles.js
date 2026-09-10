/**
 * All CSS for the quiz, as a tagged-template string injected into the shadow root.
 *
 * Nothing here leaks out and nothing from the host page leaks in: every selector
 * is scoped by the shadow boundary, and `all: initial` on :host resets anything
 * the host might otherwise inherit into the component (Bootstrap and Tailwind
 * both set box-sizing and line-height globally).
 *
 * ── Modernist design system, per the design handoff of 30 Aug 2026 ──────────
 *   ground        #ffffff (the quiz sits on the site's white content area,
 *                 not the system's own #f3f2f2)
 *   text          #201e1d
 *   accent        #ec3013
 *   type          Archivo 400 / 600 / 800 throughout
 *   radius        0 everywhere. Non-negotiable in this system.
 *   rules         2px, never a hairline where a 2px rule is specified
 *   alignment     flush left, including labels inside wide buttons
 *   photography   grayscale, via the .grayscale wrapper
 *
 * TWO DELIBERATE DEVIATIONS, both to hold WCAG AA. Each steps one notch along
 * the system's own ramp, which is the mechanism the system itself prescribes
 * for text on tinted fills:
 *
 *   1. White on --accent is 4.20:1, under the 4.5 needed for the option-card
 *      title at its small end (16px) and its 14px description. Any surface that
 *      carries white text uses --accent-600 (#dd2b0f, 4.74:1) instead. Chrome
 *      that carries no text, meaning the progress fill, section rules and plan
 *      outline, keeps the true accent. The two reds are all but
 *      indistinguishable side by side.
 *   2. --neutral-600 is 4.30:1 on white. Small text the handoff assigns to it
 *      (step name, slider min and max) uses --neutral-700 (6.52:1).
 *
 * The handoff's option description at 88% white would be 3.95:1 even on
 * accent-600, so it renders at full white.
 */

/** Identity tag, so editors syntax-highlight the block as CSS. */
const css = (strings, ...values) => String.raw({ raw: strings }, ...values);

export const STYLES = css`
  :host {
    /* Reset anything inheriting in from the host page, then set our own basics. */
    all: initial;
    display: block;
    contain: layout style;

    --bg: #FFFFFF;
    --text: #201e1d;

    --n100: #f8f4f4;
    --n200: #eae7e7;
    --n300: #d7d3d3;
    --n400: #bab6b6;
    --n500: #9b9797;
    --n600: #7d7979;
    --n700: #605d5d;
    --n800: #444141;

    --accent: #ec3013;
    --accent-100: #fff2ef;
    --accent-600: #dd2b0f;   /* accent that carries white text */
    --accent-700: #ae1800;   /* accent at paragraph size */
    --accent-ink: #ae1800;   /* recomputed at runtime only for a custom accent */
    --on-accent: #FFFFFF;

    --divider: rgba(32, 30, 29, 0.4);
    --tile: var(--n100);

    --radius: 0px;
    --ease: cubic-bezier(0.22, 1, 0.36, 1);

    --f: Archivo, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

    font-family: var(--f);
    font-size: 16px;
    line-height: 1.5;
    color: var(--text);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
  }

  /* Dark placements. The system is a light theme; this is a courtesy inversion
     for hosts that need one, not part of the handoff. */
  :host([theme='dark']) {
    --bg: #161514;
    --text: #f6f4f3;
    --n100: #211f1e;
    --n200: #2a2827;
    --n300: #3a3736;
    --n400: #4d4a49;
    --n500: #6e6a69;
    --n600: #979392;
    --n700: #b6b2b1;
    --n800: #d6d2d1;
    --accent-100: #2a1310;
    --accent-ink: #ff8a70;
    --divider: rgba(246, 244, 243, 0.4);
    --tile: #FFFFFF;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .quiz {
    max-width: 1180px;
    margin: 0 auto;
    padding: clamp(10px, 1.2vw, 16px) clamp(16px, 4vw, 40px) 80px;
  }

  /* Every step body rises in. Killed entirely under reduced motion. */
  .view { animation: dcRise .4s var(--ease) both; }
  @keyframes dcRise {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }

  /* ── Progress header ────────────────────────────────────────────────────── */

  .progress { margin-bottom: clamp(16px, 2vw, 24px); }
  .progress__meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .progress__step { color: var(--text); }
  .progress__name { color: var(--n700); }
  .progress__track { height: 4px; background: var(--n200); }
  .progress__fill {
    height: 100%;
    background: var(--accent);
    transition: width .45s var(--ease);
  }

  /* ── Type ───────────────────────────────────────────────────────────────── */

  h1, h2, h3, p { margin: 0; }

  /* Each view's heading takes focus on a step change so screen readers land in
     the right place. That focus is programmatic, so the ring is suppressed for
     it; :focus-visible still draws one if a keyboard user reaches it directly. */
  [data-focus]:focus { outline: none; }
  [data-focus]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .headline {
    font-size: clamp(28px, 3.8vw, 46px);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    line-height: 0.98;
    max-width: 24ch;
    margin-bottom: 10px;
  }
  .subhead {
    font-size: clamp(15px, 1.4vw, 17px);
    font-weight: 400;
    color: var(--n700);
    max-width: 60ch;
    margin-bottom: clamp(14px, 1.6vw, 20px);
    line-height: 1.5;
  }
  .eyebrow {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-700);
    margin-bottom: 12px;
  }
  .note {
    font-size: 14px;
    color: var(--n700);
    line-height: 1.5;
    max-width: 60ch;
  }
  /* Full column width. Body copy wraps at 60ch because that is comfortable to
     read; a single line of fine print under a control is not body copy, and
     breaking it into three short ragged lines makes it look like an error. */
  .note--wide { max-width: none; }

  /* The system's 2px rule. Never softened to a hairline. */
  .hr {
    height: 2px;
    background: var(--divider);
    border: 0;
    margin: 22px 0;
  }

  /* Step one is the only multi-select, and a column of square boxes was not
     saying so loudly enough. The badge states the rule and the count proves it
     the moment a second option goes in. */
  .multi {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 14px;
  }
  .multi__badge {
    display: inline-block;
    background: var(--accent-100);
    border: 2px solid var(--accent);
    color: var(--accent-700);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 6px 10px;
  }
  .multi__count {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--n700);
    font-variant-numeric: tabular-nums;
  }

  /* ── Option cards ───────────────────────────────────────────────────────── */

  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 12px;
    border: 0;
    padding: 0;
    margin: 0;
  }
  .options--single { grid-template-columns: 1fr; max-width: 860px; }

  .option {
    position: relative;
    display: flex;
    gap: 16px;
    align-items: flex-start;
    min-height: 76px;
    padding: 18px 20px;
    background: var(--bg);
    border: 1px solid var(--n300);
    cursor: pointer;
    user-select: none;
    transition: background .15s, border-color .15s;
  }
  .option:hover { background: var(--n100); border-color: var(--n400); }

  /* The real control stays in the accessibility tree and keeps native keyboard
     behaviour. The handoff drives these as role="button" divs; native inputs in
     a label give the same interaction with correct checkbox and radio semantics
     and no keydown handling, so they are kept. */
  .option input {
    position: absolute;
    width: 1px; height: 1px;
    margin: 0; padding: 0;
    opacity: 0;
    pointer-events: none;
  }

  .option__mark {
    flex: 0 0 24px;
    width: 24px; height: 24px;
    margin-top: 1px;
    border: 2px solid var(--n400);
    background: var(--bg);
    display: grid;
    place-items: center;
    transition: background .15s, border-color .15s;
  }
  .option--check .option__mark { border-radius: 0; }   /* multi-select: square */
  .option--radio .option__mark { border-radius: 50%; } /* single-select: round */
  .option__mark svg {
    width: 14px; height: 14px;
    opacity: 0;
    transition: opacity .15s;
  }

  .option__body { min-width: 0; display: block; }
  .option__label {
    display: block;
    font-size: clamp(16px, 1.5vw, 19px);
    font-weight: 800;
    line-height: 1.2;
  }
  /* The words someone recognises themselves in, so they carry more weight
     than the explanation under them but less than the segment name above. */
  .option__quote {
    display: block;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    margin-top: 4px;
  }
  .option.is-selected .option__quote,
  .option:has(input:checked) .option__quote { color: #FFFFFF; }

  .option__help {
    display: block;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--n700);
    margin-top: 5px;
  }

  /* Selected: solid fill with the double-edge look from the mockups.
     .is-selected is toggled by JS and works everywhere; :has() is the
     progressive-enhancement path for state the component did not drive. */
  .option.is-selected,
  .option:has(input:checked) {
    background: var(--accent-600);
    border-color: var(--accent-700);
    outline: 3px solid var(--accent-600);
    outline-offset: -3px;
  }
  .option.is-selected .option__label,
  .option:has(input:checked) .option__label { color: #FFFFFF; }
  .option.is-selected .option__help,
  .option:has(input:checked) .option__help { color: #FFFFFF; }
  .option.is-selected .option__mark,
  .option:has(input:checked) .option__mark { background: var(--text); border-color: var(--text); }
  .option.is-selected .option__mark svg,
  .option:has(input:checked) .option__mark svg { opacity: 1; }
  .option.is-selected .option__mark svg path,
  .option:has(input:checked) .option__mark svg path { stroke: #FFFFFF; }

  /* The input is visually hidden but still focusable, so the ring is drawn on
     the label that wraps it. */
  .option:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* ── Step 2: space ──────────────────────────────────────────────────────── */

  /* The handoff puts the plan left and the sliders right. Source order is
     reversed here so the controls come first when the columns wrap on a phone,
     which is what was asked for. The plan panel holds nothing focusable, so
     visual order and tab order cannot disagree. */
  .space {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(20px, 3vw, 40px);
    align-items: stretch;
  }
  .space__controls { flex: 1 1 320px; min-width: 280px; }
  .space__plan { flex: 0 1 420px; min-width: 280px; }

  .room {
    border: 1px solid var(--n300);
    background: var(--n100);
    padding: clamp(14px, 1.6vw, 20px);
    height: 100%;
  }
  .room__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
  }
  .room__ref {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--n700);
  }
  .room__area {
    font-size: 15px;
    font-weight: 800;
    color: var(--accent-700);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .room svg { display: block; width: 100%; height: auto; }
  /* Legend for the reference kit. Anything that does not fit the stated floor
     is called out here as well as drawn dashed in the plan. */
  .legend {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .legend__item {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12.5px;
    color: var(--n700);
    line-height: 1.35;
  }
  .legend__item.is-tight { color: var(--accent-700); }
  .legend__item b { font-weight: 800; }
  .legend__key {
    flex: 0 0 16px;
    width: 16px; height: 12px;
    border: 2px solid var(--text);
    background: #FFFFFF;
  }
  .legend__key--bench { background: var(--n400); border-color: var(--n800); border-width: 1px; }
  .legend__key--bar { height: 5px; background: var(--n800); border: 0; }
  .legend__key--clear { background: none; border: 1.5px dashed var(--n500); }

  .room__caption {
    margin-top: 10px;
    font-size: 13px;
    color: var(--n700);
    line-height: 1.45;
  }

  .dim { margin-bottom: 22px; }
  .dim__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
  }
  .dim__label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .dim__value {
    font-size: 24px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  /* ── Range inputs ───────────────────────────────────────────────────────── */

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: var(--n300);
    margin: 14px 0;
    cursor: pointer;
  }
  input[type='range']:focus { outline: none; }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 0;
    background: var(--accent);
    border: 3px solid var(--bg);
    box-shadow: 0 0 0 1px var(--accent);
    cursor: grab;
  }
  input[type='range']::-moz-range-thumb {
    width: 22px; height: 22px;
    border-radius: 0;
    background: var(--accent);
    border: 3px solid var(--bg);
    box-shadow: 0 0 0 1px var(--accent);
    cursor: grab;
  }
  input[type='range']:active::-webkit-slider-thumb { cursor: grabbing; }
  input[type='range']:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--text); outline-offset: 2px; }
  input[type='range']:focus-visible::-moz-range-thumb { outline: 2px solid var(--text); outline-offset: 2px; }

  .ends {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
    color: var(--n700);
    font-variant-numeric: tabular-nums;
  }

  /* ── Step 4: budget ─────────────────────────────────────────────────────── */

  .budget { max-width: 760px; }
  .budget__value {
    font-size: clamp(48px, 9vw, 88px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--accent-700);
    font-variant-numeric: tabular-nums;
    margin-bottom: 18px;
  }

  /* ── Buttons ────────────────────────────────────────────────────────────── */

  /* Back on the left, Continue on the right.
     The primary action sits at the end of the row because that is where a
     reader who has finished the step is already looking, and Back sits where
     they would reach to undo. Continue is pushed over with margin rather than
     space-between so it stays right even on step one, where there is no Back
     beside it and the position would otherwise jump between steps. */
  .actions {
    display: flex;
    align-items: center;
    gap: 22px;
    flex-wrap: wrap;
    margin-top: clamp(14px, 1.6vw, 20px);
  }
  .actions [data-action="next"] { margin-left: auto; }

  /* The reason Continue is disabled goes on its own line under the row, so a
     long message cannot squeeze the buttons or push Continue off the right. */
  .actions .validation { flex: 1 0 100%; margin-top: 2px; }
  .actions--result { gap: 12px; margin-top: 26px; }

  .btn {
    font-family: var(--f);
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    line-height: 1;
    /* Flush left, including inside a button wider than its label. */
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 14px;
    min-height: 52px;
    padding: 16px 26px;
    border: 0;
    border-radius: 0;
    cursor: pointer;
    text-decoration: none;
    transition: background .15s, border-color .15s, color .15s;
  }
  .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .btn--primary { background: var(--accent-600); color: #FFFFFF; }
  .btn--primary:hover { background: var(--accent-700); }
  .btn--primary[disabled] { opacity: 0.45; cursor: not-allowed; }

  .btn--outline {
    background: transparent;
    color: var(--text);
    border: 2px solid var(--text);
  }
  .btn--outline:hover { background: color-mix(in srgb, var(--text) 7%, transparent); }

  /* WhatsApp keeps its own brand green: it is the single call to action, and the
     one place a colour from outside the system earns its keep. #06251A on
     #25D366 is 8.23:1. */
  .btn--wa { background: #25D366; color: #06251A; }
  .btn--wa:hover { background: #1EBE5A; }
  .btn--wa svg { width: 20px; height: 20px; flex: 0 0 auto; }

  .btn--text {
    background: none;
    border: 0;
    padding: 14px 2px;
    min-height: 44px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: var(--n800);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .btn--text:hover { color: var(--accent-700); }

  /* Sits in the actions row beside the disabled button rather than above it,
     so an unanswered step does not reserve a band of its own. */
  .validation {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent-700);
    max-width: 60ch;
    line-height: 1.35;
  }

  /* ── Matching transition ────────────────────────────────────────────────── */

  .matching {
    min-height: 45vh;
    display: grid;
    align-content: center;
    gap: 22px;
  }
  .matching__spinner {
    width: 34px; height: 34px;
    border: 3px solid var(--n200);
    border-top-color: var(--accent);
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Result ─────────────────────────────────────────────────────────────── */

  .banner {
    border: 2px solid var(--accent);
    background: var(--accent-100);
    padding: 16px 20px;
    margin-bottom: 28px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--n800);
  }
  .banner__label {
    display: block;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-700);
    margin-bottom: 6px;
  }

  .result__name {
    font-size: clamp(34px, 6vw, 68px);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.025em;
    line-height: 0.92;
    margin-bottom: 14px;
  }
  .result__tagline {
    font-size: clamp(16px, 1.6vw, 19px);
    font-weight: 400;
    color: var(--n700);
    max-width: 52ch;
    margin-bottom: 22px;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--n300);
    background: var(--n100);
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
  }
  .chip svg { width: 13px; height: 13px; flex: 0 0 auto; }
  .chip svg path { stroke: var(--accent); }

  .pricerow {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 10px 18px;
  }
  .pricerow__total {
    font-size: clamp(38px, 6vw, 62px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--accent-700);
    font-variant-numeric: tabular-nums;
  }
  .pricerow__meta { font-size: 14px; color: var(--n700); }

  .pitch {
    font-size: 16px;
    line-height: 1.6;
    color: var(--n800);
    max-width: 60ch;
  }

  .cta-note { margin-top: 16px; max-width: 52ch; }

  .section { margin-top: 44px; }
  .section__title {
    display: inline-block;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--accent);
    margin-bottom: 18px;
  }

  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    border: 1px solid var(--n300);
    padding: 8px 13px;
    font-size: 13px;
    font-weight: 600;
  }

  /* Product grid.
     FLEX, NOT GRID, and that is the whole fix for the empty tiles.

     A grid reserves a cell whether or not anything lands in it, so a bundle of
     three products in a two-column layout left a quarter of the block empty,
     and the grey backdrop showing through it read as a broken fourth product.
     In a wrapping flex row the odd card simply grows into the space instead, so
     there is nothing left over to look broken at any product count.

     Hairlines are drawn BY THE CARDS rather than by a grey background showing
     through a 1px gap, for the same reason: a card that is not there draws
     nothing at all. */
  .grid {
    display: flex;
    flex-wrap: wrap;
    border-top: 1px solid var(--n300);
    border-left: 1px solid var(--n300);
  }
  .grid > * {
    flex: 1 1 220px;
    min-width: 0;
    border-right: 1px solid var(--n300);
    border-bottom: 1px solid var(--n300);
  }

  /* The bundle and the room it lives in, side by side.
     The photograph is not a separate section any more: it sits in the space the
     product cards do not use, so the setup is visible while the contents are
     being read rather than a scroll away. Below 820px it stacks and leads. */
  .bundle-split { display: grid; grid-template-columns: 1fr; }
  .bundle-split .grid { border-left: 0; }
  @media (min-width: 820px) {
    .bundle-split { grid-template-columns: 1.1fr 0.9fr; }
    .bundle-split .grid { border-left: 1px solid var(--n300); }
    .bundle-split .install { order: 2; }
  }

  .install {
    position: relative;
    margin: 0;
    display: flex;
    flex-direction: column;
    background: var(--n100);
    border-right: 1px solid var(--n300);
    border-bottom: 1px solid var(--n300);
    border-top: 1px solid var(--n300);
    min-height: 260px;
  }
  @media (min-width: 820px) {
    .install { border-top: 1px solid var(--n300); }
  }
  .install img {
    display: block;
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
  }
  .install figcaption {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--n700);
    padding: 9px 12px;
    border-top: 1px solid var(--n300);
    background: #fff;
  }
  .card { display: flex; flex-direction: column; background: var(--bg); }
  .card__media {
    position: relative;
    aspect-ratio: 1 / 1;
    background: var(--tile);
    border-bottom: 1px solid var(--n300);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  /* The Modernist system prints photography black and white. That is dropped
     here on the client's instruction: greyed-out product shots read as broken
     or unavailable stock rather than as a design choice, which is exactly how
     they were reported. The wrapper stays so the rule can be restored in one
     line if that judgement changes. */
  .grayscale { width: 100%; height: 100%; }
  .card__media img {
    width: 100%; height: 100%;
    object-fit: contain;
    padding: 14px;
    mix-blend-mode: multiply;
    display: block;
  }
  .card__fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--n100);
    color: var(--n500);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
    padding: 12px;
  }
  /* An explicit display value beats the [hidden] attribute's UA display:none,
     so without this the fallback plate sits on top of every product photo.
     No backticks in here: this whole sheet is a JS template literal. */
  .card__fallback[hidden] { display: none; }

  .card__body {
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }
  .card__name { font-size: 15px; font-weight: 800; line-height: 1.3; }
  .card__prices {
    margin-top: auto;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
  }
  .card__price { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .card__was {
    font-size: 13px;
    color: var(--n700);
    text-decoration: line-through;
    font-variant-numeric: tabular-nums;
  }
  .card__sale {
    background: var(--accent-600);
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 3px 6px;
  }
  .card__badge {
    position: absolute;
    top: 0; left: 0;
    background: var(--text);
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 4px 8px;
    z-index: 1;
  }
  .card__link {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-700);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .card__link:hover { text-decoration: underline; text-underline-offset: 3px; }
  .card__link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 18px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--n700);
  }
  .total-row b {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.01em;
    text-transform: none;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  /* Alternates */
  .alts { display: grid; gap: 1px; background: var(--n300); border: 1px solid var(--n300); }
  .alt {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 18px 20px;
    background: var(--bg);
    text-align: left;
    width: 100%;
    font-family: var(--f);
    color: inherit;
    border: 0;
    cursor: pointer;
    transition: background .15s;
  }
  .alt:hover { background: var(--n100); }
  .alt:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .alt__main { flex: 1 1 220px; min-width: 0; }
  .alt__name {
    font-size: 18px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }
  .alt__tagline { font-size: 13px; color: var(--n700); margin-top: 4px; }
  .alt__meta {
    display: flex;
    align-items: baseline;
    gap: 16px;
    font-size: 14px;
    color: var(--n700);
    font-variant-numeric: tabular-nums;
  }
  .alt__price { font-size: 18px; font-weight: 800; color: var(--text); }
  .alt__cta {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-700);
    white-space: nowrap;
  }

  .retake {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    margin-top: 20px;
  }
  .summary {
    margin-top: 14px;
    font-size: 14px;
    color: var(--n700);
    font-variant-numeric: tabular-nums;
  }

  /* Rooms strip. Same hairline-as-gap trick as the product grid. */
  /* Same hairline-by-the-tile rule as the product grid, for the same reason:
     twenty tiles rarely divide evenly into however many columns fit, so the
     last row is almost always short and would otherwise end in grey blocks. */
  .rooms {
    display: grid;
    /* 150px rather than 190px so a 375px phone gets two tiles across. Twenty
       posts in a single column is a very long scroll for a strip that is meant
       to be skimmed. */
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    border-top: 1px solid var(--n300);
    border-left: 1px solid var(--n300);
    margin-top: 16px;
  }
  .room {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    background: #fff;
    border-right: 1px solid var(--n300);
    border-bottom: 1px solid var(--n300);
  }
  .room:hover .room__title, .room:focus-visible .room__title { color: var(--accent-700); }
  .room:focus-visible { outline: 2px solid var(--accent-700); outline-offset: -2px; }

  .room__media {
    position: relative;
    display: block;
    aspect-ratio: 1 / 1;
    background: var(--n100);
    overflow: hidden;
  }
  .room__media img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .room__body { display: block; padding: 10px 12px 12px; }
  .room__title {
    display: block;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.3;
  }
  .room__meta {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--n700);
  }

  /* Thumbnail on an alternate bundle row. */
  .alt__media {
    position: relative;
    flex: 0 0 96px;
    width: 96px;
    height: 96px;
    background: var(--n100);
    overflow: hidden;
  }
  .alt__media img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* The closing no-obligation block is boxed so it reads as an offer rather
     than another paragraph. */
  .advice {
    border: 2px solid var(--text);
    padding: clamp(20px, 3vw, 28px);
  }
  .advice .section__title { margin-top: 0; }

  .fineprint {
    margin-top: 18px;
    font-size: 13px;
    color: var(--n700);
    line-height: 1.55;
    max-width: 60ch;
  }

  /* "Let's talk", the last rung of the fallback ladder */
  .talk {
    border: 2px solid var(--text);
    padding: clamp(28px, 5vw, 48px);
    max-width: 760px;
  }
  .talk .headline { margin-bottom: 14px; }

  .visually-hidden {
    position: absolute !important;
    width: 1px; height: 1px;
    margin: -1px; padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* Nothing floats and nothing bounces. Under reduced motion the step entrance
     and the progress transition go away entirely. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    .view { animation: none; }
  }
`;

export default STYLES;
