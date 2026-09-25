-- "Prefer not to say" is no longer offered for citizenship (leaving it
-- blank says the same thing). International status lives on students.
alter table public.student_eligibility drop constraint if exists student_eligibility_citizenship_check;
update public.student_eligibility set citizenship = null where citizenship in ('prefer_not', 'international');
alter table public.student_eligibility add constraint student_eligibility_citizenship_check
  check (citizenship in ('citizen', 'permanent_resident', 'other'));
