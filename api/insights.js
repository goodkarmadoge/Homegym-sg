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
 * THIS IS NOT THE THING KEEPING THE NUMBERS PRIVATE.
 *   Deployment protection is, set on the Vercel project, which covers this
 *   route and the page that calls it with one password and no code. This
 *   function assumes it is already behind that. It is still worth knowing that
 *   the function it calls returns counts and never rows, so the worst case if
 *   protection is ever switched off is that someone reads aggregate traffic
 *   numbers, not that they read anybody's answers.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

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
