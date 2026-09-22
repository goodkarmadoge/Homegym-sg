/**
 * Homegym.sg, the dashboard's only data source.
 *
 * GET /api/insights?days=30  ->  the jsonb that public.quiz_insights() returns
 *
 * A thin pass-through, and thin on purpose: every number the dashboard shows is
 * computed in SQL, next to the rows, in db/001_quiz_events.sql. Aggregating in
 * JavaScript here would mean pulling a month of raw events across the wire to
 * add them up in a lambda, and it would put the definition of "a session" in a
 * different file from the table it is a fact about.
 *
 * THIS ROUTE IS THE THING KEEPING THE NUMBERS PRIVATE, AND IT HAS TO BE.
 *   The original plan was Vercel's deployment password. That cannot work here:
 *   deployment protection covers a WHOLE deployment, not a path, and this
 *   deployment also serves bundle-quiz.html, which is the customer-facing embed
 *   on homegym.sg and must stay public. Turning it on for production would have
 *   taken the quiz down with it. Checked on the live project rather than
 *   assumed: password protection was off, SSO covered only the generated
 *   deployment URLs, and the production domain answered 200 to anyone.
 *
 *   So the lock moved to where the data actually is. insights.html is just
 *   markup; leaking it costs nothing, because without this route it renders a
 *   password prompt and no numbers. That is the whole point of protecting the
 *   endpoint rather than the page.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const PASSWORD = process.env.INSIGHTS_PASSWORD;

/** Short enough to guess is the same as no password at all, given this runs on
 *  a public URL with no rate limit worth the name. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Is this request allowed to read the numbers?
 *
 * FAILS CLOSED, AND THAT IS THE ENTIRE DESIGN CONSTRAINT.
 *   Every other "not configured" path in this repo degrades to something
 *   harmless. This one cannot: an unset INSIGHTS_PASSWORD that fell through to
 *   "allow" would publish the client's traffic to anyone who typed the URL, and
 *   it would do it silently, looking exactly like a working dashboard. So a
 *   missing or too-short password refuses everybody, including whoever set it
 *   up, which is a bad afternoon rather than a quiet leak.
 *
 * Compared as SHA-256 digests through timingSafeEqual: digests are always 32
 * bytes, so this takes the same time for a wrong password of any length, and
 * timingSafeEqual throws on a length mismatch if fed the raw strings.
 */
export function authorise(provided, expected = PASSWORD) {
  if (!expected || expected.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, status: 503, error: 'not configured' };
  }
  if (typeof provided !== 'string' || !provided) {
    return { ok: false, status: 401, error: 'password required' };
  }
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, status: 401, error: 'wrong password' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // A header, not a cookie: nothing here should be sent automatically by the
  // browser on a cross-site request, which is what makes CSRF a non-topic.
  const auth = authorise(req.headers['x-insights-key']);
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error('[insights] INSIGHTS_PASSWORD is unset or under ' + MIN_PASSWORD_LENGTH +
                    ' characters; refusing every request rather than serving the numbers unprotected');
      return res.status(503).json({
        error: 'not configured',
        hint: `Set INSIGHTS_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) on the Vercel project, then redeploy.`
      });
    }
    // The same body whether the password was absent or wrong. Telling an
    // attacker which of the two they got is free information.
    return res.status(401).json({ error: 'unauthorised' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({
      error: 'not configured',
      // Said plainly, because the person who sees this is the person who can
      // fix it, and "500" would send them reading logs for no reason.
      hint: 'Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on the Vercel project, then redeploy.'
    });
  }

  const days = Math.max(1, Math.min(parseInt(req.query.days, 10) || 30, 365));

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/quiz_insights`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ days })
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error(`[insights] supabase ${r.status}: ${text.slice(0, 500)}`);
      return res.status(502).json({ error: 'upstream', status: r.status });
    }

    const data = await r.json();

    // Short cache, and private. The numbers move slowly enough that a minute of
    // staleness is invisible, and a reload while reading should not re-run a
    // month-wide aggregate. `private` because a shared cache in front of a
    // password-protected route has no business holding this.
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[insights] ' + (err && err.message));
    return res.status(502).json({ error: 'upstream' });
  }
}
