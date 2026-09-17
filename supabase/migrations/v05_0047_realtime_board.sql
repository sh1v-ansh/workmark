-- ============================================================
--  WORKMARK MIGRATION v05_0047 — the board updates itself
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Subscribing to postgres_changes is not enough on its own: a table has to
--  be in the supabase_realtime publication before any change on it is sent.
--  Without this the client subscribes successfully, receives nothing, and the
--  board looks exactly as it did before the feature was built — which is the
--  worst kind of failure, because nothing errors.
--
--  Three tables, because a board that watched only `tasks` would miss the two
--  things that change without a card moving: a verdict landing from the
--  nightly pass, and a message arriving in a task thread.
--
--  No new authorisation. Realtime enforces the same RLS as a normal read, so
--  somebody who cannot see a project cannot subscribe to it either.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'task_submissions', 'workspace_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- REPLICA IDENTITY FULL so a DELETE carries the row that went, not just its
-- primary key. The board refetches either way, but a payload with only an id
-- cannot be filtered by workspace_id — so without this every project on the
-- platform would be woken by every other project's deletes.
alter table tasks              replica identity full;
alter table task_submissions   replica identity full;
alter table workspace_messages replica identity full;
