-- Setting up an account, in steps that can be interrupted.

-- ─── Why the account row now exists before the profile is finished ──────────
-- Onboarding was one form of eighteen fields and one submit. Everything or
-- nothing: a student who closed the tab halfway had no account, no row, and
-- nothing to come back to — they started again from the first field.
--
-- It is four screens now, and the account is written after the first one. So
-- the rest is resumable, and the funnel can finally say which screen loses
-- people rather than only that somebody never finished.

alter table accounts
  -- Which screen they got to. Null once they are through. Resumed from
  -- rather than trusted: the page re-derives what is actually missing, so a
  -- stale value costs a redundant screen rather than a broken account.
  add column if not exists onboarding_step text;

-- ─── What they came here for ─────────────────────────────────────────────────
-- Asked on the second screen, and not a survey. Picking is how a student
-- learns the product has four sides at all — most of them arrive thinking it
-- is only the first one — and what they pick orders their dashboard
-- afterwards.
--
-- It also answers a question nothing else could: whether students want to
-- work alone or with other people. That was going to be inferred from
-- behaviour months later, which measures what the product made easy rather
-- than what anybody wanted.
--
-- An array, because these are not exclusive and pretending otherwise would
-- force a false choice on the one screen meant to open the product up.
alter table students
  add column if not exists intents text[] not null default '{}';

comment on column students.intents is
  'What they said they came for: build_record, join_project, post_project, guided_project. Orders the dashboard; also the only honest read on solo-vs-collaborative preference.';

-- ─── GPA ─────────────────────────────────────────────────────────────────────
-- Dropped from the form. It is unverifiable, it is the one number on the
-- page nobody could check, and a product whose whole claim is "this is
-- verified" should not be collecting a self-reported grade alongside it.
--
-- The column stays rather than being dropped: existing rows hold real
-- answers people gave in good faith, and deleting them to tidy a form is not
-- ours to do. Nothing reads it, and nothing new writes it.
comment on column students.gpa is
  'No longer collected — see v05_0051. Retained for rows that already had it; nothing reads this.';

-- ─── Which facts a student may not simply retype ─────────────────────────────
-- The rule: anything an employer ranks on, or anything that came from
-- verification. If it can be retyped it is a claim, not a record.
--
-- graduation_year is a seniority proxy people filter on, and university is
-- the thing the .edu address attests to — it is derived from the email
-- domain now rather than typed, which is both one field less and better
-- data. Neither is locked in the database, because a real correction has to
-- be possible; both are recorded when they change so a correction leaves a
-- trail and a pattern of them is visible.
create table if not exists profile_corrections (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  field       text not null,
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);

alter table profile_corrections enable row level security;

drop policy if exists "own corrections" on profile_corrections;
create policy "own corrections" on profile_corrections
  for select using (student_id = auth.uid());

create index if not exists profile_corrections_student_idx
  on profile_corrections (student_id, changed_at desc);
