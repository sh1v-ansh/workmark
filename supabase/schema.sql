-- ============================================================
--  WORKMARK DATABASE SCHEMA — v0.5 (Product A to Z, MVP scope)
--  Paste this entire file into Supabase → SQL Editor → Run.
--
--  DESTRUCTIVE: drops every Workmark table and rebuilds from scratch.
--  This is NOT an extension of the old schema — listings/engagements
--  replace projects, applications are restructured, peer_records is gone
--  entirely (Tier 0.5 is scan-derived now, students never attest), and a
--  real skill taxonomy replaces free-text skill arrays.
--
--  Before running this against production: the 4 real students and 1
--  real listing must be exported first (scripts/export-production-data.mjs)
--  and re-inserted afterward (scripts/reinsert-production-data.mjs, once
--  written). auth.users is NOT touched by this file, so those 4 accounts
--  stay valid — only their profile rows need re-inserting.
--
--  MVP scope: student-to-student only. Faculty, businesses, payments,
--  and attestation are later phases — see inline notes marked DEFERRED.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ─── Destructive teardown ─────────────────────────────────────────────────────

drop table if exists agent_calls           cascade;
drop table if exists fit_tier_impressions  cascade;
drop table if exists project_briefs        cascade;
drop table if exists evidence_audit        cascade;
drop table if exists disclosure_log        cascade;
drop table if exists consents              cascade;
drop table if exists outcomes              cascade;
drop table if exists platform_signals      cascade;
drop table if exists skill_evidence        cascade;
drop table if exists artifact_signals      cascade;
drop table if exists artifacts             cascade;
drop table if exists github_repo_grants    cascade;
drop table if exists github_connections    cascade;
drop table if exists engagements           cascade;
drop table if exists contact_shares        cascade;
drop table if exists application_messages  cascade;
drop table if exists applications          cascade;
drop table if exists listing_requirements  cascade;
drop table if exists listings              cascade;
drop table if exists skill_priors          cascade;
drop table if exists skill_aliases         cascade;
drop table if exists skill_calibration     cascade;
drop table if exists skills                cascade;
drop table if exists students              cascade;

-- Legacy tables from prior schema versions — dropped if present.
drop table if exists peer_records          cascade;
drop table if exists verified_work_records cascade;
drop table if exists experience_records    cascade;
drop table if exists github_evidenced_skills cascade;
drop table if exists github_repo_profiles  cascade;
drop table if exists employer_profiles     cascade;
drop table if exists milestones            cascade;
drop table if exists issue_flags           cascade;
drop table if exists companies             cascade;
drop table if exists faculty               cascade;

drop function if exists sync_application_counters()   cascade;
drop function if exists verified_skills_for(uuid)      cascade;
drop function if exists prevent_evidence_audit_update() cascade;
drop function if exists sync_repeat_hire()             cascade;

-- resumes bucket is not used by this schema version — no application in
-- MVP takes a resume upload (§8: claim + scoped response only). Drop its
-- storage policies if they exist from a prior schema version.
drop policy if exists "Students: upload own resume"          on storage.objects;
drop policy if exists "Students: read own resume"            on storage.objects;
drop policy if exists "Students: update own resume"           on storage.objects;
drop policy if exists "Companies: read any resume in bucket"  on storage.objects;
drop policy if exists "Posters: read any resume in bucket"    on storage.objects;

-- ─── Students ──────────────────────────────────────────────────────────────
-- The only account type in MVP. `poster` in every other table means
-- "a student who posted a listing" — there is no separate identity.

create table students (
  id                        uuid references auth.users on delete cascade primary key,
  full_name                 text,
  university                text,
  major                     text,
  degree_type               text,
  graduation_year           int,
  gpa                       decimal(3,2),
  is_international          boolean default false not null,
  visa_type                 text,
  skills                    text[],  -- self-reported, display only — never feeds tier_weight
  github_url                text,
  github_username           text,
  linkedin_url               text,
  availability               text,
  hours_per_week            int,
  available_from            date,
  open_to_collab             boolean default false not null,  -- opt-in: /students directory
  handle                     text unique,                      -- /p/[handle]
  active_application_count  int default 0 not null,            -- maintained by sync_application_counters()
  -- .edu verifies student status once, at signup, then is never required
  -- again — .edu addresses expire at graduation, so the login email can
  -- change freely afterward via Supabase's normal email-change flow. This
  -- pair is the permanent record of how the account was verified.
  edu_domain                 text,
  edu_verified_at            timestamptz,
  created_at                 timestamptz default now()
);

-- ─── Skill taxonomy ────────────────────────────────────────────────────────
-- id is a stable text slug, not a uuid — see supabase/seed_skills_taxonomy.sql
-- for why. This is a fixed, hand-authored vocabulary, not user-generated rows.

-- deprecated_at / merged_into_id exist because taxonomy drift is guaranteed,
-- not hypothetical — the first real listing on the platform already
-- references nine skills this taxonomy doesn't have. Skills are never
-- deleted (skill_evidence FKs would block it, and deleting would silently
-- erase someone's history); they're soft-deprecated, optionally pointing at
-- the node they were merged into so old evidence stays readable.
create table skills (
  id              text primary key,
  canonical_name  text not null,
  parent_id       text references skills(id),
  embedding       vector(1024),  -- voyage-4, default output_dimension
  deprecated_at   timestamptz,
  merged_into_id  text references skills(id)
);

-- Records when a skill crossed the N=30 threshold and switched from
-- absolute difficulty bands to percentile-within-skill (§5). Without this
-- row you cannot explain why a student's level moved when they did no new
-- work — which is exactly the kind of unexplained change an FCRA dispute
-- is about. The switch event is not reconstructible after the fact.
create table skill_calibration (
  skill_id                text references skills(id) primary key,
  method                  text not null default 'absolute_bands' check (method in ('absolute_bands', 'percentile')),
  student_count_at_switch int,
  switched_at             timestamptz
);

-- Free-text input → canonical skill, cached. "ReactJS" / "react 18" /
-- "frontend React" all resolve here as a hash lookup after the first time
-- any of them is embedded — canonicalization should almost never re-embed
-- in steady state.
create table skill_aliases (
  raw_string   text primary key,
  skill_id     text references skills(id) not null,
  resolved_at  timestamptz default now()
);

-- Raw GitHub scan results — a claim, not evidence. Never summed into
-- tier_weight (§6). Promoted to skill_evidence only once proof-it-runs
-- succeeds (§3).
create table skill_priors (
  id               uuid default gen_random_uuid() primary key,
  student_id       uuid references students(id) on delete cascade not null,
  skill_id         text references skills(id) not null,
  raw_scan_score   numeric,
  source           text not null,  -- e.g. 'github_manifest'
  extracted_at     timestamptz default now(),
  unique (student_id, skill_id)
);

-- ─── Listings ──────────────────────────────────────────────────────────────
-- Replaces `projects`. poster_id has no FK (polymorphic — student today,
-- company/faculty later, same pattern the old `projects` table used).
-- poster_type and tier are narrowed to MVP's only real values via CHECK;
-- widening later (ALTER ... DROP/ADD CONSTRAINT) is a cheap, non-destructive
-- migration when Tier 1+ arrives.

create table listings (
  id                      uuid default gen_random_uuid() primary key,
  poster_id               uuid not null,
  -- 'company' is deliberately absent: businesses need domain verification,
  -- permissible-purpose certification and payments before their first
  -- listing, and having the value would let one exist before any of that.
  poster_type             text not null default 'student' check (poster_type in ('student', 'faculty')),
  poster_display_name     text,
  title                   text,
  brief                   text,
  est_hours               int,
  hours_per_week          int,
  duration                text,
  work_mode               text,
  team_size               int,
  declared_difficulty     int check (declared_difficulty between 1 and 10),
  requires_prior_evidence boolean default false not null,
  is_paid                 boolean default false not null check (is_paid = false), -- MVP: no payments infra exists yet
  tier                    text not null default 'listing_driven' check (tier in ('listing_driven', 'faculty_project')),
  status                  text not null default 'open' check (status in ('draft', 'open', 'filled', 'closed')),
  view_count              int default 0 not null,
  created_at              timestamptz default now()
);

create table listing_requirements (
  listing_id     uuid references listings(id) on delete cascade not null,
  skill_id       text references skills(id) not null,
  required_level int not null check (required_level between 1 and 5),  -- importance weight, NOT a difficulty threshold — see §7
  primary key (listing_id, skill_id)
);

-- ─── Applications ──────────────────────────────────────────────────────────
-- No resume anywhere in this flow (§8) — the applicant's verified profile
-- is the resume. scored_response holds the {none|weak|moderate} per-skill
-- prior Claude emits (§8) — a boundary-case agent output, logged to
-- agent_calls, never itself a decision.

-- fit_tier_at_apply / rank_score_at_apply / computed_snapshot together
-- freeze what the matching engine actually saw at submission time. Depth is
-- a moving target — it accumulates with every new artifact and decays with
-- recency — so "why was I ranked third on March 3rd" is unanswerable a month
-- later unless the inputs are snapshotted at the moment of the decision.
-- Required for FCRA dispute reinvestigation, and it's also the baseline the
-- §17 falsification test needs (GPA at apply time, not GPA today).
--
-- consent_id makes the consent chain explicit rather than inferring it from
-- timestamp proximity. FCRA asks "did the student consent to this specific
-- disclosure" — a foreign key answers that; a nearby timestamp doesn't.
create table applications (
  id                 uuid default gen_random_uuid() primary key,
  listing_id         uuid references listings(id) on delete cascade not null,
  student_id         uuid references students(id) on delete cascade not null,
  consent_id         uuid,  -- FK added after consents is created (circular declaration order)
  claimed_skills     text[],
  response_text      text,
  scored_response    jsonb,
  fit_tier_at_apply  text check (fit_tier_at_apply in ('strong_fit', 'competitive', 'reach', 'not_yet')),
  rank_score_at_apply numeric,
  computed_snapshot  jsonb,  -- per-skill depth values, missing skills, gpa, track record — as of submission
  status             text default 'submitted' not null check (status in ('submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  -- When the poster actually answered. Without this a rejection leaves no
  -- trace of when it happened, so neither "how fast do posters reply" nor
  -- "how long has this person been waiting" can be answered.
  decided_at         timestamptz,
  created_at         timestamptz default now(),
  unique (listing_id, student_id)
);

-- Pre-accept Q&A. Capped so it can't become the overwhelm the product
-- exists to eliminate — the char cap is enforced here; the "3 messages
-- per side before acceptance" cap is enforced via RLS (see policies).
create table application_messages (
  id             uuid default gen_random_uuid() primary key,
  application_id uuid references applications(id) on delete cascade not null,
  sender_id      uuid not null,
  body           text not null check (char_length(body) <= 500),
  created_at     timestamptz default now()
);

-- Real contact info exchanged directly on accept — kept exactly as before.
-- Populated by a service-role API route (real emails come from auth.users,
-- which RLS can't see), never inserted by authenticated users directly.
create table contact_shares (
  id             uuid default gen_random_uuid() primary key,
  application_id uuid references applications(id) on delete cascade not null unique,
  student_id     uuid references students(id) on delete cascade not null,
  poster_id      uuid not null,
  student_email  text,
  poster_email   text,
  shared_at      timestamptz default now()
);

-- ─── Engagements ───────────────────────────────────────────────────────────
-- The listing/engagement split this schema makes: `listings.status`
-- describes the state of the advertisement, `engagements.stage` describes
-- the state of the work. One listing has at most one accepted application
-- in MVP (team_size > 1 is descriptive only for now, not enforced).

create table engagements (
  id                                  uuid default gen_random_uuid() primary key,
  application_id                      uuid references applications(id) on delete cascade not null unique,
  listing_id                          uuid references listings(id) on delete cascade not null,
  poster_id                           uuid not null,
  student_id                          uuid references students(id) on delete cascade not null,
  -- 'abandoned' is load-bearing, not a nicety: close_out_rate (§6 track
  -- record) is uncomputable without a terminal non-completion state, and
  -- an engagement that silently sits at 'in_progress' forever is
  -- indistinguishable from one still genuinely in flight. It's also the
  -- only source of negative variance in the dataset — positive-only
  -- evidence otherwise gives a future IRT model nothing to fit against.
  stage                               text default 'accepted' not null check (stage in ('accepted', 'in_progress', 'submitted', 'closed', 'abandoned')),
  abandoned_at                        timestamptz,
  opened_at                           timestamptz default now(),
  submitted_at                        timestamptz,
  closed_at                           timestamptz,
  description                         text,
  description_agreed_by_student_at    timestamptz,
  description_agreed_by_poster_at     timestamptz,
  -- full: shown normally. redacted: counts toward evidence/track record,
  -- poster identity + brief suppressed, displays as "confidential
  -- engagement". hidden: a threshold, not a highlight reel — total
  -- engagement count is never displayed, so an employer/viewer has no way
  -- to detect that anything was hidden. Comparative anchors (once
  -- attestation exists) never display per engagement regardless of
  -- visibility, for a different reason — see §5.
  visibility                          text default 'full' not null check (visibility in ('full', 'redacted', 'hidden')),
  escrow_intent_id                    text,  -- DEFERRED: populated once payments exist
  created_at                          timestamptz default now()
);

-- ─── GitHub App integration ────────────────────────────────────────────────
-- A GitHub App, not the old OAuth app — installation-scoped, per-repo
-- grants, revocable. Installation tokens are generated on demand from the
-- App's private key; nothing long-lived is stored here.

create table github_connections (
  student_id      uuid references students(id) on delete cascade primary key,
  installation_id text not null,
  github_login    text,
  connected_at    timestamptz default now()
);

create table github_repo_grants (
  id              uuid default gen_random_uuid() primary key,
  student_id      uuid references students(id) on delete cascade not null,
  installation_id text not null,
  repo_full_name  text not null,
  granted_at      timestamptz default now(),
  revoked_at      timestamptz,
  -- GitHub's install picker (All repositories / Only select repositories)
  -- is the only consent point upstream of this — it doesn't distinguish
  -- public from private, and doesn't ask per-repo whether to actually
  -- scan.
  --
  -- These two columns are maintained by syncRepoGrants() (see
  -- src/lib/github/sync-grants.ts), which reads GitHub as the source of
  -- truth on every connect, picker load, and scan: public → scan_enabled
  -- forced true (already world-readable, nothing to withhold), private →
  -- the student's explicit choice, never overwritten by a sync. The
  -- defaults below are only the fail-safe for a row that somehow exists
  -- before its first sync — assume private, assume not-yet-consented.
  is_private      boolean not null default true,
  scan_enabled    boolean not null default false,
  -- The student's own word on this repo, kept separate from scan_enabled
  -- so a sync or a ranking pass can never overwrite it. null means nobody
  -- has expressed a preference and the ranking may decide.
  scan_choice     text check (scan_choice is null or scan_choice in ('on', 'off')),
  -- Facts GitHub returns in the repo listing, stored so a student with
  -- hundreds of repos can have a sensible subset enabled by default
  -- instead of all of them. Ranking on these costs no extra API calls —
  -- they arrive with the listing we already fetch.
  is_fork          boolean,
  is_archived      boolean,
  size_kb          integer,
  pushed_at        timestamptz,
  created_at_gh    timestamptz,
  description      text,
  primary_language text,
  stars            integer,
  has_pages        boolean,
  rank_score       numeric,
  rank_reason      text,
  unique (student_id, repo_full_name)
);

create index github_repo_grants_rank_idx
  on github_repo_grants (student_id, rank_score desc nulls last)
  where revoked_at is null;

-- ─── Artifacts ─────────────────────────────────────────────────────────────
-- engagement_id is nullable: Tier 0/0.5 artifacts are linked directly by a
-- student with no listing involved. Only listing-driven artifacts have one.

create table artifacts (
  id                  uuid default gen_random_uuid() primary key,
  student_id          uuid references students(id) on delete cascade not null,
  engagement_id       uuid references engagements(id) on delete cascade,
  type                text not null check (type in ('repo', 'url', 'file')),
  source              text,
  repo_full_name      text,
  access_grant_id     uuid references github_repo_grants(id),
  tier                text not null check (tier in ('tier_0', 'tier_0_5', 'listing_driven')),
  -- 'repo_link' is the baseline: student explicitly linked this repo via
  -- the GitHub App grant, commits are attributed to them, complexity was
  -- extracted (§5) — that alone is evidence. Deployment isn't required;
  -- most CS work (CLIs, libraries, ML notebooks, systems code) has no live
  -- URL to check. deployment/package/ci are strictly stronger than
  -- repo_link, not an alternate gate — they feed a bonus into complexity
  -- extraction as one more positive signal (§5's "tests and their ratio,
  -- infra config present" list, extended with "has a live deployment"),
  -- not a hard requirement to become evidence at all.
  verification_method text not null default 'repo_link' check (verification_method in ('repo_link', 'deployment', 'package', 'ci', 'human_review')),
  -- The specific URL/package that satisfied proof-it-runs, when present.
  -- Needed to re-verify later (deployments go down), to show a "Live" badge
  -- on /p/[handle], and because "we verified something" without recording
  -- what is not an auditable claim. Null for repo_link-only artifacts.
  deployment_url      text,
  verified_at         timestamptz,
  created_at          timestamptz default now()
);

create table artifact_signals (
  id            uuid default gen_random_uuid() primary key,
  artifact_id   uuid references artifacts(id) on delete cascade not null,
  signal_name   text not null,
  value         text,
  extracted_at  timestamptz default now()
);

-- ─── Skill evidence — the core record, append-only ────────────────────────
-- Never UPDATE a row here (enforced below by trigger, not just convention).
-- A correction is a new row with corrects_evidence_id pointing at the row
-- it supersedes. Queries that compute depth/track record must read only
-- evidence with no newer row pointing at it as the "current" value — see
-- the note above skill_evidence in this file's comments and the matching
-- layer built in Phase 3.
--
-- This is also how the percentile-within-skill bootstrap (§5) is applied:
-- crossing 30 students for a skill doesn't UPDATE existing rows, it INSERTs
-- new evidence rows correcting the old difficulty_cleared values.

create table skill_evidence (
  id                    uuid default gen_random_uuid() primary key,
  student_id            uuid references students(id) on delete cascade not null,
  skill_id              text references skills(id) not null,
  artifact_id           uuid references artifacts(id) on delete cascade,
  engagement_id         uuid references engagements(id) on delete cascade,  -- DEFERRED-populated for attested tiers; denormalized convenience today
  rater_id              uuid,  -- DEFERRED: null until faculty/employer attestation exists
  base                  numeric not null,
  independence          numeric not null default 1.0,  -- DEFERRED: always 1.0 in MVP
  paid                  numeric not null default 1.0,  -- DEFERRED: always 1.0 in MVP
  tier_weight           numeric generated always as (base * independence * paid) stored,
  -- The complexity extraction composite that produced difficulty_cleared
  -- (src/lib/github/complexity.ts). Stored because percentile-within-skill
  -- (§5) needs something to rank a NEW composite against — the
  -- already-bucketed 1-5 value alone carries no ranking information.
  raw_composite         numeric,
  difficulty_cleared    int not null check (difficulty_cleared between 1 and 5),
  -- Copied from artifacts.verification_method at the time this row was
  -- written (denormalized — the artifact's method can later be upgraded,
  -- e.g. a repo gets deployed after the fact, which writes a NEW evidence
  -- row via corrects_evidence_id rather than mutating this one).
  verification_method   text not null check (verification_method in ('repo_link', 'deployment', 'package', 'ci', 'human_review', 'attested')),
  source_agreement      int default 1 not null,  -- how many independent sources corroborated this row; max 2 in MVP
  comparative_anchor     text,  -- DEFERRED: null until a rater exists
  corrects_evidence_id  uuid references skill_evidence(id),
  -- Set on a correction row that supersedes without replacing: the
  -- reinvestigation outcome "this shouldn't be here at all" (§611).
  -- Retraction rather than deletion keeps the audit trail a dispute
  -- exists to produce — see migration v05_0006.
  retracted_at          timestamptz,
  created_at            timestamptz default now()
);

-- ─── Platform-observed signals (free, nobody does any work) ───────────────

create table platform_signals (
  engagement_id   uuid references engagements(id) on delete cascade primary key,
  days_to_submit  int,
  est_hours       int,
  on_time         boolean,
  scope_changes   int default 0 not null,
  message_volume  int default 0 not null,
  dispute_flag    boolean default false not null,
  repeat_hire     boolean default false not null,  -- was this (poster, student) pair already engaged before?
  computed_at     timestamptz default now()
);

-- ─── Outcomes (§14) ────────────────────────────────────────────────────────
-- Populated by the single close-out satisfaction question (§8, §17) — not
-- attestation of skill, so it's live in MVP even though rater-based
-- attestation isn't.

-- hired_beyond_engagement is the placement-fee trigger AND the strongest
-- outcome label in the system (§17) — and it's the one event most likely to
-- surface months later, through a channel that isn't the product (a student
-- mentions it, a poster discloses it, a repeat-hire pattern implies it).
-- Recording *when* and *how* it was learned is what makes it auditable
-- revenue rather than an unverifiable claim, and none of it is
-- reconstructible after the fact.
create table outcomes (
  engagement_id                  uuid references engagements(id) on delete cascade primary key,
  poster_satisfaction            int check (poster_satisfaction between 1 and 5),
  would_rehire                   boolean,
  hired_beyond_engagement        boolean default false not null,
  hired_beyond_engagement_at     timestamptz,
  hired_beyond_engagement_source text check (hired_beyond_engagement_source in ('student_report', 'poster_report', 'detected')),
  recorded_at                    timestamptz default now()
);

-- ─── Project briefs ────────────────────────────────────────────────────────
-- Cold-start unblock. Never a listing — private to the student, regenerable.

create table project_briefs (
  id                  uuid default gen_random_uuid() primary key,
  student_id          uuid references students(id) on delete cascade not null,
  target_role         text,
  target_skill_id     text references skills(id),
  brief_text          text not null,
  -- The agent's estimate of how LONG the project takes (1 = a weekend,
  -- 5 = a month+). Deliberately not the same thing as skill_level below:
  -- "how hard is this for someone at my level" and "how many evenings is
  -- this" are different questions, and one 1-5 column answered neither.
  difficulty          int check (difficulty between 1 and 5),
  -- Student-chosen, set BEFORE generation. Without these the agent had
  -- nothing to calibrate against, so an absolute beginner and a researcher
  -- asking about the same skill got the same project.
  skill_level         text check (skill_level is null or skill_level in ('beginner', 'intermediate', 'advanced', 'research')),
  career_track        text check (career_track is null or career_track in (
                        'frontend', 'backend', 'systems', 'ml_ai', 'data', 'security', 'mobile', 'infrastructure'
                      )),
  -- The repo this brief turned into, once the student starts building.
  -- A brief with a repo is in progress; one without is still just an idea.
  repo_full_name      text,
  started_at          timestamptz,
  issued_at           timestamptz default now(),
  completed_at        timestamptz,
  linked_artifact_id  uuid references artifacts(id)
);

create index project_briefs_repo_idx
  on project_briefs (student_id, repo_full_name)
  where repo_full_name is not null;

-- ─── FCRA write-path — cannot be backfilled, must exist from row one ──────

create table consents (
  id            uuid default gen_random_uuid() primary key,
  student_id    uuid references students(id) on delete cascade not null,
  scope         text not null,  -- e.g. 'application_disclosure'
  granted_at    timestamptz default now(),
  revoked_at    timestamptz,
  text_version  text not null
);

-- payload_snapshot holds the actual values furnished, not just which field
-- names were sent. An FCRA dispute is a claim that something *specific* we
-- reported was wrong — "you told them my React depth was 2.1" — and that is
-- unanswerable from a list of field names plus a timestamp, because depth
-- moves on its own as evidence accumulates and decays. Logging what was
-- said, not merely that something was said, is the difference between a
-- reinvestigation you can actually conduct and one you can't.
create table disclosure_log (
  id               uuid default gen_random_uuid() primary key,
  student_id       uuid references students(id) on delete cascade not null,
  recipient_id     uuid not null,
  engagement_ids   uuid[],
  fields_disclosed text[] not null,  -- e.g. {'depth_scores','fit_tier','evidence_summary'}
  payload_snapshot jsonb,            -- the values themselves, as furnished
  furnished_at     timestamptz default now()
);

-- Consumer disputes (§611). Students file and read their own; they never
-- update one, since a consumer editing the status of their own dispute
-- would make the resolution record worthless. See migration v05_0006.

create table disputes (
  id                     uuid default gen_random_uuid() primary key,
  student_id             uuid references students(id) on delete cascade not null,
  evidence_id            uuid references skill_evidence(id),
  disclosure_id          uuid references disclosure_log(id),
  category               text not null check (category in (
    'inaccurate_level', 'skill_not_demonstrated', 'not_my_work',
    'wrong_attribution', 'disclosure_unauthorized', 'other'
  )),
  detail                 text not null,
  status                 text not null default 'open' check (status in (
    'open', 'reinvestigating', 'resolved_corrected',
    'resolved_retracted', 'resolved_verified', 'resolved_manual'
  )),
  filed_at               timestamptz default now() not null,
  -- §611's 30-day reinvestigation clock, stored rather than computed so
  -- an overdue dispute is a plain query.
  due_at                 timestamptz default (now() + interval '30 days') not null,
  resolved_at            timestamptz,
  resolution_note        text,
  resolution_evidence_id uuid references skill_evidence(id)
);

create table evidence_audit (
  id            uuid default gen_random_uuid() primary key,
  evidence_id   uuid references skill_evidence(id) on delete cascade not null,
  source        text not null,
  raw_input     jsonb,
  extracted_at  timestamptz default now()
);

-- applications.consent_id declared without its FK above, since consents is
-- defined after applications. Added here rather than reordering the file,
-- because the reading order (listings → applications → engagements) matches
-- how the product actually works and is worth preserving.
alter table applications
  add constraint applications_consent_id_fkey
  foreign key (consent_id) references consents(id);

-- ─── Fit-tier impressions — EEOC audit trail ──────────────────────────────
-- §7 names the presence filter as the single highest-priority disparate-
-- impact audit target, and §7 also names the reason it's hard to audit: the
-- students it turns away are invisible. Someone who sees "Not yet" and
-- never applies leaves no trace in `applications` at all — so an audit run
-- against applications alone measures only the people who got through.
--
-- This logs the tier shown at listing-detail view, which is the moment the
-- self-selection decision actually happens. Recomputing it later is
-- impossible: depth values move continuously, so last month's tier cannot
-- be reconstructed from today's data.
--
-- TRADEOFF, worth deciding deliberately rather than inheriting: this is
-- view-level logging, and it grows with traffic rather than with
-- engagements. At current scale it's nothing. If the surveillance profile
-- bothers you more than the audit gap does, drop this table — but drop it
-- now, because turning it on later starts the history from zero.
create table fit_tier_impressions (
  id             uuid default gen_random_uuid() primary key,
  student_id     uuid references students(id) on delete cascade not null,
  listing_id     uuid references listings(id) on delete cascade not null,
  tier           text not null check (tier in ('strong_fit', 'competitive', 'reach', 'not_yet')),
  missing_skills text[],
  shown_at       timestamptz default now()
);

-- ─── Human review queue (§3) ───────────────────────────────────────────────
-- The fallback verification path. Deployment / package / CI cover code
-- that runs; they cover nothing for a design portfolio, a research
-- writeup, or a demo that only exists as a video. See migration v05_0007.

create table review_requests (
  id            uuid default gen_random_uuid() primary key,
  student_id    uuid references students(id) on delete cascade not null,
  artifact_id   uuid references artifacts(id) on delete cascade,
  url           text not null,
  note          text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at  timestamptz default now() not null,
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  review_note   text
);

-- ─── Agent calls — every agent invocation, logged ─────────────────────────
-- Required to answer "why did the system say that" and for cost control.
-- Agents never decide (§2) — this table is what proves it after the fact.

create table agent_calls (
  id           uuid default gen_random_uuid() primary key,
  agent_type   text not null check (agent_type in ('posting', 'brief', 'goals', 'application_scoring', 'taxonomy')),
  student_id   uuid references students(id) on delete cascade,
  poster_id    uuid,
  input        jsonb not null,
  output       jsonb not null,
  model_version text,
  created_at   timestamptz default now()
);

-- ============================================================
--  Functions & triggers
-- ============================================================

-- Keeps students.active_application_count in sync with applications,
-- regardless of insert path. security definer because a student
-- inserting/withdrawing their own application has no UPDATE grant on
-- other students' rows otherwise.
create or replace function sync_application_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'submitted' then
      update students set active_application_count = active_application_count + 1 where id = NEW.student_id;
    end if;
  elsif TG_OP = 'UPDATE' then
    if OLD.status = 'submitted' and NEW.status <> 'submitted' then
      update students set active_application_count = greatest(active_application_count - 1, 0) where id = NEW.student_id;
    elsif OLD.status <> 'submitted' and NEW.status = 'submitted' then
      update students set active_application_count = active_application_count + 1 where id = NEW.student_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.status = 'submitted' then
      update students set active_application_count = greatest(active_application_count - 1, 0) where id = OLD.student_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_application_counters on applications;
create trigger trg_sync_application_counters
  after insert or update of status or delete on applications
  for each row execute function sync_application_counters();

-- Computes repeat_hire at engagement creation — has this (poster, student)
-- pair engaged before? Free, and per §5 the strongest signal in the system.
create or replace function sync_repeat_hire()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_count int;
begin
  select count(*) into prior_count
  from engagements
  where poster_id = NEW.poster_id and student_id = NEW.student_id and id <> NEW.id;

  insert into platform_signals (engagement_id, repeat_hire)
  values (NEW.id, prior_count > 0)
  on conflict (engagement_id) do update set repeat_hire = excluded.repeat_hire;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_repeat_hire on engagements;
create trigger trg_sync_repeat_hire
  after insert on engagements
  for each row execute function sync_repeat_hire();

-- Enforces the append-only invariant on skill_evidence and evidence_audit
-- at the database level, not just by convention — corrections must be new
-- rows. UPDATE is blocked outright; only INSERT and SELECT are permitted.
create or replace function reject_evidence_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'skill_evidence and evidence_audit are append-only — insert a correction row instead of updating % (id=%)', TG_TABLE_NAME, OLD.id;
end;
$$;

drop trigger if exists trg_reject_skill_evidence_update on skill_evidence;
create trigger trg_reject_skill_evidence_update
  before update on skill_evidence
  for each row execute function reject_evidence_update();

drop trigger if exists trg_reject_evidence_audit_update on evidence_audit;
create trigger trg_reject_evidence_audit_update
  before update on evidence_audit
  for each row execute function reject_evidence_update();

-- Nearest-neighbor lookup for canonicalization (§4/§5, Phase 1) —
-- supabase-js can't express the pgvector <=> operator natively, so this is
-- the one place a raw SQL function is required rather than a plain query.
-- No vector index (ivfflat/hnsw) on skills.embedding: at ~180 rows a
-- sequential scan is faster than any index's overhead, and ivfflat needs
-- representative data present to tune its `lists` parameter sensibly
-- anyway. Revisit only if the taxonomy grows by an order of magnitude.
--
-- deprecated_at filter matters here specifically: a deprecated skill still
-- exists (old evidence rows reference it via skill_id), but new
-- canonicalization should never route a fresh match onto a dead end —
-- merged_into_id is where that traffic should land instead.
create or replace function match_skill_by_embedding(query_embedding vector(1024), match_count int default 3)
returns table (skill_id text, canonical_name text, similarity float)
language sql stable
as $$
  select id, canonical_name, 1 - (embedding <=> query_embedding) as similarity
  from skills
  where embedding is not null and deprecated_at is null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Writing a `vector` column through a plain PostgREST update is a real
-- trouble spot — the JSON array supabase-js sends has no guaranteed cast
-- to pgvector's vector type, and failure modes range from a clear error to
-- silently wrong data depending on client/PostgREST version. Routing the
-- write through this function sidesteps the ambiguity entirely: the cast
-- from float8[] to vector happens explicitly, in SQL, where it's
-- unambiguous.
--
-- Deliberately NOT security definer: the only caller is the backfill
-- script, which already runs as service_role and bypasses RLS on its own.
-- Making this security definer would let it update any skill's embedding
-- from any caller able to invoke the RPC at all (anon/authenticated by
-- default) — a real privilege-escalation surface for zero benefit, since
-- nothing about the actual use case needs it.
create or replace function update_skill_embedding(p_skill_id text, p_embedding float8[])
returns void
language plpgsql
as $$
begin
  update skills set embedding = p_embedding::vector(1024) where id = p_skill_id;
end;
$$;

-- "Current" state of skill_evidence — every row minus whichever ones have
-- been superseded by a correction (a newer row pointing back at them via
-- corrects_evidence_id). This is what depth/matching/percentile
-- calculations should read from; the raw table stays the full audit
-- history. RLS on skill_evidence still applies transparently through this
-- view — a plain view inherits the underlying table's policies for the
-- querying role, it isn't a bypass.
create or replace view current_skill_evidence as
select se.*
from skill_evidence se
where se.retracted_at is null
  and not exists (
    select 1 from skill_evidence corrector where corrector.corrects_evidence_id = se.id
  );

-- Explicit, since new-object default-privilege propagation to
-- anon/authenticated is confirmed for base tables but is a real edge case
-- for views in some Postgres/Supabase setups — see migration v05_0003.
grant select on current_skill_evidence to anon, authenticated;

-- ============================================================
--  Indexes
-- ============================================================

create index idx_skill_aliases_skill           on skill_aliases(skill_id);
create index idx_skill_priors_student           on skill_priors(student_id);
create index idx_listings_poster                on listings(poster_id, poster_type);
create index idx_listings_status                on listings(status);
create index idx_listing_requirements_skill      on listing_requirements(skill_id);
create index idx_applications_listing            on applications(listing_id);
create index idx_applications_student            on applications(student_id);
create index idx_application_messages_application on application_messages(application_id);
create index idx_contact_shares_student          on contact_shares(student_id);
create index idx_contact_shares_poster           on contact_shares(poster_id);
create index idx_engagements_listing             on engagements(listing_id);
create index idx_engagements_student             on engagements(student_id);
create index idx_engagements_poster              on engagements(poster_id);
create index idx_github_repo_grants_student       on github_repo_grants(student_id);
create index idx_artifacts_student               on artifacts(student_id);
create index idx_artifacts_engagement            on artifacts(engagement_id);
create index idx_skill_evidence_student_skill     on skill_evidence(student_id, skill_id);
create index idx_disputes_student                 on disputes(student_id);
create index idx_disputes_status                  on disputes(status);
create index idx_disputes_evidence                on disputes(evidence_id);
create index idx_skill_evidence_artifact         on skill_evidence(artifact_id);
create index idx_skill_evidence_corrects         on skill_evidence(corrects_evidence_id);
create index idx_project_briefs_student          on project_briefs(student_id);
create index idx_consents_student                on consents(student_id);
create index idx_disclosure_log_student           on disclosure_log(student_id);
create index idx_evidence_audit_evidence         on evidence_audit(evidence_id);
create index idx_agent_calls_student             on agent_calls(student_id);
create index idx_review_requests_status          on review_requests(status, requested_at);
create index idx_review_requests_student         on review_requests(student_id);
create index idx_skills_merged_into              on skills(merged_into_id);
create index idx_applications_consent             on applications(consent_id);
create index idx_fit_tier_impressions_student     on fit_tier_impressions(student_id, shown_at);
create index idx_fit_tier_impressions_listing     on fit_tier_impressions(listing_id);

-- ============================================================
--  Row Level Security
-- ============================================================

alter table students               enable row level security;
alter table skills                 enable row level security;
alter table skill_aliases          enable row level security;
alter table skill_priors           enable row level security;
alter table listings               enable row level security;
alter table listing_requirements   enable row level security;
alter table applications           enable row level security;
alter table application_messages   enable row level security;
alter table contact_shares         enable row level security;
alter table engagements            enable row level security;
alter table github_connections     enable row level security;
alter table github_repo_grants     enable row level security;
alter table artifacts              enable row level security;
alter table artifact_signals       enable row level security;
alter table skill_evidence         enable row level security;
alter table platform_signals       enable row level security;
alter table outcomes               enable row level security;
alter table project_briefs         enable row level security;
alter table consents               enable row level security;
alter table disclosure_log         enable row level security;
alter table evidence_audit         enable row level security;
alter table disputes               enable row level security;
alter table agent_calls            enable row level security;
alter table review_requests        enable row level security;
alter table skill_calibration      enable row level security;
alter table fit_tier_impressions   enable row level security;

-- ── students ──

create policy "Students: select own row"
  on students for select using (auth.uid() = id);

create policy "Students: insert own row"
  on students for insert with check (auth.uid() = id);

create policy "Students: update own row"
  on students for update using (auth.uid() = id);

-- Posters need to read applicant profile basics; scoped narrowly to actual
-- applicants on their own listings, not a general "any signed-in user"
-- grant.
create policy "Posters: read applicant profiles via their listings"
  on students for select
  using (
    exists (
      select 1 from applications a
      join listings l on l.id = a.listing_id
      where a.student_id = students.id
        and l.poster_id = auth.uid()
    )
  );

-- Opted-in directory (/students) — basic profile + skills only. The RLS
-- grant is row-level (can this row be read at all), not field-level — the
-- application layer must select only safe columns (no depth, no evidence,
-- no track record) for this surface. See §16 for why that split matters.
create policy "Anyone signed in: read opted-in student directory"
  on students for select
  using (open_to_collab = true and auth.uid() is not null);

-- Public profile lookups by handle, unauthenticated included.
create policy "Anyone: read student row for public profile lookup"
  on students for select
  using (handle is not null);

-- ── skills / skill_aliases ──
-- Read-only fixed vocabulary for every signed-in user; writes are
-- service-role only (taxonomy edits are a deliberate, reviewed action, not
-- a user action).

create policy "Anyone signed in: read skills"
  on skills for select using (auth.uid() is not null);

create policy "Anyone signed in: read skill aliases"
  on skill_aliases for select using (auth.uid() is not null);

-- ── skill_priors ──

create policy "Students: read own priors"
  on skill_priors for select using (auth.uid() = student_id);

create policy "Posters: read applicant priors via their listings"
  on skill_priors for select
  using (
    exists (
      select 1 from applications a
      join listings l on l.id = a.listing_id
      where a.student_id = skill_priors.student_id
        and l.poster_id = auth.uid()
    )
  );

-- ── listings ──
-- Every open listing is visible to everyone, logged in or not — presence
-- gates applying, never seeing (§7).

create policy "Anyone: read open listings"
  on listings for select using (status = 'open');

create policy "Posters: read all own listings"
  on listings for select using (auth.uid() = poster_id);

create policy "Posters: insert own listings"
  on listings for insert with check (auth.uid() = poster_id);

create policy "Posters: update own listings"
  on listings for update using (auth.uid() = poster_id);

create policy "Posters: delete own listings"
  on listings for delete using (auth.uid() = poster_id);

-- ── listing_requirements ──

create policy "Anyone: read requirements for open listings"
  on listing_requirements for select
  using (
    exists (select 1 from listings l where l.id = listing_requirements.listing_id and l.status = 'open')
  );

create policy "Posters: manage requirements for own listings"
  on listing_requirements for all
  using (exists (select 1 from listings l where l.id = listing_requirements.listing_id and l.poster_id = auth.uid()))
  with check (exists (select 1 from listings l where l.id = listing_requirements.listing_id and l.poster_id = auth.uid()));

-- ── applications ──
-- Active-application cap (5, §7) enforced here — the only hard application
-- gate in MVP. Presence/fit is informational, shown before submit, never a
-- technical block (§7: "eligibility gates applying, not seeing" — and even
-- within applying, only the slot cap is a hard rule).

create policy "Students: read own applications"
  on applications for select using (auth.uid() = student_id);

create policy "Students: insert own applications"
  on applications for insert
  with check (
    auth.uid() = student_id
    and coalesce((select active_application_count from students where id = auth.uid()), 0) < 5
  );

create policy "Posters: read applications for their listings"
  on applications for select
  using (exists (select 1 from listings l where l.id = applications.listing_id and l.poster_id = auth.uid()));

create policy "Posters: update application status for their listings"
  on applications for update
  using (exists (select 1 from listings l where l.id = applications.listing_id and l.poster_id = auth.uid()));

-- A student can withdraw their own still-submitted application. USING
-- restricts which rows are eligible; WITH CHECK restricts what the row is
-- allowed to become — together they permit only this one transition.
create policy "Students: withdraw own submitted application"
  on applications for update
  using (auth.uid() = student_id and status = 'submitted')
  with check (auth.uid() = student_id and status = 'withdrawn');

-- ── application_messages ──
-- 500-char cap is a table CHECK constraint; the "3 messages per side before
-- acceptance" cap is enforced here.

create policy "Application participants: read messages"
  on application_messages for select
  using (
    exists (
      select 1 from applications a
      join listings l on l.id = a.listing_id
      where a.id = application_messages.application_id
        and (a.student_id = auth.uid() or l.poster_id = auth.uid())
    )
  );

create policy "Application participants: send messages"
  on application_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from applications a
      join listings l on l.id = a.listing_id
      where a.id = application_messages.application_id
        and (a.student_id = auth.uid() or l.poster_id = auth.uid())
        and (
          a.status <> 'submitted'  -- unlimited once accepted
          or (
            select count(*) from application_messages m
            where m.application_id = a.id and m.sender_id = auth.uid()
          ) < 3
        )
    )
  );

-- ── contact_shares ──

create policy "Contact shares: participants read"
  on contact_shares for select
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- ── engagements ──

create policy "Engagement participants: read"
  on engagements for select
  using (auth.uid() = student_id or auth.uid() = poster_id);

create policy "Engagement participants: update"
  on engagements for update
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- ── github_connections / github_repo_grants ──

create policy "Students: manage own github connection"
  on github_connections for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy "Students: manage own repo grants"
  on github_repo_grants for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

-- ── artifacts / artifact_signals ──

create policy "Students: manage own artifacts"
  on artifacts for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy "Anyone: read artifacts for open engagements/profile"
  on artifacts for select using (true);  -- artifact existence/type is not sensitive; content is never stored (§5)

create policy "Anyone signed in: read artifact signals"
  on artifact_signals for select using (auth.uid() is not null);

-- ── skill_evidence ──
-- Read-only for everyone except the owning student and, narrowly, posters
-- who received an application from that student. Writes are service-role
-- only (evidence is written by the scan pipeline / close-out flow, never
-- inserted directly by a client).

create policy "Students: read own evidence"
  on skill_evidence for select using (auth.uid() = student_id);

create policy "Posters: read applicant evidence via their listings"
  on skill_evidence for select
  using (
    exists (
      select 1 from applications a
      join listings l on l.id = a.listing_id
      where a.student_id = skill_evidence.student_id
        and l.poster_id = auth.uid()
    )
  );

-- ── platform_signals / outcomes ──

create policy "Engagement participants: read platform signals"
  on platform_signals for select
  using (exists (select 1 from engagements e where e.id = platform_signals.engagement_id and (e.student_id = auth.uid() or e.poster_id = auth.uid())));

create policy "Engagement participants: read outcomes"
  on outcomes for select
  using (exists (select 1 from engagements e where e.id = outcomes.engagement_id and (e.student_id = auth.uid() or e.poster_id = auth.uid())));

create policy "Poster: insert own satisfaction outcome"
  on outcomes for insert
  with check (exists (select 1 from engagements e where e.id = outcomes.engagement_id and e.poster_id = auth.uid()));

-- ── project_briefs ──

create policy "Students: manage own briefs"
  on project_briefs for all
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

-- ── consents / disclosure_log / evidence_audit ──
-- Read-only to the owning student (file disclosure, §10/§12 /me/file).
-- Writes are service-role only — these are FCRA compliance artifacts, not
-- user-editable records.

create policy "Students: read own consents"
  on consents for select using (auth.uid() = student_id);

create policy "Students: insert own consent"
  on consents for insert with check (auth.uid() = student_id);

create policy "Students: read own disclosure log"
  on disclosure_log for select using (auth.uid() = student_id);

create policy "Students: read own evidence audit"
  on evidence_audit for select
  using (exists (select 1 from skill_evidence se where se.id = evidence_audit.evidence_id and se.student_id = auth.uid()));

-- ── disputes ──

create policy "Students: read own disputes"
  on disputes for select using (auth.uid() = student_id);

create policy "Students: file own disputes"
  on disputes for insert with check (auth.uid() = student_id);

-- Revocation is not deletion: the consent row stays, with revoked_at
-- set, because "this was consented to at the time" remains true of
-- disclosures already made under it.
create policy "Students: revoke own consent"
  on consents for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- ── agent_calls ──

-- ── review_requests ──
-- Insert-and-read only for students, same reason as disputes: a consumer
-- editing the status of their own request would make the record useless.
-- Reviewing is service-role, an honest reflection of "one person reviews
-- these" rather than a permission system pretending to be more.

create policy "Students: read own review requests"
  on review_requests for select using (auth.uid() = student_id);

create policy "Students: file own review requests"
  on review_requests for insert with check (auth.uid() = student_id);

create policy "Students: read own agent calls"
  on agent_calls for select using (auth.uid() = student_id);

create policy "Posters: read agent calls made on their behalf"
  on agent_calls for select using (auth.uid() = poster_id);

-- Background jobs.
--
-- Everything slow in this product — scanning a student's repos, re-running
-- a scan to settle a dispute, generating a project brief — was being done
-- inside the request that triggered it. That fails two ways: the student is
-- pinned to the page while it runs, and a serverless function has a hard
-- timeout that a multi-repo scan simply exceeds, killing the work partway
-- with no way to resume.
--
-- A job is a list of independent STEPS plus a cursor. A worker claims the
-- job, does exactly ONE step, records it, and hands back. No single request
-- ever has to finish the whole thing, so the platform timeout stops being a
-- correctness problem and becomes a per-step budget that is trivially met.
--
-- Progress is stored rather than inferred so the UI can show "3 of 7" and
-- name the repo currently being read — and so it survives the student
-- closing the tab, which is the entire point.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,

  -- Extensible on purpose: scan is the first consumer, but close-out
  -- evidence and dispute reinvestigation are the same shape of problem.
  kind text not null check (kind in ('github_scan')),

  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),

  -- The work list. Each entry: { id, label, status, detail }, where status
  -- is pending | running | done | failed. Kept as one document rather than
  -- a child table because steps are only ever read and written together,
  -- as a unit, by the worker that owns the job's lease.
  steps jsonb not null default '[]'::jsonb,
  total_steps int not null default 0,
  completed_steps int not null default 0,

  -- Whatever the finished job wants to tell the user. Shape is per-kind.
  result jsonb,
  error text,

  -- Lease. A worker may only touch a job whose lease is free or expired;
  -- this is what stops the self-chained call and the cron sweeper from
  -- both running step 4 at the same time and double-writing evidence.
  locked_at timestamptz,
  attempts int not null default 0,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

-- The sweeper's query: unfinished jobs, oldest first.
create index if not exists jobs_pending_idx
  on jobs (status, updated_at)
  where status in ('queued', 'running');

-- "Do I already have a scan running?" on every page load.
create index if not exists jobs_student_kind_idx
  on jobs (student_id, kind, status);

alter table jobs enable row level security;

-- Students read their own jobs and nothing else. There is deliberately no
-- insert or update policy: a job is created and advanced by the server
-- under service-role. A client that could write its own job rows could
-- claim work was done that never ran, which would put unearned evidence on
-- a record — the one thing this product cannot allow.

/**
 * Atomically claim a job for one step of work.
 *
 * Returns the job row on success and no rows if it could not be claimed —
 * because it is already finished, or because another worker holds a live
 * lease. Callers must treat "no rows" as "someone else has it", not as an
 * error: with a self-chaining worker AND a cron sweeper, losing the race is
 * the normal, healthy case.
 *
 * The lease expires rather than being explicitly released, so a worker that
 * is killed mid-step (the exact failure this whole table exists to survive)
 * frees its job automatically instead of stranding it forever.
 */
create or replace function claim_job(p_job_id uuid, p_lease_seconds int default 120)
returns setof jobs
language sql
security definer
set search_path = public
as $$
  update jobs
     set locked_at = now(),
         attempts = attempts + 1,
         status = case when status = 'queued' then 'running' else status end,
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = p_job_id
     and status in ('queued', 'running')
     and (locked_at is null or locked_at < now() - make_interval(secs => p_lease_seconds))
  returning *;
$$;

revoke all on function claim_job(uuid, int) from public, anon, authenticated;

-- ── skill_calibration ──
-- Readable by anyone signed in: a student is entitled to know that their
-- level moved because a skill crossed its calibration threshold, not
-- because of anything they did.

create policy "Anyone signed in: read skill calibration"
  on skill_calibration for select using (auth.uid() is not null);

-- ── fit_tier_impressions ──
-- The student can read their own impressions (it's their data, and file
-- disclosure under §10 should include it). Writes are service-role only —
-- the impression is recorded by the server that computed the tier, never
-- self-reported by a client, or the audit trail means nothing.

create policy "Students: read own fit tier impressions"
  on fit_tier_impressions for select using (auth.uid() = student_id);

-- ── jobs ──
create policy "Students: read own jobs"
  on jobs for select using (auth.uid() = student_id);

-- ─── Roles ───────────────────────────────────────────────────────────────
-- One row per login, saying what kind of person this is. `students` above
-- stays the student-specific profile and hangs off this.
--
-- roles is an array rather than a single column on purpose: a PhD student
-- takes courses, TAs, and runs lab projects — genuinely a student and
-- faculty at once, and one value forces a wrong answer.
--
-- Faculty is self-declared at signup and verified afterwards. Unverified
-- faculty works; it just doesn't carry faculty weight. Verification gates
-- the weight, not the account, so lying gains nothing and nobody is blocked
-- waiting on a check.

create table accounts (
  id                  uuid primary key references auth.users(id) on delete cascade,
  roles               text[] not null default '{student}',
  -- 'declined' is a refused faculty claim. Like 'suspended' it is simply
  -- "not active", so has_role() and getAccount() refuse it without either
  -- needing to learn a new value.
  -- 'waitlisted' is an under-18 signup. The profile is saved and the account
  -- exists, but nothing about their record is built or shown until their
  -- eighteenth birthday, at which point it opens by itself. See v05_0017.
  -- 'deleting' is an account inside its seven-day deletion grace period.
  status              text not null default 'active'
                        check (status in ('active', 'suspended', 'declined', 'waitlisted', 'deleting')),
  -- Only populated when someone volunteers it because they're under 18 and
  -- want their place held. We don't ask everyone: a birthday for every
  -- account is sensitive data collected to answer one yes/no question, and
  -- knowing an age is what creates the duty around minors in the first
  -- place. The minimum age lives in the terms, and signup is the
  -- representation — see age_attested_at. v05_0018.
  date_of_birth       date,
  terms_accepted_at   timestamptz,
  terms_version       text,
  -- Separate from terms_accepted_at: re-accepting amended terms must not
  -- silently move when they told us they were an adult.
  age_attested_at     timestamptz,
  deletion_requested_at timestamptz,
  faculty_requested_at timestamptz,
  faculty_verified_at timestamptz,
  faculty_verified_by uuid references auth.users(id),
  -- Name and institution live here rather than in `students`, because this
  -- is the one row every login has regardless of what kind of person it is.
  -- Faculty have no student profile to hold them.
  display_name        text,
  institution         text,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null,
  constraint accounts_roles_valid check (
    roles <@ array['student', 'faculty', 'admin']::text[] and array_length(roles, 1) >= 1
  )
);

create index accounts_roles_idx on accounts using gin (roles);

-- Read from the table, not from the login token. A token claim is faster and
-- is the usual advice, but it goes stale — revoking admin wouldn't take
-- effect until the session refreshed.
create or replace function has_role(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p_role = any(roles) and status = 'active' from accounts where id = auth.uid()),
    false
  );
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role('admin');
$$;

-- "Is this poster confirmed faculty?" — and nothing else.
--
-- Listings show a verified-faculty badge, which means a reader needs one bit
-- about someone else's account. `accounts` is behind RLS that grants your own
-- row and nothing more, and RLS grants rows rather than columns, so there is
-- no policy that exposes just this. This answers the single question about
-- ids the caller already has, and leaks nothing about roles, status, or who
-- did the confirming. Confirmed ids only: a pending claim is simply absent,
-- so the listing carries no claim rather than an unchecked one.
create or replace function verified_faculty_ids(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select id
    from accounts
   where id = any(p_ids)
     and status = 'active'
     and 'faculty' = any(roles)
     and faculty_verified_at is not null;
$$;

revoke all on function verified_faculty_ids(uuid[]) from public;
grant execute on function verified_faculty_ids(uuid[]) to anon, authenticated;

-- Every staff action, and every staff read of someone's record. Reads are
-- logged as well as writes: an admin opening a student's file is a person
-- reading a consumer record about someone else, and "who looked at this"
-- cannot be answered retroactively.
create table admin_actions (
  id            uuid default gen_random_uuid() primary key,
  admin_id      uuid references auth.users(id) not null,
  action        text not null,
  subject_type  text not null,
  subject_id    text not null,
  student_id    uuid references students(id) on delete set null,
  detail        jsonb,
  created_at    timestamptz default now() not null
);

create index admin_actions_subject_idx on admin_actions (subject_type, subject_id);
create index admin_actions_student_idx on admin_actions (student_id, created_at desc);
create index admin_actions_admin_idx on admin_actions (admin_id, created_at desc);

-- Names the matcher couldn't confidently place. These used to be dropped
-- silently, so students lost skills with no way to find out which or how
-- often. seen_count is the useful part — it says which unmatched strings are
-- common enough to be worth adding to the taxonomy.
create table unresolved_skills (
  id              uuid default gen_random_uuid() primary key,
  raw_string      text not null unique,
  candidates      jsonb,
  seen_count      int not null default 1,
  last_seen_at    timestamptz default now() not null,
  first_seen_at   timestamptz default now() not null,
  example_source  text,
  status          text not null default 'pending'
                  check (status in ('pending', 'mapped', 'not_a_skill')),
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamptz,
  mapped_skill_id text references skills(id),
  -- Who this cost. Without it the queue says a name didn't match and not
  -- whether that lost one person a skill or forty — which is the only thing
  -- that decides whether it's worth acting on. Capped arrays rather than a
  -- join table: read on every render, never joined against.
  affected_student_ids uuid[] not null default '{}',
  example_repos        text[] not null default '{}',
  -- Advisory AI classification. Nothing here applies without a person.
  ai_verdict           jsonb,
  ai_checked_at        timestamptz
);

-- Bug reports and feature requests. page_url and user_agent are captured
-- silently — a student will never tell you which page they were on, and
-- without it a report is "it's broken".
create table feedback (
  id           uuid default gen_random_uuid() primary key,
  reporter_id  uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('bug', 'feature')),
  title        text not null,
  body         text not null,
  page_url     text,
  user_agent   text,
  status       text not null default 'new'
               check (status in ('new', 'triaged', 'done', 'declined')),
  admin_note   text,
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz,
  created_at   timestamptz default now() not null
);

create index feedback_open_idx on feedback (created_at desc) where status in ('new', 'triaged');

-- Where the job worker lives and how to authenticate to it, for the pg_cron
-- sweeper. No RLS policies at all: a table holding a shared secret should be
-- invisible to every client, admins included.
create table private_config (
  key   text primary key,
  value text not null
);

create index jobs_sweep_idx on jobs (updated_at) where status in ('queued', 'running');

create index unresolved_skills_pending_idx
  on unresolved_skills (seen_count desc) where status = 'pending';

alter table accounts enable row level security;
alter table admin_actions enable row level security;
alter table unresolved_skills enable row level security;

-- ── accounts ──
-- No insert/update policy for regular users: an account row says what
-- someone is allowed to be, so letting them write it would let anyone grant
-- themselves admin. Written by onboarding under the service role.
create policy "Users: read own account"
  on accounts for select using (auth.uid() = id);
create policy "Admins: read all accounts"
  on accounts for select using (is_admin());

-- ── admin_actions ──
-- No insert policy: written server-side so a client can't forge or suppress
-- an entry about itself.
create policy "Admins: read admin actions"
  on admin_actions for select using (is_admin());

-- ── unresolved_skills ──
create policy "Admins: read unresolved skills"
  on unresolved_skills for select using (is_admin());

-- ── feedback ──
alter table feedback enable row level security;
alter table private_config enable row level security;

create policy "Users: file feedback"
  on feedback for insert with check (auth.uid() = reporter_id);
create policy "Users: read own feedback"
  on feedback for select using (auth.uid() = reporter_id);
create policy "Admins: read all feedback"
  on feedback for select using (is_admin());

-- Increment the seen count for unmatched names already on file. Called after
-- an insert-ignoring-duplicates, because the count must increment rather
-- than be overwritten.
create or replace function bump_unresolved_skills(p_raw_strings text[])
returns void language sql security definer set search_path = public as $$
  update unresolved_skills
     set seen_count = seen_count + 1, last_seen_at = now()
   where raw_string = any(p_raw_strings) and status = 'pending';
$$;

-- Proof that a deletion was asked for and carried out. Holds nothing about
-- the person — an opaque id and three timestamps — and deliberately has no
-- FK to auth.users, which would cascade the row away at the moment it
-- became useful. See v05_0018.
create table account_deletions (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null,
  requested_at timestamptz not null,
  purged_at    timestamptz,
  restored_at  timestamptz,
  note         text
);

alter table account_deletions enable row level security;
-- No policies: service role only.
