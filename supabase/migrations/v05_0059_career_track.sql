-- The career a student is working toward, and what they want to become in
-- their own words. Both editable any time. The track decides the "next
-- skill" on the dashboard (src/lib/careers); the text only ever guides
-- project ideas and is never used to judge work.
alter table public.students
  add column if not exists career_track text
    check (career_track in ('backend', 'frontend', 'fullstack', 'mobile', 'ai-ml', 'data', 'devops', 'security')),
  add column if not exists aspiration text check (char_length(aspiration) <= 500),
  add column if not exists career_set_at timestamptz;
