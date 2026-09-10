-- Five corrections, all from how the feature actually works rather than how
-- I first guessed it did.

-- ─── 1. Where the idea came from is not structural ──────────────────────────
-- A project is a project. Whether the idea was AI-suggested, the student's
-- own, or a posting somebody was hired onto changes nothing about how the
-- workspace behaves — the only structural fact is whether one person is
-- doing it or several. brief_id and listing_id stay as plain provenance
-- links, useful for "where did this come from" and nothing else.
alter table workspaces drop column if exists origin;

-- ─── 2. A project is drafted before it starts ───────────────────────────────
-- Name and summary first, then a repo and the people, and only then does it
-- begin. A workspace that is born active has no state in which it is being
-- set up, so there is nowhere to put a half-finished project.
alter table workspaces drop constraint if exists workspaces_status_check;
alter table workspaces add constraint workspaces_status_check
  check (status in ('draft', 'active', 'submitted', 'closed', 'abandoned'));
alter table workspaces alter column status set default 'draft';

alter table workspaces add column started_at timestamptz;

-- The repo is what makes a project real: without one there is nothing to
-- read, nothing to attribute, and no evidence at the end. So it is a
-- condition of starting rather than a prompt somebody can dismiss.
create or replace function require_repo_before_starting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and old.status = 'draft' then
    if not exists (
      select 1 from workspace_repos
       where workspace_id = new.id and unlinked_at is null
    ) then
      raise exception 'Attach a GitHub repository before starting the project.'
        using errcode = '23514';
    end if;
    if new.started_at is null then new.started_at := now(); end if;
  end if;
  return new;
end;
$$;

create trigger workspaces_require_repo
  before update on workspaces
  for each row execute function require_repo_before_starting();

-- ─── 3. Two different kinds of role ─────────────────────────────────────────
-- `role` is permission: who may manage the project. This is the other kind —
-- what someone actually does, agreed between the students themselves. The
-- planner reads it to assign each task to the right person, and anybody can
-- reassign afterwards. Not exclusive: two people can both be backend, and
-- fullstack matches everything.
alter table workspace_members add column work_role text
  check (work_role is null or work_role in (
    'backend', 'frontend', 'fullstack', 'mobile',
    'data', 'ml', 'infra', 'design', 'other'));

-- What kind of person this task wants. The planner sets it; assignment is
-- then a lookup rather than a guess, and a task with no match stays
-- unassigned instead of landing on whoever happens to be first.
alter table tasks add column suggested_role text
  check (suggested_role is null or suggested_role in (
    'backend', 'frontend', 'fullstack', 'mobile',
    'data', 'ml', 'infra', 'design', 'other'));

grant update (accepted_at, removed_at, scan_consent_at, work_role)
  on public.workspace_members to authenticated;

-- ─── 4. Removing somebody ───────────────────────────────────────────────────
-- These are peers, not employees. "The owner can remove you" is the wrong
-- rule between students, and it is also the rule most open to abuse: the
-- person who created the project could drop a teammate the day before it
-- closes and keep the work.
--
-- So it depends on whether they have actually done anything:
--
--   leaving           always allowed, by anybody, no permission needed
--   never contributed an owner may remove them, with a reason on the record
--   has contributed   needs a majority of the OTHER members to agree
--
-- And removal never erases evidence. Whatever they finished stays theirs and
-- stays on their record; being removed is a fact that gets recorded, not a
-- deletion.
alter table workspace_members add column removed_by uuid references accounts(id) on delete set null;
alter table workspace_members add column removed_reason text;

-- "Contributed" is deliberately generous: one verified task or one commit.
-- The bar is not "pulled their weight", it is "did anything at all", because
-- this only exists to separate someone who vanished from someone who is
-- merely slower than their teammates would like.
create or replace function member_has_contributed(p_workspace uuid, p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tasks
     where workspace_id = p_workspace
       and assignee_id = p_account
       and status in ('verified', 'accepted')
  ) or exists (
    select 1 from work_events
     where workspace_id = p_workspace
       and author_account_id = p_account
  );
$$;

create table workspace_removal_requests (
  id                uuid default gen_random_uuid() primary key,
  workspace_id      uuid references workspaces(id) on delete cascade not null,
  target_account_id uuid references accounts(id) on delete cascade not null,
  requested_by      uuid references accounts(id) on delete set null,
  reason            text not null check (char_length(reason) between 10 and 2000),
  created_at        timestamptz default now(),
  resolved_at       timestamptz,
  outcome           text check (outcome is null or outcome in ('approved', 'withdrawn', 'expired'))
);

create unique index workspace_removal_open_idx
  on workspace_removal_requests (workspace_id, target_account_id)
  where resolved_at is null;

create table workspace_removal_approvals (
  id          uuid default gen_random_uuid() primary key,
  request_id  uuid references workspace_removal_requests(id) on delete cascade not null,
  account_id  uuid references accounts(id) on delete cascade not null,
  approved_at timestamptz default now(),
  unique (request_id, account_id)
);

alter table workspace_removal_requests  enable row level security;
alter table workspace_removal_approvals enable row level security;

-- The person being removed can see the request and the reason. Being voted
-- out of a project without being told why is not something to build.
create policy "Members: read removal requests"
  on workspace_removal_requests for select
  using (is_workspace_member(workspace_id) or target_account_id = auth.uid());
create policy "Members: open a removal request"
  on workspace_removal_requests for insert
  with check (is_workspace_member(workspace_id) and requested_by = auth.uid()
              and target_account_id <> auth.uid());

create policy "Members: read approvals"
  on workspace_removal_approvals for select
  using (exists (select 1 from workspace_removal_requests r
                  where r.id = request_id and is_workspace_member(r.workspace_id)));
create policy "Members: approve"
  on workspace_removal_approvals for insert
  with check (account_id = auth.uid()
              and exists (select 1 from workspace_removal_requests r
                           where r.id = request_id
                             and is_workspace_member(r.workspace_id)
                             and r.target_account_id <> auth.uid()
                             and r.resolved_at is null));

/**
 * Leave, or remove somebody who never contributed.
 *
 * A contributor cannot be removed here at all — that path goes through a
 * request and a vote, which is the whole point of the split.
 */
create or replace function remove_workspace_member(
  p_workspace uuid,
  p_account   uuid,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_self boolean := (p_account = auth.uid());
begin
  if not is_workspace_member(p_workspace) then
    raise exception 'You are not on this project.' using errcode = '42501';
  end if;

  -- The last owner cannot walk out and leave a project nobody can manage.
  if (select role from workspace_members
       where workspace_id = p_workspace and account_id = p_account
         and accepted_at is not null and removed_at is null) = 'owner'
     and (select count(*) from workspace_members
           where workspace_id = p_workspace and role = 'owner'
             and accepted_at is not null and removed_at is null) <= 1 then
    raise exception 'A project needs at least one owner — make someone else an owner first.'
      using errcode = '23514';
  end if;

  if not v_is_self then
    if not is_workspace_owner(p_workspace) then
      raise exception 'Only an owner can remove someone.' using errcode = '42501';
    end if;
    if member_has_contributed(p_workspace, p_account) then
      raise exception 'This person has contributed work. Open a removal request so the team can agree.'
        using errcode = '42501';
    end if;
    if p_reason is null or char_length(p_reason) < 10 then
      raise exception 'Give a reason for removing someone.' using errcode = '22023';
    end if;
  end if;

  update workspace_members
     set removed_at = now(),
         removed_by = auth.uid(),
         removed_reason = case when v_is_self then 'Left the project' else p_reason end
   where workspace_id = p_workspace and account_id = p_account and removed_at is null;
end;
$$;

/**
 * Carry out a removal once enough of the team agrees.
 *
 * Majority of the OTHER members — the person being removed does not vote,
 * and neither does the count include them. On a team of four that is two of
 * the remaining three.
 */
create or replace function resolve_removal_request(p_request uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_target    uuid;
  v_others    int;
  v_approvals int;
begin
  select workspace_id, target_account_id into v_workspace, v_target
    from workspace_removal_requests where id = p_request and resolved_at is null;
  if v_workspace is null then return false; end if;

  if not is_workspace_member(v_workspace) then
    raise exception 'You are not on this project.' using errcode = '42501';
  end if;

  select count(*) into v_others from workspace_members
   where workspace_id = v_workspace and account_id <> v_target
     and accepted_at is not null and removed_at is null;

  select count(*) into v_approvals from workspace_removal_approvals
   where request_id = p_request;

  if v_approvals * 2 <= v_others then
    return false;  -- not a majority yet
  end if;

  update workspace_members
     set removed_at = now(),
         removed_by = auth.uid(),
         removed_reason = (select reason from workspace_removal_requests where id = p_request)
   where workspace_id = v_workspace and account_id = v_target and removed_at is null;

  update workspace_removal_requests
     set resolved_at = now(), outcome = 'approved'
   where id = p_request;

  return true;
end;
$$;

-- ─── 5. Four people ─────────────────────────────────────────────────────────
-- Pending invitations count. Otherwise an owner sends six and the team
-- quietly exceeds the cap as they trickle in.
create or replace function enforce_workspace_member_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from workspace_members
       where workspace_id = new.workspace_id and removed_at is null) >= 4 then
    raise exception 'A project holds at most 4 people.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger workspace_members_cap
  before insert on workspace_members
  for each row execute function enforce_workspace_member_cap();

-- ─── 6. Verification runs in batches ────────────────────────────────────────
-- Checking each task as it is submitted pays for the expensive part — reading
-- and assembling the repository context — once per task. Ten tasks submitted
-- in a day share almost all of that context, so one run over the batch costs
-- roughly what two separate checks would.
--
-- Submitted tasks therefore wait for a run rather than triggering one.
create table verification_runs (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  -- null when the nightly job started it.
  triggered_by  uuid references accounts(id) on delete set null,
  trigger       text not null default 'scheduled' check (trigger in ('scheduled', 'manual')),
  status        text not null default 'queued'
                  check (status in ('queued', 'running', 'complete', 'failed')),
  task_count    int not null default 0,
  agent_call_id uuid references agent_calls(id) on delete set null,
  error         text,
  queued_at     timestamptz default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index verification_runs_workspace_idx on verification_runs (workspace_id, queued_at desc);
create index verification_runs_pending_idx   on verification_runs (status) where status in ('queued', 'running');

alter table task_submissions add column run_id uuid references verification_runs(id) on delete set null;
create index task_submissions_run_idx on task_submissions (run_id) where run_id is not null;

alter table verification_runs enable row level security;

create policy "Members: read verification runs"
  on verification_runs for select using (is_workspace_member(workspace_id));
-- A member may ask for a check; the job writes the result under the service
-- role, the same way a student may submit but never write a verdict.
create policy "Members: request a check"
  on verification_runs for insert
  with check (is_workspace_member(workspace_id) and triggered_by = auth.uid()
              and trigger = 'manual' and status = 'queued');
