-- Homegym.sg, quiz telemetry.
--
-- Applied with the Supabase MCP / CLI. Checked in so the schema the dashboard
-- reads is reviewable in the same diff as the code that reads it, rather than
-- living only in a web console nobody can grep.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT IS DELIBERATELY NOT COLLECTED
--   No IP address. No user agent. No referrer. No cookie. No name, email or
--   phone, even though the WhatsApp CTA has all three a moment later. A
--   `session_id` is a random string minted in sessionStorage and thrown away
--   when the tab closes: it exists to join four events into one funnel and
--   cannot be tied back to a person or to a second visit.
--
--   That is not caution for its own sake. Under Singapore's PDPA this keeps the
--   table out of "personal data" entirely, which means no consent banner on the
--   quiz, no access-or-correction obligation, and nothing here to breach. The
--   moment someone adds an IP column that stops being true, so don't.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.quiz_events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),

  -- Random, per-tab, non-identifying. Bounded so a malformed or hostile client
  -- cannot use it as free storage.
  session_id  text not null check (length(session_id) between 8 and 64),

  -- CLOSED VOCABULARY, ON PURPOSE. An event name the dashboard has never heard
  -- of is a bug somewhere, and a bug is better raised at the insert than
  -- discovered six weeks later as a metric that has been quietly undercounting.
  -- Adding an event means adding it here, which is the point.
  name text not null check (name in (
    'quiz:start', 'quiz:step', 'quiz:complete',
    'quiz:product-click', 'quiz:cta-click', 'quiz:alternate-view', 'quiz:restart'
  )),

  -- Promoted out of `detail` because every one of them is grouped or filtered
  -- on by the dashboard, and a jsonb lookup per row in an aggregate over a
  -- month of traffic is the difference between a page that loads and one that
  -- times out. Everything else stays in `detail`.
  step       smallint check (step between 1 and 4),
  bundle_id  smallint,
  action     text check (action is null or length(action) <= 40),
  product_id text check (product_id is null or length(product_id) <= 60),

  -- The whole original payload, so a question nobody thought to ask in
  -- September can still be answered from the same rows in March.
  detail jsonb not null default '{}'::jsonb
);

comment on table public.quiz_events is
  'Append-only telemetry from the bundle quiz. Deliberately carries no personal data: see db/001_quiz_events.sql.';

-- Every dashboard query is "recent rows, grouped by something". occurred_at
-- leads each index because the window filter is the one predicate that is
-- always present.
create index if not exists quiz_events_occurred_at_idx on public.quiz_events (occurred_at desc);
create index if not exists quiz_events_name_time_idx   on public.quiz_events (name, occurred_at desc);
create index if not exists quiz_events_session_idx     on public.quiz_events (session_id, occurred_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACCESS: APPEND ONLY, AND NOTHING ELSE.
--
-- The ingest function holds the publishable key, which is exactly as trusted as
-- the browser it could have come from. So the key is allowed to do the one
-- thing ingest needs and nothing more: INSERT. There is deliberately no SELECT,
-- UPDATE or DELETE policy, so that key cannot read back a single row, and a
-- leak of it buys an attacker the ability to write junk into a metrics table
-- rather than to read the client's funnel.
--
-- Reads go through quiz_insights() below, which returns aggregates only.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.quiz_events enable row level security;

drop policy if exists "append only, no reads" on public.quiz_events;
create policy "append only, no reads"
  on public.quiz_events
  for insert
  to anon
  with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- THE ONLY WAY ANYTHING READS THIS TABLE.
--
-- security definer so it can see rows the caller's own policies hide, and it
-- returns COUNTS, never rows. There is no argument that can persuade it to
-- return a session_id or a detail blob, which is what makes granting it to the
-- same key the browser-facing ingest uses defensible.
--
-- search_path is pinned: a security definer function without it can be hijacked
-- by anything that can create a table in a schema earlier on the caller's path.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.quiz_insights(days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with
  -- Clamped rather than validated. A dashboard asking for 5,000 days is a bug
  -- in the dashboard, and answering it with a year is more useful than an error.
  win as (select greatest(1, least(coalesce(days, 30), 365)) as d),
  ev as (
    select e.*
    from public.quiz_events e, win
    where e.occurred_at >= now() - (win.d || ' days')::interval
  ),

  -- FUNNEL. Step 1 is on screen before any quiz:step fires, so quiz:start is
  -- the denominator; steps 2-4 are "this session was ever shown that screen".
  -- Measured as "ever reached", not "last seen", because Back exists: a visitor
  -- who reaches step 4 and steps back to 2 has still seen step 4.
  sessions as (select count(distinct session_id) as n from ev where name = 'quiz:start'),
  reached as (
    select
      (select count(distinct session_id) from ev where name = 'quiz:step' and step >= 2) as s2,
      (select count(distinct session_id) from ev where name = 'quiz:step' and step >= 3) as s3,
      (select count(distinct session_id) from ev where name = 'quiz:step' and step >= 4) as s4,
      (select count(distinct session_id) from ev where name = 'quiz:complete')           as done
  )

  select jsonb_build_object(
    'generated_at', now(),
    'days', (select d from win),
    'total_events', (select count(*) from ev),
    'sessions', (select n from sessions),

    'funnel', (
      select jsonb_build_array(
        jsonb_build_object('screen', 'Started',          'sessions', (select n from sessions)),
        jsonb_build_object('screen', 'Floor space',        'sessions', r.s2),
        jsonb_build_object('screen', 'About you',          'sessions', r.s3),
        jsonb_build_object('screen', 'Budget',             'sessions', r.s4),
        jsonb_build_object('screen', 'Saw their bundle',   'sessions', r.done)
      ) from reached r
    ),

    -- CLICKS, split by what was clicked. "Clicks" on its own is a vanity
    -- number; which of the three kinds moved is the thing worth knowing.
    'clicks', (
      select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) from (
        select name, count(*) as n
        from ev
        where name in ('quiz:product-click', 'quiz:cta-click', 'quiz:alternate-view')
        group by name
      ) t
    ),

    'product_clicks', (
      select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'clicks', n) order by n desc), '[]'::jsonb)
      from (
        select product_id, count(*) as n
        from ev where name = 'quiz:product-click' and product_id is not null
        group by product_id order by n desc limit 20
      ) t
    ),

    -- BUNDLES VIEWED. Two different things, kept apart: the bundle the matcher
    -- chose, and a bundle the visitor went looking for themselves off the
    -- alternates strip. Summing them would hide the second, which is the more
    -- interesting signal, because it is the visitor disagreeing with the match.
    'bundles', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'bundle_id', bundle_id, 'matched', matched, 'explored', explored
             ) order by (matched + explored) desc), '[]'::jsonb)
      from (
        select
          bundle_id,
          count(*) filter (where name = 'quiz:complete')       as matched,
          count(*) filter (where name = 'quiz:alternate-view') as explored
        from ev
        where bundle_id is not null and name in ('quiz:complete', 'quiz:alternate-view')
        group by bundle_id
      ) t
    ),

    -- CTAs. `opened` counts the sessions that reached a result at all, so the
    -- dashboard can show a rate rather than a bare count: 12 WhatsApp taps means
    -- nothing until you know whether 20 people or 2,000 saw the button.
    'cta', (
      select coalesce(jsonb_agg(jsonb_build_object('action', action, 'clicks', n) order by n desc), '[]'::jsonb)
      from (
        select action, count(*) as n
        from ev where name = 'quiz:cta-click' and action is not null
        group by action
      ) t
    ),
    'cta_opportunities', (select done from reached),

    'restarts', (select count(*) from ev where name = 'quiz:restart'),

    -- Sparkline source. Days with no traffic are absent rather than zero; the
    -- dashboard fills the gaps, because doing it here needs a generate_series
    -- join that earns nothing.
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'sessions', n) order by d), '[]'::jsonb)
      from (
        select date_trunc('day', occurred_at)::date as d, count(distinct session_id) as n
        from ev where name = 'quiz:start'
        group by 1
      ) t
    )
  );
$$;

comment on function public.quiz_insights(integer) is
  'Aggregates only, never rows. The single read path for the insights dashboard.';

revoke all on function public.quiz_insights(integer) from public;
grant execute on function public.quiz_insights(integer) to anon;

-- Nobody ever signs in to this project: the quiz has no auth flow of any kind,
-- so the `authenticated` role has no business holding this grant either.
revoke execute on function public.quiz_insights(integer) from authenticated;
