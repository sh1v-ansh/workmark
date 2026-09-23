-- Make it possible to delete a person.

-- ─── What was wrong ──────────────────────────────────────────────────────────
-- Four columns point at auth.users with no ON DELETE rule, which Postgres
-- reads as "refuse". So deleting any user who had ever verified a faculty
-- member, taken an admin action, resolved an unmatched skill or closed a
-- feedback item failed with "Database error deleting user" — from the
-- Supabase dashboard, and from /api/cron/purge-accounts, which uses the same
-- call. Account deletion could not have completed for any admin, and the
-- seven-day purge would have failed for them every night, silently.
--
-- ─── What happens instead ────────────────────────────────────────────────────
-- All four record *who did something*. The something should outlive the
-- person: an audit log that loses its rows when an admin leaves is not an
-- audit log. So the reference is cleared and the row stays — the action is
-- still on record, attributed to nobody, rather than blocking the deletion
-- or being deleted with it.
--
-- admin_actions.admin_id was NOT NULL, so that constraint goes too. A null
-- actor on an audit row means "an admin whose account has since been
-- deleted", which is true and is the only honest thing left to say.
--
-- Constraint names are looked up rather than assumed, because the four were
-- created inline and Postgres named them itself.

do $$
declare
  target record;
  con    text;
begin
  for target in
    select * from (values
      ('accounts',          'faculty_verified_by'),
      ('admin_actions',     'admin_id'),
      ('unresolved_skills', 'resolved_by'),
      ('feedback',          'resolved_by')
    ) as t(tbl, col)
  loop
    -- Skip a table that does not exist on this database rather than fail
    -- the whole migration over it.
    if to_regclass('public.' || target.tbl) is null then
      continue;
    end if;

    for con in
      select c.conname
        from pg_constraint c
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.contype = 'f'
         and c.conrelid = ('public.' || target.tbl)::regclass
         and a.attname = target.col
    loop
      execute format('alter table %I drop constraint %I', target.tbl, con);
    end loop;

    execute format(
      'alter table %I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      target.tbl, target.tbl || '_' || target.col || '_fkey', target.col
    );
  end loop;
end $$;

alter table admin_actions alter column admin_id drop not null;

comment on column admin_actions.admin_id is
  'The admin who acted. Null means that admin''s account has since been deleted — the action stays on record.';
