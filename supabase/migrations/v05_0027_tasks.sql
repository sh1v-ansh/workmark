-- Sprints, tasks, and the record of how the plan changed.
--
-- The single most valuable thing this schema can capture is the gap between
-- what somebody expected and what happened. That only becomes answerable if
-- change is RECORDED rather than overwritten: an estimate edited in place
-- destroys the fact that it was ever different, and "they saw the slip
-- coming, said so early and renegotiated" — the behaviour worth more to an
-- employer than hitting the original date — becomes invisible.
--
-- Hence three tables where one would do: tasks holds the current state,
-- task_revisions holds every deliberate change to the plan, task_transitions
-- holds every move across the board. Estimate-versus-actual then falls out of
-- the timestamps and nobody is ever asked how long something took.
--
-- Every table here carries workspace_id directly, even where it could be
-- reached by joining through tasks. That denormalisation is on purpose: an
-- RLS policy runs per row, and a policy containing a subquery is the usual
-- reason a Supabase table gets slow. One column buys a policy that is a
-- single indexed function call.

create table sprints (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  name          text not null,
  goal          text,
  starts_on     date not null,
  ends_on       date not null,
  created_at    timestamptz default now(),
  check (ends_on >= starts_on)
);

create index sprints_workspace_idx on sprints (workspace_id, starts_on desc);

-- Sprints are optional by design. A two-person project does not need
-- ceremony, and a mandatory sprint is a form to fill in before any work can
-- begin — which is how a planning tool becomes the thing people avoid.

create table tasks (
  id                  uuid default gen_random_uuid() primary key,
  workspace_id        uuid references workspaces(id) on delete cascade not null,
  sprint_id           uuid references sprints(id) on delete set null,
  -- Subtasks are tasks. A separate table would mean two places to look for
  -- "what is assigned to me" and two answers to "is this done".
  parent_task_id      uuid references tasks(id) on delete cascade,

  title               text not null,
  detail              text,
  -- What "done" means for this task, written before it starts. The
  -- verification engine compares evidence against this and nothing else.
  acceptance_criteria text,

  status              text not null default 'backlog'
                        check (status in ('backlog', 'planned', 'doing', 'submitted', 'verified', 'accepted')),

  assignee_id         uuid references accounts(id) on delete set null,

  -- ── The plan ──
  estimate_hours      numeric(5,2) check (estimate_hours is null or estimate_hours > 0),
  difficulty          int check (difficulty is null or difficulty between 1 and 10),
  priority            text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_on              date,

  -- Who wrote this task. The distinction is itself evidence: whether a
  -- student accepts an AI plan wholesale, edits it, or writes their own says
  -- more about them than whether the tasks got done.
  origin              text not null default 'student_created'
                        check (origin in ('ai_proposed', 'ai_edited', 'student_created')),

  -- Design work, research, talking to a user. False means the verifier must
  -- never look for commits — otherwise it fails honest work for having no
  -- code, which reads as an insult rather than a bug.
  verifiable          boolean not null default true,

  -- Fractional so a card can be dropped between two others without
  -- renumbering the column.
  position            numeric not null default 0,

  -- ── Blocked ──
  -- A status flag rather than a board column: a blocked task is still in
  -- Doing, and moving it elsewhere loses where it actually was.
  blocked_at          timestamptz,
  blocked_reason      text,

  created_by          uuid references accounts(id) on delete set null,
  created_at          timestamptz default now(),
  -- Stamped by trigger on the matching transition, never by the client.
  started_at          timestamptz,
  submitted_at        timestamptz,
  verified_at         timestamptz,
  accepted_at         timestamptz,

  -- A task cannot be its own parent. Deeper cycles are prevented in the API;
  -- this catches the one that happens by accident.
  check (parent_task_id is null or parent_task_id <> id)
);

create index tasks_board_idx    on tasks (workspace_id, status, position);
create index tasks_assignee_idx on tasks (assignee_id) where assignee_id is not null;
create index tasks_sprint_idx   on tasks (sprint_id) where sprint_id is not null;
create index tasks_parent_idx   on tasks (parent_task_id) where parent_task_id is not null;
create index tasks_blocked_idx  on tasks (workspace_id) where blocked_at is not null;

-- ─── Dependencies ───────────────────────────────────────────────────────────
create table task_dependencies (
  id              uuid default gen_random_uuid() primary key,
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  task_id         uuid references tasks(id) on delete cascade not null,
  depends_on_id   uuid references tasks(id) on delete cascade not null,
  created_at      timestamptz default now(),
  unique (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create index task_dependencies_task_idx on task_dependencies (task_id);

-- ─── Every deliberate change to the plan ────────────────────────────────────
create table task_revisions (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  task_id       uuid references tasks(id) on delete cascade not null,
  field         text not null check (field in (
                  'title', 'acceptance_criteria', 'estimate_hours', 'difficulty',
                  'due_on', 'assignee_id', 'sprint_id', 'priority')),
  old_value     text,
  new_value     text,
  -- Optional, and the most valuable column in the table when it is filled
  -- in. "The external API turned out to be rate limited" is the difference
  -- between a bad estimate and a discovered constraint.
  reason        text,
  changed_by    uuid references accounts(id) on delete set null,
  changed_at    timestamptz default now()
);

create index task_revisions_task_idx on task_revisions (task_id, changed_at);

-- ─── Every move across the board ────────────────────────────────────────────
create table task_transitions (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  task_id       uuid references tasks(id) on delete cascade not null,
  from_status   text,
  to_status     text not null,
  actor_id      uuid references accounts(id) on delete set null,
  occurred_at   timestamptz default now()
);

create index task_transitions_task_idx on task_transitions (task_id, occurred_at);

-- Written by the database, not by the client. Time-in-column is the basis of
-- estimate-versus-actual, so a caller that forgets to log a move — or shades
-- one — would quietly corrupt the only honest measurement here.
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
  end if;
  return new;
end;
$$;

create trigger tasks_record_transition
  before update on tasks
  for each row execute function record_task_transition();

create or replace function record_task_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into task_transitions (workspace_id, task_id, from_status, to_status, actor_id)
  values (new.workspace_id, new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger tasks_record_creation
  after insert on tasks
  for each row execute function record_task_creation();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table sprints            enable row level security;
alter table tasks              enable row level security;
alter table task_dependencies  enable row level security;
alter table task_revisions     enable row level security;
alter table task_transitions   enable row level security;

-- Anyone on the team may plan, write and move work. The finer permission
-- system — who may edit whose task — is a thing to add when a real team asks
-- for it, not to guess at now.
create policy "Members: read sprints"   on sprints for select using (is_workspace_member(workspace_id));
create policy "Members: write sprints"  on sprints for insert with check (is_workspace_member(workspace_id));
create policy "Members: update sprints" on sprints for update
  using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
create policy "Owners: delete sprints"  on sprints for delete using (is_workspace_owner(workspace_id));

create policy "Members: read tasks"   on tasks for select using (is_workspace_member(workspace_id));
create policy "Members: create tasks" on tasks for insert with check (is_workspace_member(workspace_id));
create policy "Members: update tasks" on tasks for update
  using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
create policy "Members: delete tasks" on tasks for delete using (is_workspace_member(workspace_id));

create policy "Members: read dependencies"   on task_dependencies for select using (is_workspace_member(workspace_id));
create policy "Members: write dependencies"  on task_dependencies for insert with check (is_workspace_member(workspace_id));
create policy "Members: delete dependencies" on task_dependencies for delete using (is_workspace_member(workspace_id));

-- Insert-and-read only. A history that can be edited is not a history, and
-- the entire argument for these two tables is that they cannot be rewritten
-- after the fact.
create policy "Members: read revisions"  on task_revisions for select using (is_workspace_member(workspace_id));
create policy "Members: write revisions" on task_revisions for insert with check (is_workspace_member(workspace_id));

create policy "Members: read transitions" on task_transitions for select using (is_workspace_member(workspace_id));

create policy "Admins: read tasks"       on tasks for select using (is_admin());
create policy "Admins: read transitions" on task_transitions for select using (is_admin());
