-- ============================================================
--  WORKMARK MIGRATION v05_0042 — remember who was skipped, and why
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Closing a project mints evidence for everyone on it and skips whoever it
--  cannot mint for. The reasons were computed per member, returned in the
--  close response, and then thrown away — so a project stamped
--  evidence_minted_at is never revisited, whatever the reason was.
--
--  Two of the three reasons can stop being true:
--
--    - no_consent — they can agree afterwards
--    - no_github_username — they can connect GitHub afterwards
--
--  Both are things a student does on their own account, days later, with no
--  idea that a closed project is waiting on it. Today that work is simply
--  never recorded, silently, and the student has no way to find out.
--
--  The third, no_verified_work, cannot change: the project is closed and no
--  further task will be verified. Stored all the same, because "you finished
--  nothing on this one" is a fair thing to be able to show somebody asking
--  why a project produced nothing.
-- ============================================================

-- ─── Per member, because minting is per member ──────────────────────────────
-- workspaces.evidence_minted_at answers "did the slow half finish" for the
-- project as a whole, which is the right question for the close/mint split it
-- was built for. It cannot answer "is anybody still owed", and overloading it
-- would conflate a project that minted for everyone with one that minted for
-- two people out of four.
alter table workspace_members
  add column if not exists evidence_minted_at   timestamptz,
  add column if not exists evidence_skip_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_skip_reason_check'
  ) then
    alter table workspace_members
      add constraint workspace_members_skip_reason_check
      check (evidence_skip_reason is null or evidence_skip_reason in
        ('no_verified_work', 'no_consent', 'no_github_username'));
  end if;
end $$;

comment on column workspace_members.evidence_skip_reason is
  'Why this member got no evidence when the project closed. Null means they were minted for, or the project has not closed.';

-- The nightly retry asks exactly this: closed projects with members skipped
-- for a reason that can stop being true. Partial, because on almost every row
-- this column is null.
create index if not exists workspace_members_retryable_idx
  on workspace_members (workspace_id)
  where evidence_skip_reason in ('no_consent', 'no_github_username');

-- ─── Backfill what can be inferred ──────────────────────────────────────────
-- Members of an already-closed project who have no evidence rows from it were
-- skipped; we cannot recover which reason applied at the time, so the current
-- one is written. It is right for the two that matter — a member with no
-- consent today was skipped for no consent then — and where it is wrong the
-- retry simply finds nothing to do.
--
-- Deliberately leaves evidence_skip_reason null where the member does have
-- evidence, so a retry never re-mints for somebody already recorded.
update workspace_members m
   set evidence_skip_reason = case
         when m.scan_consent_at is null then 'no_consent'
         when not exists (
           select 1 from students s
            where s.id = m.account_id and s.github_username is not null
         ) then 'no_github_username'
         else 'no_verified_work'
       end
 where m.removed_at is null
   and m.accepted_at is not null
   and m.evidence_skip_reason is null
   and m.evidence_minted_at is null
   and exists (
     select 1 from workspaces w
      where w.id = m.workspace_id and w.status = 'closed'
   )
   and not exists (
     select 1 from skill_evidence e
      where e.student_id = m.account_id
        and e.workspace_id = m.workspace_id
        and e.retracted_at is null
   );
