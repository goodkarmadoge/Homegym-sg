/**
 * All CSS for the quiz, as a tagged-template string injected into the shadow root.
 *
 * Nothing here leaks out and nothing from the host page leaks in: every selector
 * is scoped by the shadow boundary, and `all: initial` on :host resets anything
 * the host might otherwise inherit into the component (Bootstrap and Tailwind
 * both set box-sizing and line-height globally).
 *
 * ── The palette is homegym.sg's own, read off the live site on 30 Aug 2026 ──
 *   ground        #FFFFFF
 *   body text     #333333
 *   body face     "Open Sans", Helvetica, Arial
 *   display face  Oswald (their nav and .action buttons)
 *   primary CTA   #FF6924 with BLACK text, square corners
 *   links         #22B4FF
 *   sale red      #F64127
 *   borders       0px radius everywhere — their whole UI is square
 *
 * Two deliberate departures from the live site, both accessibility fixes:
 *   1. Link blue #22B4FF scores 2.32:1 on white and fails WCAG AA badly. Text
 *      uses --link-ink (#0077B3, 4.89:1) instead; the raw blue is kept for
 *      non-text accents where contrast rules do not apply.
 *   2. #FF6924 as TEXT on white is 2.88:1. --accent-ink is recomputed at runtime
 *      (see readableAccent in the component) so accent-coloured text always
 *      clears 4.5:1, whatever accent a host page passes in.
 *
 * The dark theme is kept behind theme="dark" for placements on a dark ground.
 */

/** Identity tag — exists so editors syntax-highlight the block as CSS. */
const css = (strings, ...values) => String.raw({ raw: strings }, ...values);

export const STYLES = css`
  :host {
    /* Reset anything inheriting in from the host page, then set our own basics. */
    all: initial;
    display: block;
    contain: layout style;

    /* Light — homegym.sg's own palette. This is the default. */
    --bg: #FFFFFF;
    --surface: #F7F7F7;
    --surface-2: #F0F0F0;
    --text: #333333;
    --muted: #666666;
    --line: #DDDDDD;
    --line-strong: #BBBBBB;
    --accent: #FF6924;
    --accent-ink: #FF6924;      /* text-safe accent, recomputed at runtime */
    --on-accent: #000000;       /* their CTA buttons use black text */
    --link: #22B4FF;
    --link-ink: #0077B3;        /* AA-safe version of the link blue */
    --sale: #F64127;            /* their brand red — background only, black text on it */
    --sale-ink: #C62D14;        /* AA-safe red for red TEXT on white */
    --tile: #FFFFFF;            /* product images always sit on white */

    --radius: 0px;              /* homegym.sg is square throughout */
    --radius-lg: 0px;
    --step: 180ms;
    --ease: cubic-bezier(0.22, 0.61, 0.36, 1);

    --f-body: "Open Sans", Helvetica, Arial, sans-serif;
    --f-display: Oswald, "Open Sans", Helvetica, Arial, sans-serif;

    font-family: var(--f-body);
    font-size: 16px;
    line-height: 1.6;
    color: var(--text);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  :host([theme='dark']) {
    --bg: #111111;
    --surface: #1A1A1A;
    --surface-2: #222222;
    --text: #F5F5F3;
    --muted: #A8A8A8;
    --line: #333333;
    --line-strong: #4A4A4A;
    --on-accent: #000000;
    --sale-ink: #FF8A70;
    --link-ink: #5CC8FF;
    --tile: #FFFFFF;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .quiz {
    max-width: 860px;
    margin: 0 auto;
    padding: 28px 20px 64px;
  }
  .quiz--result { max-width: 1100px; }

  /* ── Progress ───────────────────────────────────────────────────────────── */

  .progress { margin-bottom: 32px; }
  .progress__meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--f-display);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .progress__track {
    height: 4px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .progress__fill {
    height: 100%;
    background: var(--accent);
    transition: width var(--step) var(--ease);
  }

  /* ── Typography ─────────────────────────────────────────────────────────── */

  h1, h2, h3, p { margin: 0; }

  /* Each view's heading takes focus on a step change so screen readers land in
     the right place. That focus is programmatic, not keyboard-initiated, so the
     ring is suppressed for it — :focus-visible still draws one if a keyboard
     user ever reaches the heading themselves. */
  [data-focus]:focus { outline: none; }
  [data-focus]:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 4px; }

  .headline {
    font-family: var(--f-display);
    font-size: clamp(1.6rem, 5vw, 2.5rem);
    line-height: 1.1;
    letter-spacing: 0.005em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .subhead {
    color: var(--muted);
    font-size: 15px;
    margin-bottom: 28px;
    max-width: 56ch;
  }
  .eyebrow {
    font-family: var(--f-display);
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent-ink);
    font-weight: 600;
    margin-bottom: 10px;
  }
  .note {
    color: var(--muted);
    font-size: 13.5px;
    line-height: 1.6;
  }

  /* ── Option cards (Step 1 multi-select, Step 3 single-select) ───────────── */

  .options {
    display: grid;
    gap: 10px;
    margin-bottom: 28px;
    border: 0;
    padding: 0;
  }
  @media (min-width: 640px) {
    .options--two { grid-template-columns: 1fr 1fr; }
  }

  .option {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    min-height: 44px;
    padding: 16px 18px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background var(--step) var(--ease), border-color var(--step) var(--ease);
  }
  .option:hover { border-color: var(--line-strong); background: var(--surface); }

  /* The real control stays in the accessibility tree and keeps native keyboard
     behaviour — it is only visually replaced by .option__mark. */
  .option input {
    position: absolute;
    width: 1px; height: 1px;
    margin: 0; padding: 0;
    opacity: 0;
    pointer-events: none;
  }

  .option__mark {
    flex: 0 0 auto;
    width: 22px; height: 22px;
    margin-top: 2px;
    border: 2px solid var(--line-strong);
    background: transparent;
    display: grid;
    place-items: center;
    transition: background var(--step) var(--ease), border-color var(--step) var(--ease);
  }
  .option--check .option__mark { border-radius: 0; }
  .option--radio .option__mark { border-radius: 50%; }
  .option__mark svg { width: 13px; height: 13px; opacity: 0; transition: opacity var(--step) var(--ease); }

  /* These are spans inside a <label>, so they need an explicit block display —
     as inline elements the helper text runs on from the label. */
  .option__body { min-width: 0; display: block; }
  .option__label { display: block; font-weight: 700; line-height: 1.35; }
  .option__help { display: block; color: var(--muted); font-size: 13.5px; margin-top: 3px; }

  /* Selected state is a filled accent block, not a border tint — it has to be
     unmistakable on a phone screen in daylight.

     Written twice on purpose: .is-selected is toggled by JS and works
     everywhere; :has() is the progressive-enhancement path that also catches
     state changes the component did not drive (autofill, form reset). Engines
     without :has() simply drop the rules they cannot parse. */
  .option.is-selected,
  .option:has(input:checked) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .option.is-selected .option__help,
  .option:has(input:checked) .option__help { color: var(--on-accent); opacity: 0.72; }
  .option.is-selected .option__mark,
  .option:has(input:checked) .option__mark { background: var(--on-accent); border-color: var(--on-accent); }
  .option.is-selected .option__mark svg,
  .option:has(input:checked) .option__mark svg { opacity: 1; }
  .option.is-selected .option__mark svg path,
  .option:has(input:checked) .option__mark svg path { stroke: var(--accent); }

  /* The real input is visually hidden but still focusable, so the focus ring
     has to be drawn on the label that wraps it. */
  .option:focus-within {
    outline: 3px solid var(--accent-ink);
    outline-offset: 2px;
  }

  /* ── Space step ─────────────────────────────────────────────────────────── */

  .dims { display: grid; gap: 22px; margin-bottom: 24px; }
  @media (min-width: 560px) { .dims { grid-template-columns: 1fr 1fr; } }

  .dim__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    gap: 12px;
  }
  .dim__label {
    font-family: var(--f-display);
    font-weight: 500;
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .dim__row { display: flex; align-items: center; gap: 14px; }
  .dim__row input[type='range'] { flex: 1 1 auto; min-width: 0; }

  .dim__number {
    flex: 0 0 84px;
    width: 84px;
    height: 44px;
    padding: 0 10px;
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 0;
    text-align: center;
  }
  .dim__number:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 2px; }

  .room {
    background: var(--surface);
    border: 1px solid var(--line);
    padding: 18px;
    margin-bottom: 22px;
  }
  .room svg { display: block; width: 100%; height: auto; }
  .room__caption {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--muted);
  }
  .room__area {
    font-variant-numeric: tabular-nums;
    color: var(--text);
    font-weight: 700;
    white-space: nowrap;
  }

  /* ── Range inputs ───────────────────────────────────────────────────────── */

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 44px;               /* full 44px touch target, visually a thin track */
    background: transparent;
    margin: 0;
    cursor: pointer;
  }
  input[type='range']:focus { outline: none; }
  input[type='range']:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 4px; }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--surface-2);
  }
  input[type='range']::-moz-range-track {
    height: 4px;
    background: var(--surface-2);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 26px; height: 26px;
    margin-top: -11px;
    border-radius: 50%;
    background: var(--accent);
    border: 3px solid var(--bg);
    box-shadow: 0 0 0 1px var(--accent);
    transition: transform var(--step) var(--ease);
  }
  input[type='range']::-moz-range-thumb {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--accent);
    border: 3px solid var(--bg);
    box-shadow: 0 0 0 1px var(--accent);
  }
  input[type='range']:active::-webkit-slider-thumb { transform: scale(1.1); }

  /* ── Budget step ────────────────────────────────────────────────────────── */

  .budget__value {
    font-family: var(--f-display);
    font-size: clamp(2.5rem, 11vw, 4rem);
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
    color: var(--accent-ink);
    font-variant-numeric: tabular-nums;
    margin-bottom: 22px;
  }
  .budget__ends {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }

  /* ── Buttons ────────────────────────────────────────────────────────────── */

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 32px;
    flex-wrap: wrap;
  }

  .btn {
    font-family: var(--f-display);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    min-height: 48px;
    padding: 0 26px;
    border-radius: 0;
    border: 1px solid transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    text-decoration: none;
    transition: background var(--step) var(--ease), border-color var(--step) var(--ease), opacity var(--step) var(--ease);
  }
  .btn:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 3px; }

  .btn--primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .btn--primary:hover { filter: brightness(1.07); }
  .btn--primary[disabled] { opacity: 0.35; cursor: not-allowed; filter: none; }

  .btn--ghost { background: transparent; color: var(--text); border-color: var(--line-strong); }
  .btn--ghost:hover { border-color: var(--text); }

  .btn--wa { background: #25D366; color: #06251A; border-color: #25D366; }
  .btn--wa:hover { filter: brightness(1.06); }
  .btn--wa svg { width: 19px; height: 19px; }

  .btn--text {
    font-family: var(--f-body);
    background: none;
    border: none;
    color: var(--link-ink);
    text-transform: none;
    letter-spacing: 0;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 12px 4px;
    min-height: 44px;
    font-weight: 600;
    font-size: 14px;
  }
  .btn--text:hover { color: var(--text); }

  .link-inline {
    color: var(--link-ink);
    text-decoration: underline;
    text-underline-offset: 3px;
    font-weight: 700;
  }

  .validation {
    color: var(--sale-ink);
    font-size: 14px;
    font-weight: 700;
    min-height: 20px;
  }

  /* ── Matching transition ────────────────────────────────────────────────── */

  .matching {
    min-height: 45vh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 20px;
    text-align: center;
  }
  .matching__spinner {
    width: 34px; height: 34px;
    border: 3px solid var(--surface-2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Result ─────────────────────────────────────────────────────────────── */

  .banner {
    display: flex;
    gap: 12px;
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent);
    margin-bottom: 28px;
    font-size: 14.5px;
    line-height: 1.55;
  }

  .result__name {
    font-family: var(--f-display);
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: 1.04;
    letter-spacing: 0.005em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .result__tagline {
    font-size: clamp(1rem, 2.4vw, 1.2rem);
    font-weight: 400;
    color: var(--muted);
    margin-bottom: 24px;
    max-width: 44ch;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 26px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 13.5px;
    font-weight: 600;
  }
  .chip svg { width: 13px; height: 13px; flex: 0 0 auto; }
  .chip svg path { stroke: var(--accent-ink); }

  .pricebox {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 20px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    margin-bottom: 24px;
  }
  .pricebox__total {
    font-family: var(--f-display);
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 600;
    color: var(--accent-ink);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .pricebox__save { color: var(--muted); font-size: 15px; }
  .pricebox__save b { color: var(--sale-ink); font-weight: 700; }

  .pitch { font-size: 16px; line-height: 1.65; margin-bottom: 20px; max-width: 64ch; }

  .section { margin-top: 44px; }
  .section__title {
    font-family: var(--f-display);
    font-size: 14px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--text);
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--accent);
    display: inline-block;
  }

  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    padding: 8px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 14px;
  }

  /* Product grid — 1 col, 2 up at 640, 3 up at 1024 */
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  @media (min-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .grid { grid-template-columns: repeat(3, 1fr); } }

  .card {
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--line);
    overflow: hidden;
    transition: border-color var(--step) var(--ease);
  }
  .card:hover { border-color: var(--line-strong); }
  .card__media {
    position: relative;
    aspect-ratio: 1 / 1;
    background: var(--tile);
    border-bottom: 1px solid var(--line);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .card__media img {
    width: 100%; height: 100%;
    object-fit: contain;
    padding: 12px;
    display: block;
  }
  /* Fallback tile when the CloudFront cache path 404s. */
  .card__fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: #F0F0F0;
    color: #8A8A8A;
    font-family: var(--f-display);
    font-size: 44px;
    font-weight: 600;
  }
  /* An explicit `display` beats the [hidden] attribute's UA `display:none`, so
     without this the fallback tile sits on top of every product photo forever. */
  .card__fallback[hidden] { display: none; }
  .card__badge {
    position: absolute;
    top: 0; left: 0;
    background: var(--text);
    color: #FFFFFF;
    font-family: var(--f-display);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 10px;
  }
  .card__body { padding: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .card__name { font-size: 15px; font-weight: 700; line-height: 1.35; }
  .card__prices { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .card__price { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .card__was { color: var(--muted); text-decoration: line-through; font-size: 14px; font-variant-numeric: tabular-nums; }
  .card__sale {
    background: var(--sale);
    color: #000000;
    font-family: var(--f-display);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    padding: 3px 8px;
  }
  .card__link {
    margin-top: auto;
    color: var(--link-ink);
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .card__link:hover { text-decoration: underline; text-underline-offset: 3px; }
  .card__link:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 3px; }

  .total-row {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 12px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
    font-size: 15px;
    color: var(--muted);
  }
  .total-row b {
    font-family: var(--f-display);
    color: var(--text);
    font-size: 22px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Alternates */
  .alts { display: grid; gap: 12px; }
  .alt {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 18px;
    background: var(--bg);
    border: 1px solid var(--line);
    text-align: left;
    width: 100%;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: border-color var(--step) var(--ease), background var(--step) var(--ease);
  }
  .alt:hover { border-color: var(--line-strong); background: var(--surface); }
  .alt:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 2px; }
  .alt__main { flex: 1 1 220px; min-width: 0; }
  .alt__name {
    font-family: var(--f-display);
    font-weight: 600;
    font-size: 18px;
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }
  .alt__tagline { color: var(--muted); font-size: 13.5px; margin-top: 3px; }
  .alt__meta {
    display: flex;
    align-items: baseline;
    gap: 16px;
    font-size: 14px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .alt__price { color: var(--text); font-weight: 700; font-size: 18px; }
  .alt__cta { color: var(--link-ink); font-weight: 700; font-size: 14px; white-space: nowrap; }

  .retake {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    margin-top: 44px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
  }

  .fineprint {
    margin-top: 20px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.6;
  }

  /* "Let's talk" card — fallback tier 4 */
  .talk {
    text-align: center;
    padding: 48px 24px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .talk .headline { margin-bottom: 14px; }
  .talk .actions { justify-content: center; }

  .visually-hidden {
    position: absolute !important;
    width: 1px; height: 1px;
    margin: -1px; padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* Nothing bounces, and under reduced motion nothing moves at all. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default STYLES;
