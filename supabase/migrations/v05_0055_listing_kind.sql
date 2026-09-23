-- What kind of posting this is.
--
-- Find work mixed a student looking for a teammate, a founder looking for a
-- co-founder, a lab offering research and a paid role into one undifferentiated
-- list, and a reader had to open each to find out which it was. The poster now
-- says, and the list can be filtered by it.
--
-- Payment itself still happens off-platform (listings.is_paid stays false
-- until payments exist); 'paid' here is the poster saying the work is paid.

alter table listings
  add column if not exists kind text not null default 'collaborative'
    check (kind in ('collaborative', 'startup', 'paid', 'research'));

-- Faculty postings are course or research projects by nature.
update listings set kind = 'research' where poster_type = 'faculty' and kind = 'collaborative';

comment on column listings.kind is
  'collaborative | startup | paid | research. Chosen by the poster; drives the Type filter on Find work.';
