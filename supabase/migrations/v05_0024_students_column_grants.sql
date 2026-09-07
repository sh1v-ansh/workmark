-- Students may write their own row. Not every column in it.
--
-- The policy has always been:
--
--   create policy "Students: update own row"
--     on students for update using (auth.uid() = id);
--
-- which is correct about the row and silent about the columns — and RLS has
-- no way to say "these columns only". A policy answers *which rows*; column
-- permissions are a GRANT. So the anon key, in any browser, could write any
-- column of the signed-in student's own row.
--
-- Three of those columns are not theirs to write.
--
--   active_application_count is maintained by sync_application_counters()
--   and is the number the five-application cap is enforced against. A
--   student who set it to 0 could hold unlimited open applications.
--
--   edu_domain and edu_verified_at are the permanent record of how the
--   account was verified as a student — the one claim the whole product
--   rests on. Writable by the student, they record nothing.
--
--   github_username is written by the GitHub App callback after an install
--   is confirmed. Self-set, it lets anyone display someone else's GitHub
--   identity on their profile.
--
-- Nothing was exploited: there are no users yet. This closes it before there
-- are, which is the only comfortable time to change a permission.
--
-- The grants below are additive to RLS, not a replacement for it. A student
-- still may only reach their own row; this decides what they may do once
-- they are there.

revoke update on public.students from authenticated;

grant update (
  full_name,
  university,
  major,
  degree_type,
  graduation_year,
  gpa,
  is_international,
  visa_type,
  skills,            -- self-reported, display only; never feeds tier_weight
  github_url,        -- self-reported link, unlike github_username below
  linkedin_url,
  availability,
  hours_per_week,
  available_from,
  open_to_collab,    -- written straight from the directory page's toggle
  handle             -- written by PUT /api/profile/handle, as the user
) on public.students to authenticated;

-- Deliberately absent, and each for its own reason:
--
--   id                        the row's identity; changing it is never a
--                             profile edit
--   active_application_count  maintained by trigger; the application cap
--                             is enforced against it
--   edu_domain                proof of student status
--   edu_verified_at           proof of student status
--   github_username           written only by the GitHub App callback,
--                             under the service role
--   created_at                a fact about the past
--
-- The service role bypasses RLS and column grants entirely, so every server
-- route that legitimately writes these — onboarding, the GitHub callback,
-- the deletion sweep — is unaffected.
