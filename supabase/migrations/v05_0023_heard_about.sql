-- "How did you hear about us?", asked once at signup and never again.
--
-- On accounts rather than students because it is a fact about how the
-- account arrived, and faculty arrive too — putting it on the student
-- profile would mean never learning how a single professor found us.
--
-- Optional in the strong sense: no default, no not-null, and the form
-- offers "Prefer not to say" as a real choice rather than making people
-- close a modal. It answers one question — where should we spend effort to
-- reach more students — and it is not worth a single person feeling
-- interrogated on their first screen.
--
-- Free text is a separate column from the choice so the choice stays
-- countable. One column holding either 'friend' or a paragraph is a column
-- you cannot group by.

alter table accounts
  add column if not exists heard_about text
    check (heard_about is null or heard_about in (
      'friend', 'professor', 'club_or_society', 'social_media',
      'search', 'event', 'other', 'prefer_not_to_say'
    )),
  -- Only meaningful alongside heard_about = 'other'. Capped in the route.
  add column if not exists heard_about_detail text;

comment on column accounts.heard_about is
  'How this account found Workmark, chosen once at signup. Optional; prefer_not_to_say is a real answer and null means they were never asked or skipped it.';
