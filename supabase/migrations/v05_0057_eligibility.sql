-- Who a student is, for opportunities that are only open to certain groups:
-- women-in-tech scholarships, NSBE/SHPE/AISES programs, veterans'
-- fellowships, first-generation and low-income awards, disability and
-- LGBTQ+ programs.
--
-- ── The rule this table exists to keep ─────────────────────────────────────
-- It decides which opportunities a student is SHOWN, and nothing else.
-- Never shown to posters, employers, teammates or on a profile; never used
-- in fit, ranking or matching for roles (using these in hiring decisions is
-- unlawful); never sent to a model. That is why it is its own table rather
-- than columns on students: every existing read of students (the directory,
-- applicant views, the public profile, the planner's prompts) cannot reach
-- it by accident, and tests/eligibility-isolation.test.ts fails the build
-- if new code starts reading it outside the allowed files.
--
-- Every field is optional and 'prefer_not' is a real answer. Nothing is
-- used at all unless use_for_opportunities is true.

create table if not exists student_eligibility (
  student_id             uuid primary key references students(id) on delete cascade,
  use_for_opportunities  boolean not null default false,

  first_gen      text check (first_gen      in ('yes', 'no', 'prefer_not')),
  military       text check (military       in ('veteran', 'active_or_reserve', 'military_family', 'none', 'prefer_not')),
  gender         text check (gender         in ('woman', 'man', 'non_binary', 'self_describe', 'prefer_not')),
  gender_self    text check (gender_self is null or char_length(gender_self) <= 60),
  -- Choose all that apply (US federal standard, 2024 revision).
  race_ethnicity text[] check (race_ethnicity <@ array[
                   'american_indian_alaska_native', 'asian', 'black', 'hispanic_latino',
                   'middle_eastern_north_african', 'native_hawaiian_pacific_islander',
                   'white', 'prefer_not']::text[]),
  disability     text check (disability     in ('yes', 'no', 'prefer_not')),
  lgbtq          text check (lgbtq          in ('yes', 'no', 'prefer_not')),
  low_income     text check (low_income     in ('yes', 'no', 'prefer_not')),

  -- Less sensitive, and as useful for matching.
  us_state       text check (us_state is null or us_state ~ '^[A-Z]{2}$'),
  transfer       text check (transfer       in ('yes', 'no', 'prefer_not')),
  citizenship    text check (citizenship    in ('citizen', 'permanent_resident', 'other', 'prefer_not')),

  updated_at     timestamptz not null default now()
);

comment on table student_eligibility is
  'Self-described identity for group-specific opportunities. Used only to decide which opportunities a student is shown, and only when use_for_opportunities is true. Never shown to anyone else, never used in fit/ranking/matching, never sent to a model.';

alter table student_eligibility enable row level security;

-- The student, and nobody else. No poster, directory or admin policy, on
-- purpose. The service role (the opportunity matcher) bypasses RLS.
drop policy if exists "Students: own eligibility" on student_eligibility;
create policy "Students: own eligibility"
  on student_eligibility for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
