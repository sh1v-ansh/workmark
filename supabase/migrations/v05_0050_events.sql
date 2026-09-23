-- What people actually did, and when.

-- ─── Why first-party rather than PostHog ─────────────────────────────────────
-- Every other fact about a student already lives in this database — their
-- record, their evidence, their disputes. Sending their behaviour to a third
-- party would mean the one table describing what they did is the one table
-- we cannot join against the rest, and would put a processor in a privacy
-- policy that currently gets to say no third party sets cookies here.
--
-- The cost is that nobody builds the dashboards for us. That is a fair trade
-- at this size: the questions are few and specific, and a funnel is a query.

-- ─── Why this cannot be derived from the tables we have ──────────────────────
-- Today's funnel is computed at read time from row timestamps — count the
-- students, count the github_connections, count the applications. That
-- answers "how many people are at each stage right now" and cannot answer
-- anything else:
--
--   * It has no failures in it. A signup that was started and abandoned
--     leaves no row anywhere, so the single most important number for a
--     product with a waitlist — how many invited people never finish — is
--     not merely unknown, it is unknowable.
--   * It has no time in it. "How did last month's cohort convert" needs to
--     know when each step happened, not just that it did.
--   * It cannot see anything that is not already a table. Which page
--     somebody left from, which repository picker they abandoned, how long a
--     scan took before they gave up.

create table if not exists events (
  id          bigserial primary key,
  -- Null for anything before sign-in: a landing page view, a signup that was
  -- started and abandoned. Those are exactly the rows worth having.
  student_id  uuid references students(id) on delete set null,
  -- Survives sign-in, so a session can be followed from first visit through
  -- to a finished profile. Set client side; meaningless across devices, and
  -- deliberately not a fingerprint.
  session_id  text,
  name        text not null,
  -- Anything the event needs. Kept small on purpose — see the note in
  -- lib/analytics/events.ts about what must never go in here.
  props       jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- The funnel asks "the first time each student did X, bucketed by week", so
-- (name, occurred_at) is the access path for every question on the admin
-- page. The per-student index is for answering support questions about one
-- person, which is rare and has to be possible.
create index if not exists events_name_time_idx on events (name, occurred_at desc);
create index if not exists events_student_idx on events (student_id, occurred_at desc)
  where student_id is not null;
create index if not exists events_session_idx on events (session_id, occurred_at)
  where session_id is not null;

-- ─── Who may write, and who may read ─────────────────────────────────────────
-- Nobody, through RLS. Writes go through /api/events under the service role
-- after the name is checked against a fixed list, because a table a browser
-- can insert arbitrary rows into is a table somebody will fill with junk.
-- Reads happen on admin pages, which already use the service role.
alter table events enable row level security;

-- ─── Retention ───────────────────────────────────────────────────────────────
-- Behaviour is the most sensitive thing here and the least valuable once it
-- is old: the funnel questions are all about the last few months. Anything
-- past a year is deleted rather than kept in case it becomes interesting,
-- which is the reasoning that turns an events table into a liability.
--
-- The cron extension is already installed for the job sweeper. Unscheduled
-- first, so re-running this migration replaces the job rather than failing
-- on a duplicate name — the same pattern as v05_0016 and v05_0018.
select cron.unschedule('workmark-events-retention')
  where exists (select 1 from cron.job where jobname = 'workmark-events-retention');

select cron.schedule(
  'workmark-events-retention',
  '17 4 * * *',
  $$delete from events where occurred_at < now() - interval '365 days'$$
);
