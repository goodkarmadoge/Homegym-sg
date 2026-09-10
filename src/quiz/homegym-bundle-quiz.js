/**
 * <homegym-bundle-quiz>, Homegym.sg personalised bundle quiz.
 *
 * A framework-agnostic custom element. Four questions, one matched bundle.
 * Everything renders inside an open shadow root, so it drops into any page
 * (Bootstrap, Tailwind, raw Magento) with no style bleed in either direction.
 *
 *   <homegym-bundle-quiz
 *     theme="light"                    light (default, homegym.sg's own) | dark
 *     accent="#ec3013"                 any CSS colour; hex gets a contrast fix
 *     currency="SGD"
 *     cart-endpoint="/checkout/cart/add"
 *     contact-url="/contact"
 *     whatsapp="6580423952"            E.164 digits, no + and no spaces
 *     start-step="1"                   deep-link straight to a step
 *   ></homegym-bundle-quiz>
 *
 * The component NEVER navigates the host page. Product links open in a new tab,
 * the cart CTA POSTs to cart-endpoint when one is configured, and every
 * meaningful action also fires a bubbling, composed CustomEvent for GTM.
 */
import { BUNDLES, PRODUCTS, ROOMS, FUNCTION_OPTIONS, PERSONA_OPTIONS, FUNCTION_SHORT, composeBundles } from './bundles.js';
import { buildSheetBundles } from './sheet-parse.js';
import { SHEET_ID, SHEET_TABS } from './sheet-data.js';
import { match, FALLBACK } from './matcher.js';
import { STYLES } from './styles.js';

const STORAGE_KEY = 'homegym-bundle-quiz-v1';
const TOTAL_STEPS = 4;

/* The budget slider's ends. The top of the range is a floor, not a ceiling:
   it renders as "S$7,500+", so anyone with more to spend still lands on the
   most capable bundle rather than being told their number is out of range. */
const BUDGET_MIN = 2500;
const BUDGET_MAX = 7500;

/**
 * The reference kit drawn inside the floor plan, in metres.
 *
 * HomeGym does not publish per-machine dimensions, so these are TYPICAL sizes
 * for the category, not measurements of any specific product they sell. The
 * panel says so in as many words, because a customer who buys on a footprint
 * that turns out to be wrong is a returned 300kg machine. Replace these with
 * real figures per machine the moment they exist.
 */
const KIT = {
  rack:  { w: 1.2,  d: 1.4,  label: 'Power rack' },
  bench: { w: 0.6,  d: 1.3,  label: 'Bench' },
  bar:   { w: 2.2,           label: 'Olympic bar' },
  clearance: 0.5   // pull-out space in front of the rack, per the helper copy
};

/* Floor sliders. 0.1 m steps let the plan drawing actually track the room;
   0.5 m made it jump a whole half-metre at a time. */
const DIM_MIN = 1;
const DIM_MAX = 3;
const DIM_STEP = 0.1;

const DEFAULT_ANSWERS = {
  functions: [],
  length: 2.5,
  depth: 3.0,
  persona: null,
  budget: 5000
};

/* ── Small helpers ───────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const CHECK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const WA_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.15.16-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>';

/* Persona name to the quote the customer actually picked, so the result can
   echo their own words back rather than label them a "Convenience Seeker". */
const PERSONA_QUOTE = Object.fromEntries(
  PERSONA_OPTIONS.map((o) => [o.value, o.label])
);

const ARROW = '<span aria-hidden="true">&#8594;</span>';
const BACK_ARROW = '<span aria-hidden="true">&#8592;</span>';

/* ── Colour: keep a client-supplied accent readable ──────────────────────── */

function parseHex(input) {
  if (typeof input !== 'string') return null;
  let h = input.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function relLuminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * Nudge `accent` toward white (on a dark ground) or black (on a light one)
 * until it clears 4.5:1 for text. The button keeps the pure accent as its
 * background, only accent-coloured TEXT gets adjusted. Returns the original
 * string untouched for non-hex values, which we cannot measure.
 */
function readableAccent(accent, backgroundHex) {
  const rgb = parseHex(accent);
  const bg = parseHex(backgroundHex);
  if (!rgb || !bg) return accent;
  if (contrastRatio(rgb, bg) >= 4.5) return accent;

  const target = relLuminance(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.05; t <= 1; t += 0.05) {
    const candidate = mix(rgb, target, t);
    if (contrastRatio(candidate, bg) >= 4.5) return toHex(candidate);
  }
  return toHex(target);
}

/**
 * Black or white, whichever is more readable on the accent itself.
 * homegym.sg puts black text on its orange CTA, and #FF6924 scores 7.30:1 that
 * way against 2.97:1 for white, so the default lands on their choice anyway.
 */
function inkOn(accent) {
  const rgb = parseHex(accent);
  if (!rgb) return '#000000';
  return contrastRatio(rgb, [0, 0, 0]) >= contrastRatio(rgb, [255, 255, 255]) ? '#000000' : '#FFFFFF';
}

/* ── Element ─────────────────────────────────────────────────────────────── */

class HomegymBundleQuiz extends HTMLElement {
  static get observedAttributes() {
    return ['theme', 'accent', 'currency', 'cart-endpoint', 'contact-url', 'whatsapp', 'start-step',
            'sheet-live', 'sheet-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // The stylesheet is parsed once and never touched again; only _root's
    // contents change between views. Re-setting shadowRoot.innerHTML on every
    // render would re-parse the whole sheet on each keystroke of the sliders.
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = STYLES;
    this._root = document.createElement('div');
    this.shadowRoot.append(this._styleEl, this._root);

    this.state = {
      step: 1,
      answers: { ...DEFAULT_ANSWERS, functions: [] },
      view: 'quiz',        // quiz | matching | result
      result: null,
      shownBundleId: null, // which bundle the result view is currently showing
      completedBefore: false,
      error: ''
    };

    this._started = false;
    this._onClick = this._onClick.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onInput = this._onInput.bind(this);
  }

  /* ── Attribute accessors ─────────────────────────────────────────────── */

  /* Light is the default: this quiz is meant to read as a page of homegym.sg,
     which is white-ground. theme="dark" is for placements on a dark host. */
  get theme() { return this.getAttribute('theme') === 'dark' ? 'dark' : 'light'; }
  get accent() { return this.getAttribute('accent') || '#ec3013'; }
  get currency() { return this.getAttribute('currency') || 'SGD'; }
  get cartEndpoint() { return this.getAttribute('cart-endpoint') || ''; }
  get contactUrl() { return this.getAttribute('contact-url') || '/contact'; }
  get whatsapp() { return (this.getAttribute('whatsapp') || '').replace(/[^\d]/g, ''); }

  /* Live data. With sheet-live present the quiz re-reads the Google Sheet on
     mount, so a bundle added to the spreadsheet appears without a redeploy.
     Without it the quiz uses the committed snapshot, which is the data that
     every test and the 64,575-combination sweep actually checked. */
  get sheetLive() { return this.hasAttribute('sheet-live'); }
  get sheetId() { return this.getAttribute('sheet-id') || SHEET_ID; }

  /** Format a number as SGD. Falls back to Intl for any other currency code. */
  money(n) {
    const value = Math.round(Number(n) || 0);
    if (this.currency.toUpperCase() === 'SGD') {
      return 'S$' + value.toLocaleString('en-SG');
    }
    try {
      return new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: this.currency,
        maximumFractionDigits: 0
      }).format(value);
    } catch {
      return `${this.currency} ${value.toLocaleString('en-SG')}`;
    }
  }

  get reducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  /* ── Lifecycle ───────────────────────────────────────────────────────── */

  connectedCallback() {
    this._restore();

    const start = parseInt(this.getAttribute('start-step'), 10);
    if (start >= 1 && start <= TOTAL_STEPS) this.state.step = start;

    this.shadowRoot.addEventListener('click', this._onClick);
    this.shadowRoot.addEventListener('change', this._onChange);
    this.shadowRoot.addEventListener('input', this._onInput);

    this.render();

    if (!this._started) {
      this._started = true;
      this.emit('quiz:start', {});
    }

    // After the first paint, never before it: the committed data is already
    // correct, so there is no reason to make anyone wait on a round trip to
    // Google before they can answer question one.
    if (this.sheetLive) this._refreshFromSheet();
  }

  /**
   * Re-read the Google Sheet and swap in whatever it says.
   *
   * FAILS SILENTLY BY DESIGN. Every outcome short of a clean parse leaves the
   * committed data in place: a private sheet, an offline customer, a blocked
   * request, a half-edited row. What a customer sees is never worse than the
   * snapshot that shipped, which is what makes it safe to turn this on.
   * Problems surface on the quiz:sheet event and in the console, for whoever
   * is watching, rather than as an error on a customer screen.
   */
  async _refreshFromSheet() {
    const id = this.sheetId;
    const gids = SHEET_TABS || {};
    if (!id || gids.rules == null || gids.products == null) {
      this._sheetProblem('sheet-live is set but config/sheet.json has no tab gids');
      return;
    }

    // /export, never /gviz/tq. The gviz endpoint infers a header row and
    // silently drops columns whose only value falls in it, which cost two
    // bundles all of their products with no error of any kind. See the note in
    // scripts/sync-sheet.mjs.
    const url = (gid) =>
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

    try {
      const [rules, products] = await Promise.all(
        [gids.rules, gids.products].map(async (gid) => {
          const res = await fetch(url(gid), { credentials: 'omit' });
          if (!res.ok) throw new Error(`HTTP ${res.status} reading tab ${gid}`);
          const text = await res.text();
          // An unshared sheet answers with a sign-in page, not an error status.
          if (/^\s*<!DOCTYPE/i.test(text)) throw new Error('the sheet is not shared publicly');
          return text;
        })
      );

      // Lenient: one unresolvable product URL drops that single bundle rather
      // than throwing away every bundle in the sheet.
      const { bundles, problems } = composeBundles(buildSheetBundles(rules, products), { strict: false });
      if (!bundles.length) throw new Error('the sheet produced no usable bundles');

      // Replace the CONTENTS of the shared array. Reassigning the import would
      // leave every other module still pointing at the old list.
      BUNDLES.length = 0;
      BUNDLES.push(...bundles);

      // A result on screen was matched against the old data, so score it
      // again. Deliberately not _submit(): that would re-emit quiz:complete
      // and replay the building animation over a result already being read.
      if (this.state.view === 'result' && this.state.result) {
        const res = match(this._answersOut(), BUNDLES);
        this.state.result = res;
        this.state.shownBundleId = res.primary ? res.primary.id : null;
      }
      this.render();

      for (const p of problems) console.warn('[homegym-bundle-quiz] ' + p);
      this.emit('quiz:sheet', { ok: true, bundles: bundles.length, problems });
    } catch (err) {
      this._sheetProblem(err.message);
    }
  }

  _sheetProblem(message) {
    console.warn('[homegym-bundle-quiz] live sheet not used, keeping the built-in data: ' + message);
    this.emit('quiz:sheet', { ok: false, bundles: BUNDLES.length, problems: [message] });
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this._onClick);
    this.shadowRoot.removeEventListener('change', this._onChange);
    this.shadowRoot.removeEventListener('input', this._onInput);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /* ── Session persistence (best effort, never fatal) ───────────────────── */

  _save() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step: this.state.step, answers: this.state.answers })
      );
    } catch {
      /* Private mode, storage disabled, quota, all fine, the quiz works without it. */
    }
  }

  _restore() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.answers) {
        this.state.answers = { ...DEFAULT_ANSWERS, ...saved.answers };
        if (!Array.isArray(this.state.answers.functions)) this.state.answers.functions = [];
        const step = parseInt(saved.step, 10);
        if (step >= 1 && step <= TOTAL_STEPS) this.state.step = step;
      }
    } catch {
      /* Corrupt payload, start clean rather than crash. */
    }
  }

  _clearStorage() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  }

  /* ── Rendering ───────────────────────────────────────────────────────── */

  render() {
    // Only override the design system's accent when a host has actually asked
    // for one. Left alone, the Modernist ramp in the stylesheet applies, with
    // its own hand-picked steps for text and for fills that carry white text.
    // Inline custom properties beat :host, and `all: initial` does not reset
    // custom properties, so this is the cheapest way to theme.
    if (this.hasAttribute('accent')) {
      const bg = this.theme === 'dark' ? '#161514' : '#FFFFFF';
      const ink = readableAccent(this.accent, bg);
      this.style.setProperty('--accent', this.accent);
      this.style.setProperty('--accent-600', this.accent);
      this.style.setProperty('--accent-700', ink);
      this.style.setProperty('--accent-ink', ink);
      this.style.setProperty('--on-accent', inkOn(this.accent));
    } else {
      ['--accent', '--accent-600', '--accent-700', '--accent-ink', '--on-accent']
        .forEach((prop) => this.style.removeProperty(prop));
    }

    let body;
    if (this.state.view === 'matching') body = this.viewMatching();
    else if (this.state.view === 'result') body = this.viewResult();
    else body = this.viewStep();

    this._root.innerHTML = body;
    this._afterRender();
  }

  _afterRender() {
    // Product images: swap in an initial-letter tile if the CloudFront path 404s.
    this.shadowRoot.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const holder = img.closest('.card__media, .install, .room__media, .alt__media') || img.parentElement;
        const tile = holder?.querySelector('.card__fallback');
        if (tile) {
          tile.hidden = false;
          img.style.display = 'none';
        }
      }, { once: true });
    });

    // Move focus to the new view's heading so screen readers and keyboard users
    // land in the right place after a step change, without stealing focus on
    // the very first paint.
    if (this._shouldFocus) {
      this._shouldFocus = false;
      const heading = this.shadowRoot.querySelector('[data-focus]');
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  /* ── Step views ──────────────────────────────────────────────────────── */

  progress() {
    const pct = (this.state.step / TOTAL_STEPS) * 100;
    return `
      <div class="progress">
        <div class="progress__meta">
          <span class="progress__step">Step ${this.state.step} of ${TOTAL_STEPS}</span>
          <span class="progress__name">${['Function', 'Space', 'You', 'Budget'][this.state.step - 1]}</span>
        </div>
        <div class="progress__track" role="progressbar"
             aria-valuenow="${this.state.step}" aria-valuemin="1" aria-valuemax="${TOTAL_STEPS}"
             aria-label="Quiz progress">
          <div class="progress__fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  viewStep() {
    const step = this.state.step;
    const inner =
      step === 1 ? this.step1() :
      step === 2 ? this.step2() :
      step === 3 ? this.step3() :
                   this.step4();

    const canGoBack = step > 1;
    const isLast = step === TOTAL_STEPS;
    // Once a bundle has been built, every step can jump straight back to it.
    // Otherwise correcting one answer means clicking Continue through the rest.
    const hasResult = Boolean(this.state.result);

    // Continue is disabled until the step is answered, per the handoff. The
    // hint line still says why, so a keyboard user who lands on a dead button
    // is told what is missing rather than left guessing.
    const blocked = this._blockedReason();

    return `
      <div class="quiz">
        ${this.progress()}
        <div class="view">
          <div aria-live="polite" class="visually-hidden">Step ${step} of ${TOTAL_STEPS}</div>
          ${inner}
          <div class="actions">
            <button class="btn btn--primary" data-action="next" type="button"
                    ${blocked ? 'disabled aria-disabled="true"' : ''}>
              ${isLast ? 'Build my bundle' : 'Continue'} ${ARROW}
            </button>
            <span class="validation" role="status">${esc(blocked)}</span>
            ${canGoBack ? `<button class="btn btn--text" data-action="back" type="button">${BACK_ARROW} Back</button>` : ''}
            ${hasResult && !isLast ? `<button class="btn btn--text" data-action="forward" type="button">Forward to my bundle ${ARROW}</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  /** "2 of 6 selected", so the multi-select nature is visible not just implied. */
  _countLabel() {
    const n = this.state.answers.functions.length;
    const total = FUNCTION_OPTIONS.length;
    return n === 0 ? `None chosen yet, pick as many as you like` : `${n} of ${total} selected`;
  }

  /** Why Continue is unavailable on this step, or '' when it is available. */
  _blockedReason() {
    if (this.state.step === 1 && this.state.answers.functions.length === 0) {
      return 'Pick at least one thing you want to train.';
    }
    if (this.state.step === 3 && !this.state.answers.persona) {
      return 'Pick the option that describes you best.';
    }
    return '';
  }

  step1() {
    const chosen = new Set(this.state.answers.functions);
    return `
      <h1 class="headline" tabindex="-1" data-focus>What do you actually want to train?</h1>
      <p class="subhead">Pick everything that matters to you. We'll match the machine that does it all.</p>
      <div class="multi">
        <span class="multi__badge">Select all that apply</span>
        <span class="multi__count" data-fn-count aria-live="polite">${this._countLabel()}</span>
      </div>
      <fieldset class="options">
        <legend class="visually-hidden">Training functions, choose at least one</legend>
        ${FUNCTION_OPTIONS.map((o) => `
          <label class="option option--check${chosen.has(o.tag) ? ' is-selected' : ''}">
            <input type="checkbox" name="function" value="${esc(o.tag)}" ${chosen.has(o.tag) ? 'checked' : ''}>
            <span class="option__mark">${CHECK_SVG}</span>
            <span class="option__body">
              <span class="option__label">${esc(o.label)}</span>
              <span class="option__help">${esc(o.help)}</span>
            </span>
          </label>`).join('')}
      </fieldset>`;
  }

  step2() {
    const { length, depth } = this.state.answers;
    const dim = (id, label, value) => `
      <div class="dim">
        <div class="dim__head">
          <label class="dim__label" for="${id}-range">${label}</label>
          <span class="dim__value" data-dim-value="${id}">${value.toFixed(1)} m</span>
        </div>
        <input type="range" id="${id}-range" name="${id}"
               min="${DIM_MIN}" max="${DIM_MAX}" step="${DIM_STEP}" value="${value}"
               aria-label="${label} in metres" aria-valuetext="${value.toFixed(1)} metres">
      </div>`;

    // The handoff runs the plan down the left and the sliders down the right.
    // Source order is controls-then-plan so that when the two columns wrap on a
    // phone the sliders come first, which is what was asked for. The plan holds
    // nothing focusable, so nothing can read out of order.
    return `
      <h1 class="headline" tabindex="-1" data-focus>How much floor can you give it?</h1>
      <p class="subhead">Drag the room to the size you actually have. We check every bundle against it.</p>
      <div class="space">
        <div class="space__controls">
          ${dim('length', 'Length (m)', length)}
          ${dim('depth', 'Depth (m)', depth)}
          <div class="hr"></div>
          <p class="note">Leave at least 0.5 m of clearance in front of any rack to pull the bar out. Every footprint we quote already includes it.</p>
        </div>
        <div class="space__plan">${this.roomPanel(length, depth)}</div>
      </div>`;
  }

  /** The plan panel: reference label, live area readout, drawing, legend, caption. */
  roomPanel(length, depth) {
    const fit = this.kitFit(length, depth);
    const legend = [
      ['rack', `${KIT.rack.label} ${KIT.rack.w} &times; ${KIT.rack.d} m`, fit.rack],
      ['bar', `${KIT.bar.label} ${KIT.bar.w} m`, fit.bar],
      ['bench', `${KIT.bench.label} ${KIT.bench.w} &times; ${KIT.bench.d} m`, fit.bench],
      ['clear', `Pull-out space ${KIT.clearance} m`, fit.clearance]
    ];

    return `
      <div class="room">
        <div class="room__head">
          <span class="room__ref">3 &times; 3 m reference</span>
          <span class="room__area" data-room-area>${(length * depth).toFixed(2)} m&sup2;</span>
        </div>
        ${this.roomSvg(length, depth)}
        <ul class="legend">
          ${legend.map(([k, text, ok]) => `
            <li class="legend__item${ok ? '' : ' is-tight'}">
              <span class="legend__key legend__key--${k}"></span>
              <span>${text}${ok ? '' : ' <b>does not fit</b>'}</span>
            </li>`).join('')}
        </ul>
        <p class="room__caption">
          Indicative only. These are typical sizes for each category, not the
          dimensions of a specific machine. We confirm exact measurements before
          anything is ordered.
        </p>
      </div>`;
  }

  /** Which pieces of the reference kit fit the stated floor. */
  kitFit(length, depth) {
    return {
      rack: length >= KIT.rack.w && depth >= KIT.rack.d,
      bar: length >= KIT.bar.w,
      bench: depth >= KIT.bench.d,
      clearance: depth >= KIT.rack.d + KIT.clearance
    };
  }

  /**
   * Plan view of the room, to scale inside a 3x3 m reference square.
   * 100 SVG units = 1 metre. The human plan-symbol is a real 0.5 m across the
   * shoulders, which is what makes the rectangle mean anything.
   */
  roomSvg(length, depth) {
    const U = 100;          // 100 units = 1 metre
    const O = 20;           // origin, top-left of the reference square
    const SIZE = 3 * U;
    const w = length * U;
    const h = depth * U;

    // 0.5 m grid across the whole reference square, not just the selected room,
    // so the room reads as a rectangle laid onto a fixed scale.
    const grid = [];
    for (let m = 0.5; m < 3; m += 0.5) {
      const p = O + m * U;
      grid.push(`<line x1="${p}" y1="${O}" x2="${p}" y2="${O + SIZE}" stroke="var(--n300)" stroke-width="1"/>`);
      grid.push(`<line x1="${O}" y1="${p}" x2="${O + SIZE}" y2="${p}" stroke="var(--n300)" stroke-width="1"/>`);
    }

    // ── The reference kit, laid out the way a real room gets used ───────────
    // Rack against the back wall, bar racked across it, bench inside it, and
    // the pull-out clearance in front. The group is centred on the room so the
    // bar has somewhere to go; when the room is too narrow the bar visibly
    // overhangs the wall, which is the honest way to show it does not fit.
    const m = (v) => v * U;
    const groupW = Math.max(KIT.bar.w, KIT.rack.w);
    const gx = O + Math.max(0, (length - groupW) / 2) * U;   // group left edge
    const rackX = gx + m((groupW - KIT.rack.w) / 2);
    const rackY = O + m(0.05);
    const barY = rackY + m(0.4);
    const benchX = rackX + m((KIT.rack.w - KIT.bench.w) / 2);
    const benchY = rackY + m(0.05);
    const clearY = rackY + m(KIT.rack.d);

    const fit = this.kitFit(length, depth);
    // Anything that does not fit is drawn dashed and faded rather than hidden:
    // seeing the bar hang past the wall is the point.
    const ghost = (ok) => (ok ? '' : ' stroke-dasharray="6 5" opacity="0.45"');

    const kit = `
      <rect x="${rackX}" y="${clearY}" width="${m(KIT.rack.w)}" height="${m(KIT.clearance)}"
            fill="none" stroke="var(--n500)" stroke-width="1.5" stroke-dasharray="4 4"${fit.clearance ? '' : ' opacity="0.45"'}/>
      <rect x="${rackX}" y="${rackY}" width="${m(KIT.rack.w)}" height="${m(KIT.rack.d)}"
            fill="#FFFFFF" fill-opacity="0.9" stroke="var(--text)" stroke-width="3"${ghost(fit.rack)}/>
      <rect x="${benchX}" y="${benchY}" width="${m(KIT.bench.w)}" height="${m(KIT.bench.d)}"
            fill="var(--n400)" stroke="var(--n800)" stroke-width="1.5"${ghost(fit.bench)}/>
      <line x1="${gx}" y1="${barY}" x2="${gx + m(KIT.bar.w)}" y2="${barY}"
            stroke="var(--n800)" stroke-width="5" stroke-linecap="round"${ghost(fit.bar)}/>`;

    // The human sits in the clearance zone, which is where a person stands.
    const hx = rackX + m(KIT.rack.w / 2);
    const hy = Math.min(O + h - m(0.25), clearY + m(KIT.clearance / 2));

    return `
      <svg viewBox="0 0 340 340" role="img"
           aria-label="Floor plan: ${length.toFixed(1)} metres by ${depth.toFixed(1)} metres, ${(length * depth).toFixed(2)} square metres, with a typical rack, bar and bench drawn to scale">
        ${grid.join('')}
        <rect x="${O}" y="${O}" width="${SIZE}" height="${SIZE}"
              fill="none" stroke="var(--n400)" stroke-width="2" stroke-dasharray="7 6"/>
        <rect x="${O}" y="${O}" width="${w}" height="${h}"
              fill="var(--accent-100)" stroke="var(--accent)" stroke-width="4"/>
        ${kit}
        <ellipse cx="${hx}" cy="${hy}" rx="26" ry="13" fill="var(--n500)"/>
        <circle cx="${hx}" cy="${hy}" r="9" fill="var(--n800)"/>
        <text x="${O + w / 2}" y="14" fill="var(--accent-700)" font-size="17" font-weight="800"
              text-anchor="middle" font-family="inherit">${length.toFixed(1)} m</text>
        <text x="${O + w + 20}" y="${O + h / 2}" fill="var(--accent-700)" font-size="17" font-weight="800"
              text-anchor="middle" font-family="inherit"
              transform="rotate(90 ${O + w + 20} ${O + h / 2})">${depth.toFixed(1)} m</text>
      </svg>`;
  }

  /**
   * Question three: which customer is this?
   *
   * This used to ask for a training level. The sheet now matches bundles on
   * persona instead, so the question asks the thing the matcher actually uses.
   * The options come straight from the personas tab, which is why the labels
   * below are quotes: it is how the client wrote them, and a quote is how
   * someone recognises themselves. The segment NAME ("Convenience Seeker") is
   * deliberately never shown, because it is an internal label and reads as a
   * judgement when pointed at the person reading it.
   */
  step3() {
    const current = this.state.answers.persona;
    return `
      <h1 class="headline" tabindex="-1" data-focus>Which of these sounds most like you?</h1>
      <p class="subhead">This is about what you want out of it, not how hard you train.</p>
      <fieldset class="options options--single">
        <legend class="visually-hidden">What you want from your gym</legend>
        ${PERSONA_OPTIONS.map((o) => `
          <label class="option option--radio${current === o.value ? ' is-selected' : ''}">
            <input type="radio" name="persona" value="${esc(o.value)}" ${current === o.value ? 'checked' : ''}>
            <span class="option__mark">${CHECK_SVG}</span>
            <span class="option__body">
              <span class="option__label">${esc(o.label)}</span>
              <span class="option__help">${esc(o.help)}</span>
            </span>
          </label>`).join('')}
      </fieldset>`;
  }

  /** The top of the range reads as a floor, so "S$7,500" renders "S$7,500+". */
  budgetLabel(v) {
    return this.money(v) + (v >= BUDGET_MAX ? '+' : '');
  }

  step4() {
    const b = this.state.answers.budget;
    return `
      <h1 class="headline" tabindex="-1" data-focus>What's your budget?</h1>
      <p class="subhead">All prices in SGD. Delivery and installation quoted separately.</p>
      <div class="budget">
      <div class="budget__value" data-budget-value aria-live="polite">${this.budgetLabel(b)}</div>
      <input type="range" name="budget" min="${BUDGET_MIN}" max="${BUDGET_MAX}" step="250" value="${b}"
             aria-label="Budget in Singapore dollars"
             aria-valuetext="${this.budgetLabel(b)}">
      <div class="ends">
        <span>${this.money(BUDGET_MIN)}</span>
        <span>${this.money(BUDGET_MAX)} +</span>
      </div>
      <div class="hr"></div>
      <p class="note">Every bundle we show is priced at current sale prices and comes in under your number. Delivery and installation are quoted separately.</p>
      </div>`;
  }

  viewMatching() {
    return `
      <div class="quiz">
        <div class="view matching">
          <div class="matching__spinner" aria-hidden="true"></div>
          <p class="headline" tabindex="-1" data-focus role="status">Building your personalized home gym&hellip;</p>
        </div>
      </div>`;
  }

  /* ── Result view ─────────────────────────────────────────────────────── */

  viewResult() {
    const res = this.state.result;
    if (!res || !res.primary) return this.viewTalk();

    const bundle = BUNDLES.find((b) => b.id === this.state.shownBundleId) || res.primary;
    const a = this.state.answers;
    const matched = a.functions.filter((f) => bundle.functions.includes(f));

    // No "S$X under budget" chip. Coming in under budget is a guarantee of the
    // matcher, not a feature of this bundle. When one genuinely is over, the
    // fallback banner says so instead.
    const chips = [
      `Fits ${bundle.footprint.length.toFixed(1)} &times; ${bundle.footprint.depth.toFixed(1)} m`,
      matched.length
        ? `${matched.map((f) => FUNCTION_SHORT[f] || f).join(' + ')} work`
        : `${bundle.functions.map((f) => FUNCTION_SHORT[f] || f).join(' + ')} work`,
      // The persona is only a REASON when the bundle is actually built for the
      // one they picked. Otherwise fall back to something true about the kit,
      // rather than telling someone they are a customer type they did not choose.
      (bundle.personas || []).some((p) => p === a.persona)
        ? `Built for "${PERSONA_QUOTE[a.persona] || a.persona}"`
        : `${bundle.trains.length} movements covered`
    ];

    const alternates = res.alternates.filter((alt) => alt.id !== bundle.id).slice(0, 2);

    return `
      <div class="quiz quiz--result">
        <div class="view">
        ${this.banner(res)}
        <p class="eyebrow">Your match</p>
        <h1 class="result__name" tabindex="-1" data-focus>${esc(bundle.name)}</h1>
        <p class="result__tagline">${esc(bundle.tagline)}</p>

        <div class="chips">
          ${chips.map((c) => `<span class="chip">${CHECK_SVG}${c}</span>`).join('')}
        </div>

        <div class="hr"></div>
        <div class="pricerow">
          <span class="pricerow__total">${this.money(bundle.price)}</span>
          <span class="pricerow__meta">${bundle.products.length} items</span>
        </div>
        <div class="hr"></div>

        <p class="pitch">${esc(bundle.pitch)}</p>

        ${this.sectionProducts(bundle)}
        ${this.sectionTrain(bundle)}
        ${this.sectionSpecialist(bundle)}
        ${this.sectionAlternates(alternates)}
        ${this.sectionRooms()}
        ${this.sectionAdvice()}

        <div class="hr"></div>
        <div class="retake">
          <button class="btn btn--text" data-action="back-to-steps" type="button">${BACK_ARROW} Back to my budget</button>
          <button class="btn btn--text" data-action="adjust" type="button">Adjust my answers</button>
          <button class="btn btn--text" data-action="restart" type="button">Start again</button>
        </div>
        <p class="summary">${a.length.toFixed(1)} &times; ${a.depth.toFixed(1)} m &middot; ${esc(a.persona || 'any profile')} &middot; ${this.budgetLabel(a.budget)} budget</p>
        </div>
      </div>`;
  }

  /* ── 1. What is in the bundle, and what it looks like built ───────────── */

  sectionProducts(bundle) {
    return `
      <section class="section">
        <h2 class="section__title">What's in the bundle</h2>
        <div class="bundle-split">
          <div class="grid">${bundle.products.map((id) => this.productCard(id, bundle)).join('')}</div>
          ${this.installShot(bundle)}
        </div>
        <div class="total-row"><span>Bundle total</span><b>${this.money(bundle.price)}</b></div>
        <p class="fineprint">
          Prices are current sale prices as at 30 August 2026 and exclude delivery and
          installation, which are quoted separately. These units run from 90&nbsp;kg to
          over 300&nbsp;kg.
        </p>
      </section>`;
  }

  /* ── 2. What you will train ───────────────────────────────────────────── */

  sectionTrain(bundle) {
    // A bundle added to the sheet before anyone writes its copy has no
    // movement list. Drop the section rather than print an empty heading.
    if (!bundle.trains || !bundle.trains.length) return '';
    return `
      <section class="section">
        <h2 class="section__title">What you'll train</h2>
        <div class="pills">${bundle.trains.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
      </section>`;
  }

  /* ── The setup shot that sits inside section 1 ────────────────────────── */

  /**
   * The setup photograph, sitting beside the product cards.
   *
   * This used to be a section of its own further down the page. It lives here
   * now for two reasons: the space to the right of the cards was empty on a
   * wide screen, and a photograph of the built room is most useful at the exact
   * moment someone is reading what is in the box, not a scroll later.
   *
   * The caption still tells the truth about where the picture came from. Seven
   * bundles carry a real customer install from the Instagram feed; three carry
   * a studio shot from the product gallery, because their feed is the generic
   * cardio one. Captioning a white-background cut-out as a real install would
   * be a small lie, so it is not captioned as one.
   */
  installShot(bundle) {
    if (!bundle.hero) return '';
    const fromInstagram = bundle.heroSource === 'instagram';
    const alt = fromInstagram
      ? `${bundle.name} installed in a customer's home`
      : `${bundle.name}`;
    return `
      <figure class="install">
        <img src="${esc(bundle.hero)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-fallback>
        <div class="card__fallback" hidden aria-hidden="true">Photo to follow</div>
        <figcaption>${fromInstagram ? 'A real install, from our Instagram' : 'The anchor machine in this build'}</figcaption>
      </figure>`;
  }

  /* ── 3. Send this to a specialist ─────────────────────────────────────── */

  sectionSpecialist(bundle) {
    return `
      <section class="section">
        <h2 class="section__title">Send this to a specialist</h2>
        <p class="pitch">
          We will come back with availability, delivery and installation for this exact
          build, and answer anything the quiz could not.
        </p>
        <div class="actions actions--result">
          ${this.whatsapp
            ? `<button class="btn btn--wa" data-action="whatsapp" type="button">${WA_SVG} Send this to a specialist ${ARROW}</button>`
            : `<a class="btn btn--primary" href="${esc(this.contactUrl)}" target="_blank" rel="noopener"
                  data-action="cta-contact">Enquire about this bundle ${ARROW}</a>`}
          <button class="btn btn--outline" data-action="showroom" type="button">Book a showroom visit ${ARROW}</button>
          ${this.cartEndpoint ? `<button class="btn btn--primary" data-action="cta" type="button">Add all to cart ${ARROW}</button>` : ''}
        </div>
        <p class="note cta-note">
          Send it over and we will book you a time to come down to the showroom and put
          your hands on everything in this bundle.
        </p>
      </section>`;
  }

  /* ── 4. Other bundles ─────────────────────────────────────────────────── */

  sectionAlternates(alternates) {
    if (!alternates.length) return '';
    return `
      <section class="section">
        <h2 class="section__title">Other bundles</h2>
        <div class="alts">
          ${alternates.map((alt) => `
            <button class="alt" type="button" data-action="alternate" data-bundle="${alt.id}">
              ${alt.hero ? `
                <span class="alt__media">
                  <img src="${esc(alt.hero)}" alt="" loading="lazy" decoding="async" data-fallback>
                  <span class="card__fallback" hidden aria-hidden="true">Photo to follow</span>
                </span>` : ''}
              <span class="alt__main">
                <span class="alt__name">${esc(alt.name)}</span>
                <span class="alt__tagline">${esc(alt.tagline)}</span>
              </span>
              <span class="alt__meta">
                <span>${alt.footprint.length.toFixed(1)} &times; ${alt.footprint.depth.toFixed(1)} m</span>
                <span class="alt__price">${this.money(alt.price)}</span>
              </span>
              <span class="alt__cta">See this bundle ${ARROW}</span>
            </button>`).join('')}
        </div>
      </section>`;
  }

  /* ── 5. Rooms we have built ───────────────────────────────────────────── */

  sectionRooms() {
    if (!ROOMS || !ROOMS.length) return '';
    return `
      <section class="section">
        <h2 class="section__title">Rooms we've built</h2>
        <p class="pitch">
          Real installs from our Instagram, not showroom mock-ups. Every one links
          to the machine in the picture.
        </p>
        <div class="rooms">
          ${ROOMS.map((r) => `
            <a class="room" href="${esc(r.href)}" target="_blank" rel="noopener"
               data-action="cta-room" data-title="${esc(r.title)}">
              <span class="room__media">
                <img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy" decoding="async" data-fallback>
                <span class="card__fallback" hidden aria-hidden="true">Photo to follow</span>
              </span>
              <span class="room__body">
                <span class="room__title">${esc(r.title)}</span>
                <span class="room__meta">${esc(r.date)} &middot; ${r.linkKind === 'product' ? 'View product' : 'Browse range'}</span>
              </span>
            </a>`).join('')}
        </div>
      </section>`;
  }

  /* ── 6. No-obligation advice ──────────────────────────────────────────── */

  sectionAdvice() {
    return `
      <section class="section advice">
        <h2 class="section__title">Not sure yet?</h2>
        <p class="pitch">
          Tell us the room and what you want to train and we will tell you what we would
          put in it, whether or not you buy from us. No obligation, no sales pitch.
        </p>
        <div class="actions actions--result">
          ${this.whatsapp
            ? `<button class="btn btn--wa" data-action="advice" type="button">${WA_SVG} Ask us for advice ${ARROW}</button>`
            : `<a class="btn btn--outline" href="${esc(this.contactUrl)}" target="_blank" rel="noopener"
                  data-action="cta-contact">Ask us for advice ${ARROW}</a>`}
        </div>
      </section>`;
  }

  /** Honest banner for each rung of the fallback ladder. */
  banner(res) {
    if (!res.fallback) return '';
    const over = res.debug?.overBudgetBy || 0;
    const text =
      res.fallback === FALLBACK.BUDGET
        ? `Nothing fits both your space and your exact budget. This one is ${this.money(over)} over. It's the closest match we have.`
      : res.fallback === FALLBACK.SPACE
        ? "This needs about 0.5 m more depth than you entered. Worth measuring again. It's the right machine for what you want to train."
      : res.fallback === FALLBACK.SMALLEST
        ? 'Tight space. Here&rsquo;s what genuinely fits.'
        : '';
    return text ? `<div class="banner" role="status"><span class="banner__label">Nearest match</span>${text}</div>` : '';
  }

  productCard(id, bundle) {
    const p = PRODUCTS[id];
    if (!p) return '';
    return `
      <article class="card">
        <div class="card__media">
          <span class="grayscale">
            <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" data-fallback>
          </span>
          <div class="card__fallback" hidden aria-hidden="true">Photo to follow</div>
          ${p.note ? `<span class="card__badge">${esc(p.note)}</span>` : ''}
        </div>
        <div class="card__body">
          <h3 class="card__name">${esc(p.name)}</h3>
          <div class="card__prices">
            <span class="card__price">${this.money(p.price)}</span>
            ${p.was ? `<span class="card__was">${this.money(p.was)}</span><span class="card__sale">SALE</span>` : ''}
          </div>
          <a class="card__link" href="${esc(p.url)}" target="_blank" rel="noopener"
             data-action="product" data-product="${esc(id)}" data-bundle="${bundle.id}">
            View product ${ARROW}
          </a>
        </div>
      </article>`;
  }

  /** Fallback tier 4, nothing fits. Never fabricate a bundle. */
  viewTalk() {
    const a = this.state.answers;
    return `
      <div class="quiz">
        <div class="view talk">
          <p class="eyebrow">No honest match</p>
          <h1 class="headline" tabindex="-1" data-focus>Let's talk</h1>
          <p class="subhead">
            At ${a.length.toFixed(1)} &times; ${a.depth.toFixed(1)} m there is nothing in the range we can
            recommend in good conscience. Rather than sell you something that will not fit, we would
            rather look at the room with you. Wall-mounted and folding options open up below this size.
          </p>
          <div class="actions">
            ${this.whatsapp
              ? `<button class="btn btn--wa" data-action="whatsapp" type="button">${WA_SVG} Message us on WhatsApp</button>`
              : `<a class="btn btn--primary" href="${esc(this.contactUrl)}" target="_blank" rel="noopener"
                    data-action="cta-contact">Talk to us ${ARROW}</a>`}
            <button class="btn btn--text" data-action="back-to-steps" type="button">${BACK_ARROW} Back</button>
            <button class="btn btn--text" data-action="restart" type="button">Start over</button>
          </div>
        </div>
      </div>`;
  }

  /* ── Interaction ─────────────────────────────────────────────────────── */

  _onChange(e) {
    const t = e.target;
    if (t.name === 'function') {
      const set = new Set(this.state.answers.functions);
      t.checked ? set.add(t.value) : set.delete(t.value);
      // Keep the authored order rather than click order, so the "why this one"
      // chip reads the same way every time.
      this.state.answers.functions = FUNCTION_OPTIONS.map((o) => o.tag).filter((tag) => set.has(tag));
      t.closest('.option')?.classList.toggle('is-selected', t.checked);
      if (this.state.answers.functions.length) this._refreshGate();
      this._save();
    }
    if (t.name === 'persona') {
      this.state.answers.persona = t.value;
      this.shadowRoot.querySelectorAll('.option--radio').forEach((el) => {
        el.classList.toggle('is-selected', el.contains(t));
      });
      this._refreshGate();
      this._save();
    }
  }

  _onInput(e) {
    const t = e.target;

    if (t.name === 'length' || t.name === 'depth') {
      let v = parseFloat(t.value);
      if (!Number.isFinite(v)) return;
      // Round to the slider's own step so 2.7000000000000002 never reaches the
      // drawing or the readout.
      v = Math.min(DIM_MAX, Math.max(DIM_MIN, Math.round(v * 10) / 10));
      this.state.answers[t.name] = v;

      // Patch in place. A full re-render here would drop slider focus mid-drag.
      const readout = this.shadowRoot.querySelector(`[data-dim-value="${t.name}"]`);
      if (readout) readout.textContent = `${v.toFixed(1)} m`;
      t.setAttribute('aria-valuetext', `${v.toFixed(1)} metres`);

      const plan = this.shadowRoot.querySelector('.space__plan');
      if (plan) {
        const { length, depth } = this.state.answers;
        plan.innerHTML = this.roomPanel(length, depth);
      }
      this._save();
    }

    if (t.name === 'budget') {
      const v = parseInt(t.value, 10);
      if (!Number.isFinite(v)) return;
      this.state.answers.budget = v;
      const display = this.shadowRoot.querySelector('[data-budget-value]');
      if (display) display.textContent = this.budgetLabel(v);
      t.setAttribute('aria-valuetext', this.budgetLabel(v));
      this._save();
    }
  }

  _onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      case 'next':      e.preventDefault(); this._next(); break;
      case 'back':      e.preventDefault(); this._back(); break;
      case 'forward':   e.preventDefault(); this._forward(); break;
      case 'back-to-steps': e.preventDefault(); this._backToSteps(); break;
      case 'restart':   e.preventDefault(); this._restart(); break;
      case 'adjust':    e.preventDefault(); this._adjust(); break;
      case 'alternate': e.preventDefault(); this._showAlternate(parseInt(el.dataset.bundle, 10)); break;
      case 'cta':       e.preventDefault(); this._cta(); break;
      case 'whatsapp':  e.preventDefault(); this._whatsapp('bundle'); break;
      case 'showroom':  e.preventDefault(); this._whatsapp('showroom'); break;
      case 'advice':    e.preventDefault(); this._whatsapp('advice'); break;
      case 'product':   this._productClick(el); break;   // let the link open naturally
      default: break;
    }
  }

  /** Keep the Continue button and its hint in step with the current answers. */
  _refreshGate() {
    const reason = this._blockedReason();
    const btn = this.shadowRoot.querySelector('[data-action="next"]');
    if (btn) {
      btn.disabled = Boolean(reason);
      if (reason) btn.setAttribute('aria-disabled', 'true');
      else btn.removeAttribute('aria-disabled');
    }
    const hint = this.shadowRoot.querySelector('.validation');
    if (hint) hint.textContent = reason;
    const count = this.shadowRoot.querySelector('[data-fn-count]');
    if (count) count.textContent = this._countLabel();
  }

  _next() {
    if (this.state.step === 1 && this.state.answers.functions.length === 0) {
      this.state.error = 'Pick at least one thing you want to train.';
      const box = this.shadowRoot.querySelector('.validation');
      if (box) box.textContent = this.state.error;
      return;
    }
    if (this.state.step === 3 && !this.state.answers.persona) {
      this.state.error = 'Pick the option that describes you best.';
      const box = this.shadowRoot.querySelector('.validation');
      if (box) box.textContent = this.state.error;
      return;
    }

    if (this.state.step === TOTAL_STEPS) return this._submit();

    this.state.step++;
    this.state.error = '';
    this._shouldFocus = true;
    this._save();
    this.emit('quiz:step', { step: this.state.step, answers: this._answersOut() });
    this.render();
  }

  _back() {
    if (this.state.step === 1) return;
    this.state.step--;
    this.state.error = '';
    this._shouldFocus = true;
    this._save();
    this.emit('quiz:step', { step: this.state.step, answers: this._answersOut() });
    this.render();
  }

  _submit() {
    const answers = this._answersOut();
    const result = match(answers, BUNDLES);

    const finish = () => {
      this.state.result = result;
      this.state.shownBundleId = result.primary ? result.primary.id : null;
      this.state.view = 'result';
      this.state.completedBefore = true;
      this._shouldFocus = true;
      this.render();
      this.emit('quiz:complete', {
        answers,
        bundleId: result.primary ? result.primary.id : null,
        bundleName: result.primary ? result.primary.name : null,
        price: result.primary ? result.primary.price : null,
        fallbackUsed: result.fallback
      });
    };

    if (this.reducedMotion) return finish();

    this.state.view = 'matching';
    this._shouldFocus = true;
    this.render();
    window.setTimeout(finish, 1200);
  }

  /**
   * Forward from a step straight to the finished bundle, skipping the steps in
   * between. Only offered once a bundle exists, so every answer it needs has
   * already been given and validated. Re-runs the match rather than restoring
   * the old result, since the whole point is that an answer just changed.
   */
  _forward() {
    if (!this.state.result) return;
    this._submit();
  }

  /** Back out of the result to the last question, answers intact. */
  _backToSteps() {
    this.state.view = 'quiz';
    this.state.step = TOTAL_STEPS;
    this.state.error = '';
    this._shouldFocus = true;
    this._save();
    this.render();
    this.emit('quiz:step', { step: TOTAL_STEPS, answers: this._answersOut() });
  }

  _adjust() {
    this.state.view = 'quiz';
    this.state.step = 1;
    this._shouldFocus = true;
    this.render();
    this.emit('quiz:step', { step: 1, answers: this._answersOut() });
  }

  _restart() {
    const completedBefore = this.state.completedBefore;
    this.state.answers = { ...DEFAULT_ANSWERS, functions: [] };
    this.state.step = 1;
    this.state.view = 'quiz';
    this.state.result = null;
    this.state.shownBundleId = null;
    this.state.error = '';
    this._clearStorage();
    this._shouldFocus = true;
    this.render();
    this.emit('quiz:restart', { completedBefore });
  }

  _showAlternate(id) {
    const target = BUNDLES.find((b) => b.id === id);
    if (!target) return;
    const from = this.state.shownBundleId;

    // Swap the alternate into the main slot and demote the bundle it replaced,
    // so the user can always get back to what they were just looking at.
    const res = this.state.result;
    const pool = [res.primary, ...res.alternates].filter(Boolean);
    res.alternates = pool.filter((b) => b.id !== id).slice(0, 2);
    res.primary = target;

    this.state.shownBundleId = id;
    this._shouldFocus = true;
    this.render();
    this.emit('quiz:alternate-view', { fromBundleId: from, toBundleId: id });
  }

  _currentBundle() {
    return BUNDLES.find((b) => b.id === this.state.shownBundleId) || null;
  }

  _productClick(el) {
    const bundle = this._currentBundle();
    const id = el.dataset.product;
    const p = PRODUCTS[id];
    if (!p) return;
    this.emit('quiz:product-click', {
      bundleId: bundle ? bundle.id : null,
      productId: id,
      productName: p.name,
      price: p.price,
      url: p.url
    });
  }

  /**
   * Add-to-cart. Only reachable when the host has configured a cart-endpoint.
   * With none set, WhatsApp is the single call to action and this never renders.
   */
  _cta() {
    const bundle = this._currentBundle();
    if (!bundle || !this.cartEndpoint) return;

    this.emit('quiz:cta-click', {
      bundleId: bundle.id,
      bundleName: bundle.name,
      price: bundle.price,
      action: 'add-to-cart'
    });

    this._postToCart(bundle);
  }

  /**
   * POST the bundle to the host's cart endpoint from a hidden iframe-targeted
   * form, so a Magento redirect response lands in a new tab instead of
   * replacing the host page.
   */
  _postToCart(bundle) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = this.cartEndpoint;
    form.target = '_blank';
    form.rel = 'noopener';
    form.style.display = 'none';

    const add = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    add('bundle_id', String(bundle.id));
    add('bundle_name', bundle.name);
    bundle.products.forEach((id, i) => {
      add(`products[${i}][id]`, id);
      add(`products[${i}][qty]`, '1');
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  /**
   * Open WhatsApp with the whole match pre-written, addressed to the business.
   *
   * NOTE: a browser cannot SEND a WhatsApp message, the visitor taps send in
   * their own client. Genuinely automatic sending needs the WhatsApp Business
   * Cloud API called from a server that holds the access token; that token can
   * never live in this file. See README → "The WhatsApp CTA".
   */
  _whatsapp(intent = 'bundle') {
    const bundle = this._currentBundle();
    const a = this.state.answers;
    const lines = [];

    if (bundle) {
      lines.push(`Hi Homegym.sg, I took the bundle quiz and got *${bundle.name}* (${this.money(bundle.price)}).`);
      lines.push('');
      lines.push('*My answers*');
    } else {
      lines.push('Hi Homegym.sg, I took the bundle quiz and nothing in the range fits my space.');
      lines.push('');
      lines.push('*My answers*');
    }

    const fns = a.functions.map((f) => FUNCTION_SHORT[f] || f).join(', ') || 'Not specified';
    lines.push(`Training: ${fns}`);
    lines.push(`Space: ${a.length.toFixed(1)} x ${a.depth.toFixed(1)} m`);
    lines.push(`Looking for: ${a.persona || 'Not specified'}`);
    lines.push(`Budget: ${this.money(a.budget)}`);

    if (bundle) {
      lines.push('');
      lines.push('*The bundle*');
      bundle.products.forEach((id) => {
        const p = PRODUCTS[id];
        if (p) lines.push(`- ${p.name}: ${this.money(p.price)}`);
      });
      lines.push('');
      lines.push(`Total: ${this.money(bundle.price)}`);
      lines.push('');
      lines.push(intent === 'showroom'
        ? 'Could I book a time at the showroom to try this build before I decide?'
        : intent === 'advice'
          ? 'Before I commit, could you tell me what you would actually put in this room?'
          : 'Could you confirm availability, delivery and installation, and when I could come down to the showroom to try these?');
    } else {
      lines.push('');
      lines.push('Could you advise what would work in this space, and when I could come down to the showroom?');
    }

    this.emit('quiz:cta-click', {
      bundleId: bundle ? bundle.id : null,
      bundleName: bundle ? bundle.name : null,
      price: bundle ? bundle.price : null,
      action: intent === 'bundle' ? 'whatsapp' : intent
    });

    const url = `https://wa.me/${this.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  }

  /** The answers object handed to the matcher and to every event. */
  _answersOut() {
    const a = this.state.answers;
    return {
      functions: a.functions.slice(),
      length: a.length,
      depth: a.depth,
      persona: a.persona || null,
      budget: a.budget
    };
  }
}

if (!customElements.get('homegym-bundle-quiz')) {
  customElements.define('homegym-bundle-quiz', HomegymBundleQuiz);
}

export { HomegymBundleQuiz };
export default HomegymBundleQuiz;
