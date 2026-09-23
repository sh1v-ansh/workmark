-- ============================================================
--  WORKMARK MIGRATION v05_0037 — the person who creates a project consents
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  A bug found by walking the whole path end to end, which no unit test could
--  have seen because it lives in the gap between two triggers.
--
--  v05_0026 says "accepting is the consent" and defaults scan_consent_at from
--  accepted_at. But it does that in a BEFORE UPDATE trigger, because it was
--  written for an invitee: their row exists with accepted_at null and is
--  UPDATED when they accept.
--
--  The project's creator never takes that path. add_workspace_creator_as_owner
--  INSERTs their row with accepted_at already set, so the update trigger never
--  fires and their scan_consent_at stays null forever.
--
--  Two things then quietly do not happen for them, and only for them:
--
--    - ingest.ts attributes a commit only to a member with scan_consent_at
--      set, so the creator's own commits land in work_events with a login and
--      no account. Their work is not counted as theirs.
--    - mintWorkspaceEvidence skips a member with no consent, so closing the
--      project puts nothing on their record.
--
--  On a solo project the creator is the only member, so the feature produces
--  exactly nothing — which is the one outcome the whole thing exists to
--  avoid. On a team it is worse in a subtler way: invitees work correctly and
--  the creator silently does not.
-- ============================================================

-- ─── The creator consents by creating ───────────────────────────────────────
-- Same rule v05_0026 already states for invitees, applied to the one path
-- that skipped it. Creating a project, linking your repository to it and
-- doing the work is not an ambiguous act.
create or replace function add_workspace_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, account_id, role, accepted_at, scan_consent_at)
  values (new.id, new.created_by, 'owner', now(), now());
  return new;
end;
$$;

-- ─── And belt-and-braces for every future insert path ───────────────────────
-- The bug was not that somebody wrote the wrong value; it was that one code
-- path did not know it had to write one. A default on INSERT means the next
-- path that creates a membership row cannot reintroduce this, whether or not
-- whoever writes it has read v05_0026.
--
-- Deliberately only defaults a NULL. A caller passing an explicit
-- scan_consent_at keeps it, and a row that is not accepted yet stays
-- unconsented — an invitation is not agreement.
create or replace function default_scan_consent_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.accepted_at is not null and new.scan_consent_at is null then
    new.scan_consent_at := new.accepted_at;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_members_default_consent on workspace_members;
create trigger workspace_members_default_consent
  before insert on workspace_members
  for each row execute function default_scan_consent_on_insert();

-- ─── Everyone this already happened to ──────────────────────────────────────
-- Every project creator to date. Their consent was given by the act of
-- creating the project; only the record of it is missing, and without this
-- backfill their existing work stays unattributed and unrecordable.
update workspace_members
   set scan_consent_at = accepted_at
 where accepted_at is not null
   and scan_consent_at is null
   and removed_at is null;
