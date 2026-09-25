-- students has column-level update grants (v05_0024). The career columns
-- from v05_0059 need adding, or a student cannot change their own path.
grant update (career_track, aspiration, career_set_at) on public.students to authenticated;
