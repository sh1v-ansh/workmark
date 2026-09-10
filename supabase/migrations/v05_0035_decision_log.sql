-- ============================================================
--  WORKMARK MIGRATION v05_0035 — every answer, kept
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Workmark decides what goes on a student's record, which makes a dispute a
--  §611 reinvestigation with a 30-day clock, not a support ticket. The whole
--  of `disputes`, `evidence_audit` and `fcra/reinvestigate.ts` exists because
--  of that. Workspace evidence had no equivalent trail.
--
--  The specific hole: task_submissions.verdict is UPDATED in place. The
--  checker writes 'unverifiable', a teammate later writes 'human_verified',
--  and the first answer is gone. For a dispute that is exactly the wrong half
--  to lose — "the checker could not tell, then Priya confirmed it on the 4th"
--  is the story, and the row only remembers the ending.
--
--  Same reasoning as task_transitions, and the same mechanism: a trigger,
--  because a caller that forgets to log a decision — or shades one — corrupts
--  the only record a student has to argue with.
-- ============================================================

create table if not exists task_decisions (
  id             uuid default gen_random_uuid() primary key,
  workspace_id   uuid references workspaces(id) on delete cascade not null,
  task_id        uuid references tasks(id) on delete cascade not null,
  submission_id  uuid references task_submissions(id) on delete cascade not null,

  -- Who decided. 'checker' is the automatic pass; 'person' is a teammate or
  -- staff. Stored rather than inferred from actor_id being null, because
  -- "nobody is recorded" and "a machine decided" are different facts and only
  -- one of them is a bug.
  decided_by     text not null check (decided_by in ('checker', 'person')),
  actor_id       uuid references accounts(id) on delete set null,

  -- The answer, and the one it replaced. Both, so the sequence reads without
  -- having to join the row to itself.
  verdict        text not null,
  previous_verdict text,
  human_verdict  text,

  confidence     numeric(3,2),
  -- The deterministic checks as they stood at that moment. The verdict is a
  -- judgement; these are the facts it sat on, and a dispute argues with the
  -- facts first.
  checks         jsonb,
  note           text,

  -- The model call that produced it, when a model did. agent_calls holds the
  -- full prompt and the parsed output, so this is the link between "your task
  -- was marked needs_work" and the exact text that decided it.
  agent_call_id  uuid references agent_calls(id) on delete set null,

  decided_at     timestamptz default now() not null
);

create index if not exists task_decisions_task_idx
  on task_decisions (task_id, decided_at);
create index if not exists task_decisions_submission_idx
  on task_decisions (submission_id, decided_at);

-- ─── Written by trigger, never by a caller ──────────────────────────────────
-- A decision log the client can write is a decision log the client can
-- invent, and this one is what a student's dispute rests on.
create or replace function record_task_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only a real change. A run that rewrites checks or notes without changing
  -- the answer is not a decision, and a log full of no-ops is a log nobody
  -- reads to the end.
  if new.verdict is distinct from old.verdict
     or new.human_verdict is distinct from old.human_verdict then
    insert into task_decisions (
      workspace_id, task_id, submission_id,
      decided_by, actor_id,
      verdict, previous_verdict, human_verdict,
      confidence, checks, note, agent_call_id
    )
    values (
      new.workspace_id, new.task_id, new.id,
      -- A human_verdict appearing is the one unambiguous sign a person
      -- answered. Everything else on this table is written by the run.
      case when new.human_verdict is distinct from old.human_verdict then 'person' else 'checker' end,
      new.human_actor_id,
      new.verdict, old.verdict, new.human_verdict,
      new.confidence, new.checks, new.notes, new.agent_call_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists task_submissions_record_decision on task_submissions;
create trigger task_submissions_record_decision
  after update on task_submissions
  for each row execute function record_task_decision();

-- The first answer on a submission is a decision too. Without this the log
-- starts at the first *change*, and a task settled correctly on the first
-- pass would have no entry at all.
create or replace function record_first_task_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into task_decisions (
    workspace_id, task_id, submission_id,
    decided_by, actor_id,
    verdict, previous_verdict, human_verdict,
    confidence, checks, note, agent_call_id
  )
  values (
    new.workspace_id, new.task_id, new.id,
    'checker', null,
    new.verdict, null, new.human_verdict,
    new.confidence, new.checks, new.notes, new.agent_call_id
  );
  return new;
end;
$$;

drop trigger if exists task_submissions_record_first on task_submissions;
create trigger task_submissions_record_first
  after insert on task_submissions
  for each row execute function record_first_task_decision();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table task_decisions enable row level security;

-- Read-only to members, and to nobody else. There is deliberately no insert,
-- update or delete policy: the triggers run as definer and are the only
-- writer. A student can read the full history of every answer about their own
-- work, which is the point — a dispute you cannot see the basis of is one you
-- cannot make.
create policy "Members: read decisions"
  on task_decisions for select using (is_workspace_member(workspace_id));

create policy "Admins: read decisions"
  on task_decisions for select using (is_admin());
