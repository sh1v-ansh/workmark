-- Two more career tracks: game-dev and hardware (robotics / embedded).
alter table public.students drop constraint if exists students_career_track_check;
alter table public.students add constraint students_career_track_check
  check (career_track in ('backend', 'frontend', 'fullstack', 'mobile', 'ai-ml', 'data', 'devops', 'security', 'game-dev', 'hardware'));
