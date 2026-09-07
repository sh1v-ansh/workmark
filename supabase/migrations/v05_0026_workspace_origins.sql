-- Fixing the grain, and giving a workspace its repo.
--
-- v05_0025 linked a workspace to an engagement. That was the wrong level.
-- An engagement is one row per accepted application — the poster's
-- relationship with ONE student — so a listing with three hires makes three
-- engagements. A team workspace is one project with several people, which is
-- the grain of the listing.
--
-- The engagement still matters, just per person: it is where close-out and
-- verified skills attach for that student. So it moves to the membership row.
--
-- Destructive only in the sense that a column is dropped. There is no data —
-- 0025 shipped hours ago and nothing writes to these tables yet.

alter table workspaces drop constraint if exists workspaces_one_origin;
alter table workspaces drop column if exists engagement_id;

alter table workspaces add column listing_id uuid references listings(id) on delete set null;

-- How this project started, recorded once and never recalculated.
--
-- Deliberately NOT derived from which foreign key is null, for two reasons.
-- A self-started project — a student connecting a repo of something they are
-- already building — has no parent row at all, so "both null" is a real
-- state rather than a missing link. And both FKs are ON DELETE SET NULL, so
-- a deleted brief would silently rewrite the history of how the work began.
alter table workspaces add column origin text not null default 'self'
  check (origin in ('self', 'brief', 'listing'));

-- The only combination that is never legitimate. A workspace cannot be both
-- somebody's private brief and a posted job at the same time.
alter table workspaces add constraint workspaces_single_parent
  check (not (brief_id is not null and listing_id is not null));

create index workspaces_listing_idx on workspaces (listing_id) where listing_id is not null;

-- ─── The member's own engagement ────────────────────────────────────────────
alter table workspace_members
  add column engagement_id uuid references engagements(id) on delete set null;

-- Consent to having their commits read, recorded per member rather than per
-- repo. One person grants the repo; everyone whose code is in it has to
-- agree separately. Without this a student could join a team and have their
-- work scanned on somebody else's say-so.
alter table workspace_members add column scan_consent_at timestamptz;

-- ─── The repo belongs to the workspace ──────────────────────────────────────
-- github_repo_grants is per student, which is right for a personal record and
-- wrong for a team: one repo, several contributors, and only the owner has
-- installed the App on it. The workspace holds the repo; contributions are
-- attributed back to people by commit author.
create table workspace_repos (
  id              uuid default gen_random_uuid() primary key,
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  repo_full_name  text not null,
  -- Copied from the grant at link time so a scan does not have to work out
  -- whose installation to read through on every run.
  installation_id text,
  granted_by      uuid references accounts(id) on delete set null,
  linked_at       timestamptz default now(),
  unlinked_at     timestamptz,
  unique (workspace_id, repo_full_name)
);

create index workspace_repos_active_idx
  on workspace_repos (workspace_id) where unlinked_at is null;

alter table workspace_repos enable row level security;

create policy "Members: read workspace repos"
  on workspace_repos for select using (is_workspace_member(workspace_id));
create policy "Owners: link a repo"
  on workspace_repos for insert with check (is_workspace_owner(workspace_id));
create policy "Owners: unlink a repo"
  on workspace_repos for update
  using (is_workspace_owner(workspace_id)) with check (is_workspace_owner(workspace_id));

-- ─── GitHub is required before joining a team ───────────────────────────────
-- Someone whose commits cannot be attributed would do a whole project and
-- generate evidence for everybody except themselves. Better to stop at the
-- door than explain it afterwards.
--
-- Scoped narrowly to accepting an INVITATION. A workspace creator and a hired
-- student arrive with accepted_at already set, and both are checked in the
-- API where the message can be useful ("connect GitHub to apply") rather than
-- as an exception in the middle of somebody else's accept.
create or replace function require_github_before_accepting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.accepted_at is not null and old.accepted_at is null then
    if not exists (select 1 from github_connections where student_id = new.account_id) then
      raise exception 'Connect your GitHub account before joining a project.'
        using errcode = '42501';
    end if;
    -- Accepting is the consent. Recorded as its own timestamp because
    -- "when did they agree to be scanned" is a different question from
    -- "when did they join", even when the answers match today.
    if new.scan_consent_at is null then
      new.scan_consent_at := new.accepted_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger workspace_members_require_github
  before update on workspace_members
  for each row execute function require_github_before_accepting();

grant update (accepted_at, removed_at, scan_consent_at) on public.workspace_members to authenticated;

-- ─── A hire lands in the workspace automatically ────────────────────────────
-- An accepted application with no workspace is a dead end, and a second
-- explicit step is one the poster forgets. The first hire creates the
-- workspace; later hires join the one that exists.
create or replace function attach_engagement_to_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_title     text;
begin
  select id into v_workspace from workspaces where listing_id = new.listing_id limit 1;

  if v_workspace is null then
    select title into v_title from listings where id = new.listing_id;
    insert into workspaces (title, listing_id, origin, created_by)
    values (coalesce(v_title, 'Project'), new.listing_id, 'listing', new.poster_id)
    returning id into v_workspace;
    -- workspaces_creator_is_owner has now made the poster an owner.
  end if;

  -- accepted_at is set outright: they applied and were hired, which is the
  -- agreement. There is no second invitation to answer.
  insert into workspace_members (workspace_id, account_id, role, engagement_id, invited_by, accepted_at, scan_consent_at)
  values (v_workspace, new.student_id, 'member', new.id, new.poster_id, now(), now())
  on conflict (workspace_id, account_id)
    do update set engagement_id = excluded.engagement_id, removed_at = null;

  return new;
end;
$$;

create trigger engagements_join_workspace
  after insert on engagements
  for each row execute function attach_engagement_to_workspace();
