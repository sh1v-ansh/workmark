-- Citizenship gains "International student"; "Prefer not to say" is no
-- longer offered for it (leaving it blank says the same thing).
alter table public.student_eligibility drop constraint if exists student_eligibility_citizenship_check;
update public.student_eligibility set citizenship = null where citizenship = 'prefer_not';
alter table public.student_eligibility add constraint student_eligibility_citizenship_check
  check (citizenship in ('citizen', 'permanent_resident', 'international', 'other'));
