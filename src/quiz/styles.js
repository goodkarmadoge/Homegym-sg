/**
 * All CSS for the quiz, as a tagged-template string injected into the shadow root.
 *
 * Nothing here leaks out and nothing from the host page leaks in: every selector
 * is scoped by the shadow boundary, and `all: initial` on :host resets anything
 * the host might otherwise inherit into the component (Bootstrap and Tailwind
 * both set box-sizing and line-height globally).
 *
 * Colour tokens are defined once on :host and overridden for the light theme.
 * --accent-ink is computed at runtime (see contrast.js) so a client-supplied
 * accent still clears 4.5:1 for text.
 */

/** Identity tag — exists so editors syntax-highlight the block as CSS. */
const css = (strings, ...values) => String.raw({ raw: strings }, ...values);

export const STYLES = css`
  :host {
    /* Reset anything inheriting in from the host page, then set our own basics. */
    all: initial;
    display: block;
    contain: layout style;

    --bg: #0E0E10;
    --surface: #17171A;
    --surface-2: #1F1F23;
    --text: #F5F5F3;
    --muted: #8A8A8F;
    --line: #2A2A30;
    --accent: #FF5A1F;
    --accent-ink: #FF5A1F;      /* text-safe accent, recomputed at runtime */
    --on-accent: #0E0E10;
    --tile: #FFFFFF;            /* product images always sit on white */
    --radius: 12px;
    --radius-lg: 18px;
    --step: 180ms;
    --ease: cubic-bezier(0.22, 0.61, 0.36, 1);

    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: var(--text);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  :host([theme='light']) {
    --bg: #FFFFFF;
    --surface: #F6F6F4;
    --surface-2: #EDEDEA;
    --text: #0E0E10;
    --muted: #5A5A60;
    --line: #DCDCD8;
    --tile: #FFFFFF;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .quiz {
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }
  .quiz--result { max-width: 1100px; }

  /* ── Progress ───────────────────────────────────────────────────────────── */

  .progress { margin-bottom: 32px; }
  .progress__meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .progress__track {
    height: 3px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress__fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
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
    font-size: clamp(1.5rem, 4.5vw, 2.125rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 650;
    margin-bottom: 10px;
  }
  .subhead {
    color: var(--muted);
    font-size: 15px;
    margin-bottom: 28px;
    max-width: 54ch;
  }
  .eyebrow {
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent-ink);
    font-weight: 600;
    margin-bottom: 12px;
  }
  .note {
    color: var(--muted);
    font-size: 13.5px;
    line-height: 1.55;
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
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background var(--step) var(--ease), border-color var(--step) var(--ease);
  }
  .option:hover { border-color: var(--muted); }

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
    margin-top: 1px;
    border: 2px solid var(--muted);
    background: transparent;
    display: grid;
    place-items: center;
    transition: background var(--step) var(--ease), border-color var(--step) var(--ease);
  }
  .option--check .option__mark { border-radius: 6px; }
  .option--radio .option__mark { border-radius: 50%; }
  .option__mark svg { width: 13px; height: 13px; opacity: 0; transition: opacity var(--step) var(--ease); }

  /* These are spans inside a <label>, so they need an explicit block display —
     as inline elements the helper text runs on from the label. */
  .option__body { min-width: 0; display: block; }
  .option__label { display: block; font-weight: 550; line-height: 1.35; }
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
  .option:has(input:checked) .option__help { color: var(--on-accent); opacity: 0.75; }
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
    outline-offset: 3px;
  }

  /* ── Space step ─────────────────────────────────────────────────────────── */

  .dims { display: grid; gap: 22px; margin-bottom: 24px; }
  @media (min-width: 560px) { .dims { grid-template-columns: 1fr 1fr; } }

  .dim__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    gap: 12px;
  }
  .dim__label { font-weight: 550; font-size: 14px; }
  .dim__row { display: flex; align-items: center; gap: 14px; }
  .dim__row input[type='range'] { flex: 1 1 auto; min-width: 0; }

  .dim__number {
    flex: 0 0 84px;
    width: 84px;
    height: 44px;
    padding: 0 10px;
    font: inherit;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    text-align: center;
  }
  .dim__number:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 2px; }

  .room {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 18px;
    margin-bottom: 20px;
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
  .room__area { font-variant-numeric: tabular-nums; color: var(--text); font-weight: 550; white-space: nowrap; }

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
  input[type='range']:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 4px; border-radius: 6px; }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--line);
    border-radius: 2px;
  }
  input[type='range']::-moz-range-track {
    height: 4px;
    background: var(--line);
    border-radius: 2px;
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px; height: 28px;
    margin-top: -12px;
    border-radius: 50%;
    background: var(--accent);
    border: 3px solid var(--bg);
    box-shadow: 0 0 0 1px var(--accent);
    transition: transform var(--step) var(--ease);
  }
  input[type='range']::-moz-range-thumb {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--accent);
    border: 3px solid var(--bg);
    box-shadow: 0 0 0 1px var(--accent);
  }
  input[type='range']:active::-webkit-slider-thumb { transform: scale(1.1); }

  /* ── Budget step ────────────────────────────────────────────────────────── */

  .budget__value {
    font-size: clamp(2.5rem, 11vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--accent-ink);
    font-variant-numeric: tabular-nums;
    margin-bottom: 24px;
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
    font: inherit;
    font-weight: 600;
    min-height: 48px;
    padding: 0 24px;
    border-radius: 10px;
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
  .btn--primary:hover { filter: brightness(1.08); }
  .btn--primary[disabled] { opacity: 0.35; cursor: not-allowed; filter: none; }

  .btn--ghost { background: transparent; color: var(--text); border-color: var(--line); }
  .btn--ghost:hover { border-color: var(--muted); }

  .btn--wa { background: #25D366; color: #06251A; border-color: #25D366; }
  .btn--wa:hover { filter: brightness(1.06); }
  .btn--wa svg { width: 19px; height: 19px; }

  .btn--text {
    background: none;
    border: none;
    color: var(--muted);
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 12px 4px;
    min-height: 44px;
    font-weight: 500;
  }
  .btn--text:hover { color: var(--text); }

  .link-inline {
    color: var(--accent-ink);
    text-decoration: underline;
    text-underline-offset: 3px;
    font-weight: 550;
  }

  .validation {
    color: var(--accent-ink);
    font-size: 14px;
    font-weight: 550;
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
    border: 3px solid var(--line);
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
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    margin-bottom: 28px;
    font-size: 14.5px;
    line-height: 1.55;
  }

  .result__name {
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: 1.02;
    letter-spacing: -0.035em;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .result__tagline {
    font-size: clamp(1rem, 2.6vw, 1.25rem);
    font-weight: 400;
    color: var(--muted);
    margin-bottom: 22px;
    max-width: 40ch;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 500;
  }
  .chip svg { width: 13px; height: 13px; flex: 0 0 auto; }
  .chip svg path { stroke: var(--accent); }

  .pricebox {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 22px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    margin-bottom: 24px;
  }
  .pricebox__total {
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--accent-ink);
    font-variant-numeric: tabular-nums;
  }
  .pricebox__save { color: var(--muted); font-size: 15px; }
  .pricebox__save b { color: var(--text); font-weight: 600; }

  .pitch { font-size: 16px; line-height: 1.6; margin-bottom: 20px; max-width: 62ch; }

  .section { margin-top: 44px; }
  .section__title {
    font-size: 13px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    margin-bottom: 16px;
  }

  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    padding: 8px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
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
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .card__media {
    position: relative;
    aspect-ratio: 1 / 1;
    background: var(--tile);
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
    background: #EFEFEC;
    color: #55555C;
    font-size: 44px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  /* An explicit `display` beats the [hidden] attribute's UA `display:none`, so
     without this the fallback tile sits on top of every product photo forever. */
  .card__fallback[hidden] { display: none; }
  .card__badge {
    position: absolute;
    top: 10px; left: 10px;
    background: #0E0E10;
    color: #F5F5F3;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 5px 9px;
    border-radius: 6px;
  }
  .card__body { padding: 16px 16px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .card__name { font-size: 15px; font-weight: 600; line-height: 1.35; }
  .card__prices { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .card__price { font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .card__was { color: var(--muted); text-decoration: line-through; font-size: 14px; font-variant-numeric: tabular-nums; }
  .card__sale {
    background: var(--accent);
    color: var(--on-accent);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 3px 7px;
    border-radius: 4px;
  }
  .card__link {
    margin-top: auto;
    color: var(--accent-ink);
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .card__link:hover { text-decoration: underline; text-underline-offset: 3px; }
  .card__link:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 3px; border-radius: 4px; }

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
  .total-row b { color: var(--text); font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* Alternates */
  .alts { display: grid; gap: 12px; }
  .alt {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    text-align: left;
    width: 100%;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: border-color var(--step) var(--ease);
  }
  .alt:hover { border-color: var(--muted); }
  .alt:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 3px; }
  .alt__main { flex: 1 1 220px; min-width: 0; }
  .alt__name { font-weight: 650; font-size: 17px; }
  .alt__tagline { color: var(--muted); font-size: 13.5px; margin-top: 3px; }
  .alt__meta {
    display: flex;
    align-items: baseline;
    gap: 16px;
    font-size: 14px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .alt__price { color: var(--text); font-weight: 650; font-size: 17px; }
  .alt__cta { color: var(--accent-ink); font-weight: 600; font-size: 14px; white-space: nowrap; }

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
    border-radius: var(--radius-lg);
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
