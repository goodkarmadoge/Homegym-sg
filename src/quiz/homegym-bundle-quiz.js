/**
 * <homegym-bundle-quiz>, Homegym.sg personalised bundle quiz.
 *
 * A framework-agnostic custom element. Four questions, ten bundles, one match.
 * Everything renders inside an open shadow root, so it drops into any page
 * (Bootstrap, Tailwind, raw Magento) with no style bleed in either direction.
 *
 *   <homegym-bundle-quiz
 *     theme="light"                    light (default, homegym.sg's own) | dark
 *     accent="#FF6924"                 any CSS colour; hex gets a contrast fix
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
import { BUNDLES, PRODUCTS, FUNCTION_OPTIONS, LEVEL_OPTIONS, FUNCTION_SHORT } from './bundles.js';
import { match, FALLBACK } from './matcher.js';
import { STYLES } from './styles.js';

const STORAGE_KEY = 'homegym-bundle-quiz-v1';
const TOTAL_STEPS = 4;

/* The budget slider's ends. The top of the range is a floor, not a ceiling:
   it renders as "S$7,500+", so anyone with more to spend still lands on the
   most capable bundle rather than being told their number is out of range. */
const BUDGET_MIN = 2500;
const BUDGET_MAX = 7500;

const DEFAULT_ANSWERS = {
  functions: [],
  length: 2.5,
  depth: 3.0,
  level: null,
  budget: 4000
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
    return ['theme', 'accent', 'currency', 'cart-endpoint', 'contact-url', 'whatsapp', 'start-step'];
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
  get accent() { return this.getAttribute('accent') || '#FF6924'; }
  get currency() { return this.getAttribute('currency') || 'SGD'; }
  get cartEndpoint() { return this.getAttribute('cart-endpoint') || ''; }
  get contactUrl() { return this.getAttribute('contact-url') || '/contact'; }
  get whatsapp() { return (this.getAttribute('whatsapp') || '').replace(/[^\d]/g, ''); }

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
    // Custom properties set inline on the host beat the :host defaults, and
    // `all: initial` does not reset custom properties, so this is the cheapest
    // way to theme without a second stylesheet.
    const bg = this.theme === 'dark' ? '#111111' : '#FFFFFF';
    this.style.setProperty('--accent', this.accent);
    this.style.setProperty('--accent-ink', readableAccent(this.accent, bg));
    this.style.setProperty('--on-accent', inkOn(this.accent));

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
        const tile = img.parentElement?.querySelector('.card__fallback');
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
          <span>Step ${this.state.step} of ${TOTAL_STEPS}</span>
          <span>${['Function', 'Space', 'Level', 'Budget'][this.state.step - 1]}</span>
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

    return `
      <div class="quiz">
        ${this.progress()}
        <div aria-live="polite" class="visually-hidden">Step ${step} of ${TOTAL_STEPS}</div>
        ${inner}
        <div class="validation" role="alert">${esc(this.state.error)}</div>
        <div class="actions">
          ${canGoBack ? `<button class="btn btn--ghost" data-action="back" type="button">${BACK_ARROW} Back</button>` : ''}
          <button class="btn btn--primary" data-action="next" type="button">
            ${isLast ? 'Build my bundle' : 'Continue'} ${ARROW}
          </button>
          ${hasResult && !isLast ? `<button class="btn btn--text" data-action="forward" type="button">Forward to my bundle ${ARROW}</button>` : ''}
        </div>
      </div>`;
  }

  step1() {
    const chosen = new Set(this.state.answers.functions);
    return `
      <h1 class="headline" tabindex="-1" data-focus>What do you actually want to train?</h1>
      <p class="subhead">Pick everything that matters to you. We'll match the machine that does it all.</p>
      <fieldset class="options options--two">
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
        <div class="dim__head"><label class="dim__label" for="${id}-range">${label}</label></div>
        <div class="dim__row">
          <input type="range" id="${id}-range" name="${id}" min="1" max="3" step="0.5" value="${value}"
                 aria-label="${label} in metres">
          <input type="number" class="dim__number" name="${id}" min="1" max="3" step="0.5" value="${value.toFixed(1)}"
                 aria-label="${label} in metres, numeric entry">
        </div>
      </div>`;

    // Controls first, diagram second: the sliders are what the user came here to
    // operate, and the plan below them reads as the result of the input rather
    // than something to hunt past.
    return `
      <h1 class="headline" tabindex="-1" data-focus>How much floor space have you got?</h1>
      <p class="subhead">Measure the clear area, wall to wall, in metres. Most HDB bedrooms give you about 2.5 &times; 3.</p>
      <div class="dims">
        ${dim('length', 'Length (m)', length)}
        ${dim('depth', 'Depth (m)', depth)}
      </div>
      <div class="room">${this.roomSvg(length, depth)}
        <div class="room__caption">
          <span>Drawn to scale against a 3 &times; 3 m reference</span>
          <span class="room__area" data-room-area>${(length * depth).toFixed(2)} m&sup2;</span>
        </div>
      </div>
      <p class="note">Add at least 0.5 m of clearance in front of any rack for pulling the bar out. We've already accounted for this in every bundle footprint.</p>`;
  }

  /**
   * Plan view of the room, to scale inside a 3x3 m reference square.
   * 100 SVG units = 1 metre. The human plan-symbol is a real 0.5 m across the
   * shoulders, which is what makes the rectangle mean anything.
   */
  roomSvg(length, depth) {
    const U = 100;
    const PAD = 26;
    const SIZE = 3 * U;
    const w = length * U;
    const h = depth * U;
    const x = PAD;
    const y = PAD + (SIZE - h);

    const grid = [];
    for (let m = 0.5; m < length; m += 0.5) {
      grid.push(`<line x1="${x + m * U}" y1="${y}" x2="${x + m * U}" y2="${y + h}" stroke="var(--line)" stroke-width="1"/>`);
    }
    for (let m = 0.5; m < depth; m += 0.5) {
      grid.push(`<line x1="${x}" y1="${y + m * U}" x2="${x + w}" y2="${y + m * U}" stroke="var(--line)" stroke-width="1"/>`);
    }

    const hx = x + w / 2;
    const hy = y + h - 42;

    return `
      <svg viewBox="0 0 ${SIZE + PAD * 2} ${SIZE + PAD * 2}" role="img"
           aria-label="Floor plan: ${length.toFixed(1)} metres by ${depth.toFixed(1)} metres, ${(length * depth).toFixed(2)} square metres">
        <rect x="${PAD}" y="${PAD}" width="${SIZE}" height="${SIZE}"
              fill="none" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="4 6"/>
        <text x="${PAD}" y="${PAD - 9}" fill="var(--muted)" font-size="13" font-family="inherit">3 &times; 3 m max</text>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--surface-2)" stroke="var(--accent)" stroke-width="2.5" rx="2"/>
        ${grid.join('')}
        <g opacity="0.85">
          <ellipse cx="${hx}" cy="${hy}" rx="25" ry="16" fill="var(--muted)"/>
          <circle cx="${hx}" cy="${hy}" r="11" fill="var(--text)"/>
        </g>
        <text x="${x + w / 2}" y="${y - 10}" fill="var(--accent-ink)" font-size="15" font-weight="600"
              text-anchor="middle" font-family="inherit">${length.toFixed(1)} m</text>
        <text x="${x + w + 12}" y="${y + h / 2}" fill="var(--accent-ink)" font-size="15" font-weight="600"
              text-anchor="middle" font-family="inherit"
              transform="rotate(90 ${x + w + 12} ${y + h / 2})">${depth.toFixed(1)} m</text>
      </svg>`;
  }

  step3() {
    const current = this.state.answers.level;
    return `
      <h1 class="headline" tabindex="-1" data-focus>Where are you at right now?</h1>
      <p class="subhead">This sets how much machine you'll actually use, not how hard you train.</p>
      <fieldset class="options">
        <legend class="visually-hidden">Fitness level</legend>
        ${LEVEL_OPTIONS.map((o) => `
          <label class="option option--radio${current === o.value ? ' is-selected' : ''}">
            <input type="radio" name="level" value="${esc(o.value)}" ${current === o.value ? 'checked' : ''}>
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
      <div class="budget__value" data-budget-value aria-live="polite">${this.budgetLabel(b)}</div>
      <input type="range" name="budget" min="${BUDGET_MIN}" max="${BUDGET_MAX}" step="250" value="${b}"
             aria-label="Budget in Singapore dollars"
             aria-valuetext="${this.budgetLabel(b)}">
      <div class="budget__ends">
        <span>${this.money(BUDGET_MIN)}</span>
        <span>${this.money(BUDGET_MAX)}+</span>
      </div>
      <p class="note" style="margin-top:22px">Every bundle we show is priced at current sale prices and comes in under your number.</p>`;
  }

  viewMatching() {
    return `
      <div class="quiz">
        <div class="matching">
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

    // Deliberately no "S$X under budget" chip. Coming in under budget is a
    // guarantee of the matcher, not a feature of this bundle, naming the
    // leftover only invites the question of why we did not spend it. When a
    // bundle genuinely is over budget the fallback banner says so instead.
    const chips = [
      `Fits ${bundle.footprint.length.toFixed(1)} &times; ${bundle.footprint.depth.toFixed(1)} m`,
      matched.length
        ? `${matched.map((f) => FUNCTION_SHORT[f] || f).join(' + ')} work`
        : `${bundle.functions.map((f) => FUNCTION_SHORT[f] || f).join(' + ')} work`,
      // The level is only a REASON when it agrees with what they told us. When
      // it does not, an advanced lifter matched to an intermediate bundle on
      // space and budget, saying "Intermediate level" argues against the match
      // rather than for it, so fall back to another fact that is always true.
      bundle.level === a.level
        ? `Built for ${bundle.level}`
        : `${bundle.trains.length} movements covered`
    ];

    const alternates = res.alternates.filter((alt) => alt.id !== bundle.id).slice(0, 2);

    return `
      <div class="quiz quiz--result">
        ${this.banner(res)}
        <p class="eyebrow">Your match</p>
        <h1 class="result__name" tabindex="-1" data-focus>${esc(bundle.name)}</h1>
        <p class="result__tagline">${esc(bundle.tagline)}</p>

        <div class="chips">
          ${chips.map((c) => `<span class="chip">${CHECK_SVG}${c}</span>`).join('')}
        </div>

        <div class="pricebox">
          <span class="pricebox__total">${this.money(bundle.price)}</span>
        </div>

        <p class="pitch">${esc(bundle.pitch)}</p>

        <div class="actions">
          ${this.whatsapp
            ? `<button class="btn btn--wa btn--lg" data-action="whatsapp" type="button">${WA_SVG} Send my bundle on WhatsApp</button>`
            /* No WhatsApp number configured, fall back to the contact page so a
               host embedding this can never end up with a result and no way to act. */
            : `<a class="btn btn--primary btn--lg" href="${esc(this.contactUrl)}" target="_blank" rel="noopener"
                  data-action="cta-contact">Enquire about this bundle ${ARROW}</a>`}
          ${/* Only when a host has actually wired a cart. With none configured
                (the case today) WhatsApp is the single call to action. */
            this.cartEndpoint
              ? `<button class="btn btn--primary" data-action="cta" type="button">Add all to cart ${ARROW}</button>`
              : ''}
        </div>
        <p class="note cta-note">
          Want to try before you buy? Send it over and we'll book you a time to come
          down to the showroom and put your hands on everything in this bundle.
        </p>

        <section class="section">
          <h2 class="section__title">What you'll train</h2>
          <div class="pills">${bundle.trains.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
        </section>

        <section class="section">
          <h2 class="section__title">What's in the bundle</h2>
          <div class="grid">${bundle.products.map((id) => this.productCard(id, bundle)).join('')}</div>
          <div class="total-row">Bundle total <b>${this.money(bundle.price)}</b></div>
          <p class="fineprint">
            Prices are current sale prices as at 30 August 2026 and exclude delivery and installation,
            which are quoted separately. These units run from 90&nbsp;kg to over 300&nbsp;kg.
          </p>
        </section>

        ${alternates.length ? `
        <section class="section">
          <h2 class="section__title">Also worth a look</h2>
          <div class="alts">
            ${alternates.map((alt) => `
              <button class="alt" type="button" data-action="alternate" data-bundle="${alt.id}">
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
        </section>` : ''}

        <div class="retake">
          <button class="btn btn--ghost" data-action="back-to-steps" type="button">${BACK_ARROW} Back to my budget</button>
          <button class="btn btn--text" data-action="adjust" type="button">Adjust my answers</button>
          <button class="btn btn--text" data-action="restart" type="button">Start over</button>
        </div>
      </div>`;
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
    return text ? `<div class="banner" role="status">${text}</div>` : '';
  }

  productCard(id, bundle) {
    const p = PRODUCTS[id];
    if (!p) return '';
    const initial = esc(p.name.trim().charAt(0).toUpperCase());
    return `
      <article class="card">
        <div class="card__media">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" data-fallback>
          <div class="card__fallback" hidden aria-hidden="true">${initial}</div>
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
        <div class="talk">
          <p class="eyebrow">No honest match</p>
          <h1 class="headline" tabindex="-1" data-focus>Let's talk</h1>
          <p class="subhead" style="margin:0 auto 8px;max-width:46ch">
            At ${a.length.toFixed(1)} &times; ${a.depth.toFixed(1)} m there is nothing in the range we can
            recommend in good conscience. Rather than sell you something that will not fit, we would
            rather look at the room with you. Wall-mounted and folding options open up below this size.
          </p>
          <div class="actions">
            ${this.whatsapp
              ? `<button class="btn btn--wa btn--lg" data-action="whatsapp" type="button">${WA_SVG} Message us on WhatsApp</button>`
              : `<a class="btn btn--primary btn--lg" href="${esc(this.contactUrl)}" target="_blank" rel="noopener"
                    data-action="cta-contact">Talk to us ${ARROW}</a>`}
            <button class="btn btn--ghost" data-action="back-to-steps" type="button">${BACK_ARROW} Back</button>
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
      if (this.state.answers.functions.length) this._clearError();
      this._save();
    }
    if (t.name === 'level') {
      this.state.answers.level = t.value;
      this.shadowRoot.querySelectorAll('.option--radio').forEach((el) => {
        el.classList.toggle('is-selected', el.contains(t));
      });
      this._clearError();
      this._save();
    }
  }

  _onInput(e) {
    const t = e.target;

    if (t.name === 'length' || t.name === 'depth') {
      let v = parseFloat(t.value);
      if (!Number.isFinite(v)) return;               // mid-typing in the number box
      v = Math.min(3, Math.max(1, Math.round(v * 2) / 2));
      this.state.answers[t.name] = v;

      // Patch in place, a full re-render here would drop slider focus mid-drag.
      this.shadowRoot.querySelectorAll(`[name="${t.name}"]`).forEach((el) => {
        if (el === t) return;
        el.value = el.type === 'number' ? v.toFixed(1) : String(v);
      });
      const room = this.shadowRoot.querySelector('.room');
      if (room) {
        const { length, depth } = this.state.answers;
        room.innerHTML = `${this.roomSvg(length, depth)}
          <div class="room__caption">
            <span>Drawn to scale against a 3 &times; 3 m reference</span>
            <span class="room__area">${(length * depth).toFixed(2)} m&sup2;</span>
          </div>`;
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
      case 'whatsapp':  e.preventDefault(); this._whatsapp(); break;
      case 'product':   this._productClick(el); break;   // let the link open naturally
      default: break;
    }
  }

  _clearError() {
    if (!this.state.error) return;
    this.state.error = '';
    const box = this.shadowRoot.querySelector('.validation');
    if (box) box.textContent = '';
  }

  _next() {
    if (this.state.step === 1 && this.state.answers.functions.length === 0) {
      this.state.error = 'Pick at least one thing you want to train.';
      const box = this.shadowRoot.querySelector('.validation');
      if (box) box.textContent = this.state.error;
      return;
    }
    if (this.state.step === 3 && !this.state.answers.level) {
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
  _whatsapp() {
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
    lines.push(`Level: ${a.level ? a.level.charAt(0).toUpperCase() + a.level.slice(1) : 'Not specified'}`);
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
      lines.push('Could you confirm availability, delivery and installation, and when I could come down to the showroom to try these?');
    } else {
      lines.push('');
      lines.push('Could you advise what would work in this space, and when I could come down to the showroom?');
    }

    this.emit('quiz:cta-click', {
      bundleId: bundle ? bundle.id : null,
      bundleName: bundle ? bundle.name : null,
      price: bundle ? bundle.price : null,
      action: 'whatsapp'
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
      level: a.level || 'beginner',
      budget: a.budget
    };
  }
}

if (!customElements.get('homegym-bundle-quiz')) {
  customElements.define('homegym-bundle-quiz', HomegymBundleQuiz);
}

export { HomegymBundleQuiz };
export default HomegymBundleQuiz;
