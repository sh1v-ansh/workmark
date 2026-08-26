-- Repo metadata for ranking, and an explicit record of the student's own choice.
--
-- Two problems.
--
-- First, every public repo is auto-enabled for scanning, always. A student
-- with 300 public repos queues 300 scan steps, which is roughly 15,000
-- GitHub requests against a limit of about 5,000 an hour — the scan takes
-- hours and gets rate-limited partway through. The fix is to rank repos and
-- enable a sensible subset, which needs somewhere to keep the facts GitHub
-- already hands us in the repo listing.
--
-- Second, and worse: the sync forces public repos back to scan_enabled every
-- time it runs, so a student who turns one off has it turned back on. There
-- was no way to record "I chose this" as distinct from "the default did
-- this". scan_choice fixes that — null means nobody has expressed a
-- preference and the ranking may decide, anything else is the student's word
-- and is never overwritten.

alter table github_repo_grants
  add column if not exists is_fork      boolean,
  add column if not exists is_archived  boolean,
  add column if not exists size_kb      integer,
  add column if not exists pushed_at    timestamptz,
  add column if not exists created_at_gh timestamptz,
  add column if not exists description  text,
  add column if not exists primary_language text,
  add column if not exists stars        integer,
  add column if not exists has_pages    boolean,
  -- The ranking score, stored so the picker can show its ordering and its
  -- reasons without recomputing.
  add column if not exists rank_score   numeric,
  add column if not exists rank_reason  text,
  -- null  = no preference; ranking decides
  -- 'on'  = the student said scan this, regardless of rank
  -- 'off' = the student said don't, regardless of rank
  add column if not exists scan_choice  text;

alter table github_repo_grants
  drop constraint if exists github_repo_grants_scan_choice_check;
alter table github_repo_grants
  add constraint github_repo_grants_scan_choice_check
  check (scan_choice is null or scan_choice in ('on', 'off'));

-- Existing rows: a private repo already switched on can only have got that
-- way by the student choosing it, so preserve that as an explicit choice
-- rather than letting the new ranking silently turn it off.
update github_repo_grants
   set scan_choice = 'on'
 where is_private = true and scan_enabled = true and scan_choice is null;

create index if not exists github_repo_grants_rank_idx
  on github_repo_grants (student_id, rank_score desc nulls last)
  where revoked_at is null;
