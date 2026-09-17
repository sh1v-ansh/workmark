-- ============================================================
--  WORKMARK MIGRATION v05_0040 — measure the spend, name the speaker,
--  and let a student say a thing did not work out
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
-- ============================================================

-- ─── 1. What each agent call actually cost ──────────────────────────────────
-- agent_calls records the full prompt and the full response and not one
-- number about either, so the only way to answer "are we near the budget" is
-- to open the Anthropic dashboard, which cannot break it down by agent type,
-- by student, or by the feature that caused it.
--
-- The API already returns all of this on every response. Storing it is free
-- and it is the difference between managing a budget and discovering it.
--
-- Nullable rather than defaulted to zero: every row written before this
-- migration has an unknown cost, and zero would be a lie that averages into
-- every figure computed from the column.
alter table agent_calls add column if not exists input_tokens        int;
alter table agent_calls add column if not exists output_tokens       int;
-- Cache reads bill at a large discount and cache writes at a small premium,
-- so a column that merged them into input_tokens would make the saving from
-- prompt caching invisible — which is the one thing worth watching once
-- caching is turned on.
alter table agent_calls add column if not exists cache_read_tokens   int;
alter table agent_calls add column if not exists cache_write_tokens  int;

comment on column agent_calls.input_tokens is
  'Uncached prompt tokens billed at the full input rate. Null for calls made before v05_0040.';
comment on column agent_calls.cache_read_tokens is
  'Prompt tokens served from cache, billed at a fraction of the input rate.';

-- Spend is always asked about over a period and usually split by agent type.
create index if not exists agent_calls_cost_idx
  on agent_calls (created_at, agent_type)
  where input_tokens is not null;

-- ─── 2. Who is talking ──────────────────────────────────────────────────────
-- workspace_messages.sender_id is `on delete set null`, so a null sender
-- already means "the account that wrote this is gone". Writing agent messages
-- with a null sender would make those two cases indistinguishable, and the
-- first agent message is the point after which that can never be untangled.
--
-- Added before a single agent message exists, which is the only cheap time.
alter table workspace_messages
  add column if not exists sender_kind text not null default 'member';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_messages_sender_kind_check'
  ) then
    alter table workspace_messages
      add constraint workspace_messages_sender_kind_check
      check (sender_kind in ('member', 'agent'));
  end if;

  -- An agent has no account, so it must not claim one. A member may have a
  -- null sender_id, because their account can be deleted after they wrote it.
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_messages_agent_has_no_account'
  ) then
    alter table workspace_messages
      add constraint workspace_messages_agent_has_no_account
      check (sender_kind <> 'agent' or sender_id is null);
  end if;
end $$;

-- Every read of this table is one project's messages, or one task's thread,
-- oldest first. Without this, a busy project scans.
create index if not exists workspace_messages_thread_idx
  on workspace_messages (workspace_id, task_id, created_at);

-- ─── 3. Work that was tried and did not work out ────────────────────────────
-- A student who spent four days on an approach that turned out to be wrong
-- has two options today: leave the card in Doing forever, or move it to
-- Verified and pretend. The first quietly ruins their completion figures and
-- the second is a lie the verifier would catch.
--
-- Neither is what happened, and what happened is worth recording. Workmark's
-- argument against the CV is that a CV only shows the good half; a board that
-- also only shows the good half reproduces the thing it criticises.
--
-- A status rather than a flag, unlike blocked_at above, and the difference is
-- whether the work is still live. A blocked task is still in Doing and is
-- still coming; an abandoned one is finished without having been completed,
-- and leaving it in Doing would keep it counting as work in flight forever.
--
-- It is deliberately NOT a seventh board column. The board stays six columns
-- wide and abandoned cards move out of it into a collapsed list, because a
-- column of things that did not happen is a column nobody wants to look at.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('backlog', 'planned', 'doing', 'submitted', 'verified', 'accepted', 'abandoned'));

-- Why it was set aside. This is the part that carries the value: "the library
-- does not support streaming on this runtime" is a finding, and a finding is
-- evidence of having done the work even though the task produced nothing.
alter table tasks add column if not exists abandoned_at     timestamptz;
alter table tasks add column if not exists abandoned_reason text
  check (abandoned_reason is null or char_length(abandoned_reason) between 10 and 2000);

comment on column tasks.abandoned_reason is
  'Why this was set aside. Required when status is abandoned; shown to the team and read by the planner.';

-- An abandoned card must say why. Enforced here rather than only in the API,
-- because a reason nobody gave is a card that looks like a slip afterwards.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_abandoned_has_reason'
  ) then
    alter table tasks
      add constraint tasks_abandoned_has_reason
      check (status <> 'abandoned' or (abandoned_at is not null and abandoned_reason is not null));
  end if;
end $$;

-- projectState reads these on every planning call, and the planner asks for
-- them by workspace. Partial, because almost no task is abandoned.
create index if not exists tasks_abandoned_idx
  on tasks (workspace_id)
  where status = 'abandoned';

-- ─── Stamp abandoned_at where every other lifecycle timestamp is stamped ────
-- record_task_transition already owns this job: it is the BEFORE UPDATE
-- trigger that writes started_at, submitted_at, verified_at and accepted_at,
-- and the reason it does is that a caller who forgets to log a move — or
-- shades one — would quietly corrupt the only honest measurement here. A
-- second trigger writing a sibling column would be a second place to look.
--
-- Recreated in full rather than patched, so this file is readable on its own.
create or replace function record_task_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into task_transitions (workspace_id, task_id, from_status, to_status, actor_id)
    values (new.workspace_id, new.id, old.status, new.status, auth.uid());

    -- First entry into a column wins. Someone who moves a card back to Doing
    -- and forward again has not started the task twice.
    if new.status = 'doing'      and new.started_at   is null then new.started_at   := now(); end if;
    if new.status = 'submitted'  and new.submitted_at is null then new.submitted_at := now(); end if;
    if new.status = 'verified'   and new.verified_at  is null then new.verified_at  := now(); end if;
    if new.status = 'accepted'   and new.accepted_at  is null then new.accepted_at  := now(); end if;

    -- Abandoned is the exception to first-entry-wins, because it describes
    -- the card's current state rather than a milestone it passed. A reopened
    -- task is not abandoned any more, so the stamp goes. The reason is kept:
    -- it is the record of what was tried, and task_transitions already shows
    -- the card came back.
    if new.status = 'abandoned' then
      new.abandoned_at := now();
    elsif old.status = 'abandoned' then
      new.abandoned_at := null;
    end if;
  end if;
  return new;
end;
$$;
