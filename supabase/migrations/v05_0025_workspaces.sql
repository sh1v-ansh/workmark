-- Workspaces: where a project is actually done.
--
-- Everything in this schema so far answers "which student owns this row",
-- and every policy is some form of `auth.uid() = student_id`. That shape
-- cannot express a project two people work on, because a teammate has to
-- read rows they do not own. So this is the first membership-based table,
-- and the pattern it sets is the one every workspace table after it uses.
--
-- Three decisions here exist to keep company accounts an ADDITIVE change
-- later rather than a rewrite:
--
--   1. Membership points at accounts(id), not students(id). Every user has
--      an account row — a company user will too. Keyed on students, adding
--      companies would mean changing the column and every policy that reads
--      it. Keyed on accounts, a company user joining a workspace is a row.
--
--   2. A workspace has two nullable origins. A brief is a student's own
--      project, AI-suggested or their own idea. An engagement is work with
--      a poster. A company-posted project later fills a column that already
--      exists.
--
--   3. listings.poster_type is left alone. It is already polymorphic; later
--      it gains 'organization' in its CHECK, which is one additive line.

create table workspaces (
  id              uuid default gen_random_uuid() primary key,
  title           text not null,
  summary         text,

  -- Exactly one of these is set. Both are nullable and neither is a
  -- required parent, because a workspace outlives what started it: a brief
  -- can be deleted and the record of the work done must not vanish with it.
  brief_id        uuid references project_briefs(id) on delete set null,
  engagement_id   uuid references engagements(id) on delete set null,

  created_by      uuid references accounts(id) on delete cascade not null,
  deadline        date,

  -- Mirrors engagements.stage deliberately, including 'abandoned'. A
  -- workspace that sits at 'active' forever is indistinguishable from one
  -- still genuinely in flight, and the difference is the whole point of
  -- measuring follow-through.
  status          text not null default 'active'
                    check (status in ('active', 'submitted', 'closed', 'abandoned')),

  created_at      timestamptz default now(),
  closed_at       timestamptz,

  constraint workspaces_one_origin check (
    (brief_id is not null and engagement_id is null) or
    (brief_id is null and engagement_id is not null) or
    (brief_id is null and engagement_id is null)
  )
);

create index workspaces_brief_idx      on workspaces (brief_id) where brief_id is not null;
create index workspaces_engagement_idx on workspaces (engagement_id) where engagement_id is not null;

-- ─── Membership ─────────────────────────────────────────────────────────────
-- An invitation and a membership are the same row at different times.
-- Separate tables would mean the same person can hold both, and then
-- "is this person on the team" has two answers.
create table workspace_members (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  account_id    uuid references accounts(id) on delete cascade not null,

  -- Two roles, not five. An owner can invite, remove and close; a member
  -- can do the work. Anything finer than that is a permission system
  -- nobody asked for on a team of three.
  role          text not null default 'member' check (role in ('owner', 'member')),

  invited_by    uuid references accounts(id) on delete set null,
  invited_at    timestamptz default now(),
  -- Null until they accept. Nobody is added to a team without agreeing:
  -- an unaccepted row grants nothing, which is what is_workspace_member
  -- below enforces.
  accepted_at   timestamptz,
  -- Set rather than deleted. Who was on a team and when they left is part
  -- of the record of how the work went.
  removed_at    timestamptz,

  unique (workspace_id, account_id)
);

create index workspace_members_account_idx
  on workspace_members (account_id)
  where accepted_at is not null and removed_at is null;

create index workspace_members_pending_idx
  on workspace_members (account_id)
  where accepted_at is null and removed_at is null;

-- ─── The membership test ────────────────────────────────────────────────────
-- SECURITY DEFINER is not optional here, and not a shortcut.
--
-- The policy on workspace_members has to ask "is the caller a member of this
-- workspace", which means reading workspace_members — and a policy that
-- reads the table it is protecting recurses until Postgres gives up with
-- "infinite recursion detected in policy". A definer function runs as its
-- owner, so the inner read is not itself policed, and the recursion never
-- starts.
--
-- The function is safe to run as its owner because it takes no data from
-- the caller beyond a workspace id and returns only a boolean about
-- auth.uid(). It cannot be used to read anybody's rows.
create or replace function is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
     where workspace_id = p_workspace
       and account_id = auth.uid()
       and accepted_at is not null
       and removed_at is null
  );
$$;

create or replace function is_workspace_owner(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
     where workspace_id = p_workspace
       and account_id = auth.uid()
       and role = 'owner'
       and accepted_at is not null
       and removed_at is null
  );
$$;

-- ─── The creator is a member ────────────────────────────────────────────────
-- A trigger rather than two inserts from the API, because a workspace with
-- no members is unreachable by its own policies — including by the person
-- who just made it. If that ever depends on the second insert succeeding,
-- one failed request leaves an orphan nobody can see or delete.
--
-- Definer for the same reason as above: the members insert policy requires
-- being an owner, and at this instant there is no owner yet.
create or replace function add_workspace_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, account_id, role, accepted_at)
  values (new.id, new.created_by, 'owner', now());
  return new;
end;
$$;

create trigger workspaces_creator_is_owner
  after insert on workspaces
  for each row execute function add_workspace_creator_as_owner();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;

-- ── workspaces ──
create policy "Members: read their workspaces"
  on workspaces for select using (is_workspace_member(id));

-- created_by is pinned to the caller so a workspace cannot be created in
-- somebody else's name — the trigger above would then make THEM the owner
-- and lock the creator out of the row they just made.
create policy "Users: create a workspace"
  on workspaces for insert with check (created_by = auth.uid());

create policy "Owners: update their workspace"
  on workspaces for update using (is_workspace_owner(id)) with check (is_workspace_owner(id));

create policy "Admins: read all workspaces"
  on workspaces for select using (is_admin());

-- ── workspace_members ──
-- A member sees the whole team. An invitee whose row is still pending is
-- not a member yet by the function above, so the second clause is what lets
-- somebody see the invitation they have been sent.
create policy "Members: read the team"
  on workspace_members for select
  using (is_workspace_member(workspace_id) or account_id = auth.uid());

create policy "Owners: invite"
  on workspace_members for insert
  with check (is_workspace_owner(workspace_id) and account_id <> auth.uid());

-- Deliberately two policies rather than one with an OR. An owner managing
-- the team and a person answering their own invitation are different
-- actions, and collapsing them makes it hard to see that a member cannot
-- promote themselves.
create policy "Owners: manage the team"
  on workspace_members for update
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

create policy "Invitees: answer their own invitation"
  on workspace_members for update
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "Admins: read all memberships"
  on workspace_members for select using (is_admin());

-- The role column is the one an invitee must not write while accepting.
-- RLS cannot say "these columns only" — that half is a grant.
revoke update on public.workspace_members from authenticated;
grant update (accepted_at, removed_at) on public.workspace_members to authenticated;

-- Owners change roles through a definer function instead, which checks the
-- caller is an owner and refuses to leave a workspace with none.
create or replace function set_workspace_member_role(
  p_workspace uuid,
  p_account   uuid,
  p_role      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_workspace_owner(p_workspace) then
    raise exception 'Only an owner can change roles.' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'member') then
    raise exception 'Unknown role.' using errcode = '22023';
  end if;

  -- The last owner cannot demote themselves. Without this the workspace
  -- becomes unmanageable: nobody left who can invite, remove or close it.
  if p_role = 'member' and p_account = auth.uid() and (
    select count(*) from workspace_members
     where workspace_id = p_workspace and role = 'owner'
       and accepted_at is not null and removed_at is null
  ) <= 1 then
    raise exception 'A workspace needs at least one owner.' using errcode = '23514';
  end if;

  update workspace_members
     set role = p_role
   where workspace_id = p_workspace and account_id = p_account and removed_at is null;
end;
$$;
