-- Project briefs Workmark wrote unprompted.
--
-- Until now a brief only existed because a student asked for one, which
-- means a student who has not yet worked out that the feature exists sees an
-- empty marketplace and no reason to come back. A nightly job now writes a
-- few for them, and those appear on Find work alongside real postings —
-- marked, always, as something we generated rather than something a person
-- posted.
--
-- Two columns rather than one boolean, because "who asked for this" and "why
-- this skill" are different questions and the second one is what the card
-- has to say out loud. A recommendation that cannot explain itself is just
-- an advert.

alter table project_briefs
  add column if not exists source text not null default 'student'
    check (source in ('student', 'recommended')),
  -- Only ever set on a recommended brief. Null on one the student asked for,
  -- because there is no reason to give beyond "you asked".
  add column if not exists recommendation_reason text
    check (recommendation_reason is null or recommendation_reason in ('deepen', 'gap', 'adjacent'));

-- The one query the nightly job and the Find work page both run: this
-- student's recommendations that they have not started yet. Partial, because
-- started and student-asked briefs are the large majority and neither is
-- ever fetched this way.
create index if not exists project_briefs_open_recommendations_idx
  on project_briefs (student_id, issued_at desc)
  where source = 'recommended' and started_at is null;

comment on column project_briefs.source is
  'student = they asked for it. recommended = the nightly job wrote it. Shown differently on Find work; never presented as a human posting.';

comment on column project_briefs.recommendation_reason is
  'deepen = goes further into a skill they are already strong in. gap = an open listing wants it and they have no evidence. adjacent = a neighbour of something they are strong in, which they have not touched.';

-- ── The nightly wake ─────────────────────────────────────────────────────
-- Same shape as the other jobs: Postgres holds the schedule and the secret,
-- and pg_net pokes the route that does the actual work. The route needs the
-- Anthropic client and the brief agent, neither of which exists in the
-- database.
--
-- The guard matters more here than in the other jobs. This is the only cron
-- in the product that spends money, so it refuses to wake anything at all
-- unless there is at least one student who could receive something — no
-- GitHub connections, no call.

create or replace function request_project_recommendations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from private_config where key = 'site_url';
  select value into v_secret from private_config where key = 'cron_secret';
  if v_url is null or v_secret is null then return; end if;

  -- Nobody connected means nobody to recommend to. Don't wake anything.
  if not exists (select 1 from github_connections limit 1) then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/api/cron/recommend-projects',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function request_project_recommendations() from public, anon, authenticated;

select cron.unschedule('workmark-recommend-projects')
  where exists (select 1 from cron.job where jobname = 'workmark-recommend-projects');

-- 04:41 UTC. Off the hour and off the other jobs' minutes, so the nightly
-- work does not all land on the same connection pool at once.
select cron.schedule(
  'workmark-recommend-projects',
  '41 4 * * *',
  $$select request_project_recommendations()$$
);
