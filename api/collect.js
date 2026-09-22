/**
 * Homegym.sg, quiz telemetry ingest.
 *
 * POST /api/collect  { events: [ { name, session_id, detail }, ... ] }
 *
 * WHY A SERVERLESS FUNCTION AND NOT A DIRECT SUPABASE CALL FROM THE PAGE.
 *   The quiz is embedded on a third-party site. Anything the page holds, the
 *   page's visitor holds too, and a key in the bundle is a key in everyone's
 *   devtools. Keeping it here means the browser never sees a database
 *   credential of any kind, and the one that does live here is allowed to
 *   INSERT and nothing else (db/001_quiz_events.sql).
 *
 *   It also gives us a place to stand between the quiz and the table: the
 *   validation below is the only thing preventing a bored visitor from writing
 *   whatever they like into the client's metrics.
 *
 * FAILING IS NOT AN ERROR HERE.
 *   Telemetry must never be able to break the quiz. Every failure path returns
 *   a 2xx with a reason rather than a 4xx/5xx, because the caller uses
 *   sendBeacon, which cannot see a status code and will not retry: a non-2xx
 *   buys a red line in someone's console and nothing else. Real faults are
 *   logged where the operator can see them, in the Vercel function log.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

/** Mirrors the CHECK constraint on the table. Kept in step by hand, on purpose:
 *  adding an event should be a decision in two places, not a silent widening. */
export const EVENTS = new Set([
  'quiz:start', 'quiz:step', 'quiz:complete',
  'quiz:product-click', 'quiz:cta-click', 'quiz:alternate-view', 'quiz:restart'
]);

/** Only homegym.sg may post here, matching the frame-ancestors header on the
 *  quiz itself. The two are a pair: widen one and you have widened the other. */
const ALLOWED_ORIGINS = [
  'https://homegym.sg',
  'https://www.homegym.sg',
  'https://homegym-sg.vercel.app'
];

const MAX_EVENTS = 50;          // one visitor's whole session is nowhere near this
const MAX_BODY = 64 * 1024;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

const str = (v, max) =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;

/** Small integer or null. Rejects "3", 3.5 and NaN alike: the column is a
 *  smallint and PostgREST would take the string, which quietly turns a typo in
 *  the client into a row nobody notices is wrong. */
function smallint(v, lo, hi) {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  return v >= lo && v <= hi ? v : null;
}

/**
 * One client event to one row.
 *
 * The promoted columns are read out of `detail` rather than trusted from the
 * top level, because `detail` is what the quiz actually emits and duplicating
 * them client-side would give two sources of truth for the same number.
 */
export function toRow(e, sessionId) {
  if (!e || typeof e !== 'object') return null;
  const name = str(e.name, 40);
  if (!name || !EVENTS.has(name)) return null;

  const detail = e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) ? e.detail : {};

  // quiz:complete carries the matched bundle as bundleId; quiz:alternate-view
  // carries the one being opened as toBundleId. Both are "the bundle this row
  // is about", which is what the dashboard groups on.
  const bundleId = smallint(detail.bundleId, 1, 9999);
  const toBundleId = smallint(detail.toBundleId, 1, 9999);

  return {
    session_id: sessionId,
    name,
    step: smallint(detail.step, 1, 4),
    bundle_id: name === 'quiz:alternate-view' ? toBundleId : bundleId,
    action: str(detail.action, 40),
    product_id: str(detail.productId, 60),
    detail
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'POST only' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Loud in the log, quiet to the caller. An unconfigured deployment should
    // be obvious to whoever deployed it and invisible to the visitor.
    console.error('[collect] SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set; dropping events');
    return res.status(200).json({ ok: false, reason: 'not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(200).json({ ok: false, reason: 'too large' });
    try { body = JSON.parse(body); } catch { return res.status(200).json({ ok: false, reason: 'bad json' }); }
  }

  const sessionId = str(body && body.session_id, 64);
  if (!sessionId || sessionId.length < 8) {
    return res.status(200).json({ ok: false, reason: 'bad session' });
  }

  const incoming = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  const rows = incoming.map((e) => toRow(e, sessionId)).filter(Boolean);
  if (!rows.length) return res.status(200).json({ ok: true, written: 0 });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/quiz_events`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        // Nothing here needs the rows back, and asking for them would fail
        // anyway: the insert policy grants INSERT and deliberately not SELECT.
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(rows)
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error(`[collect] supabase ${r.status}: ${text.slice(0, 500)}`);
      return res.status(200).json({ ok: false, reason: 'upstream' });
    }
    return res.status(200).json({ ok: true, written: rows.length });
  } catch (err) {
    console.error('[collect] ' + (err && err.message));
    return res.status(200).json({ ok: false, reason: 'upstream' });
  }
}
