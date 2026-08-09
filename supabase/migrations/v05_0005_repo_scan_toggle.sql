-- ============================================================
--  WORKMARK MIGRATION v05_0005 — per-repo scan opt-in
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  Until now, every repo the GitHub App installation was granted access
--  to got scanned automatically, with no Workmark-side review step beyond
--  GitHub's own "All repositories" vs "Only select repositories" install
--  picker. That's a real problem for private repos that might be an
--  employer's IP — even though we never store file contents, we do store
--  the repo's name and structural metadata, and for a private repo that
--  alone can identify a company a student isn't authorized to disclose.
--
--  is_private/scan_enabled default to true/false — every EXISTING grant
--  row (including ones already scanned) starts as not-yet-reviewed and
--  won't be scanned again until the student explicitly opts it in via the
--  new picker UI. New grants going forward set these explicitly at
--  creation time from GitHub's own `private` flag (public repos default
--  enabled, private default disabled) — see the callback/webhook routes.
-- ============================================================

alter table github_repo_grants
  add column if not exists is_private boolean not null default true,
  add column if not exists scan_enabled boolean not null default false;
