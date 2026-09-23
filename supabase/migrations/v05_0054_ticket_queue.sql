-- The ticket queue: work arrives a ticket at a time, the way it does in a job.
--
-- The planner still drafts the whole plan, and the order in it is worth
-- keeping. But a first-year shown twelve tasks at once sees a mountain, not
-- a next step. So tasks now land in the backlog and one or two are released
-- into Planned at a time; finishing one releases the next, with a line
-- saying why it is next. The board is still open — anyone can pull ahead —
-- this only decides what lands in front of them.

alter table tasks
  -- When the queue moved this task into Planned. Null for anything placed by
  -- hand, which is how "pulled ahead" stays distinguishable from "released".
  add column if not exists released_at  timestamptz,
  -- One line, shown on the card: why this ticket, now.
  add column if not exists release_note text,
  -- 'ramp_up' marks the day-one ticket every guided project opens with. Only
  -- that ticket is released until it is done: it proves the repository link
  -- and the scan work before anybody spends a week on the real thing.
  add column if not exists ticket_kind  text
    check (ticket_kind is null or ticket_kind in ('ramp_up'));

comment on column tasks.released_at is
  'When the ticket queue released this task into Planned. Null if it got there by hand.';
comment on column tasks.release_note is
  'One line shown on the card saying why this ticket is next.';
comment on column tasks.ticket_kind is
  '''ramp_up'' for the day-one ticket; null for ordinary tasks.';

-- The queue asks "what is still in the backlog for this project" after every
-- verification, so it gets an index shaped for exactly that.
create index if not exists tasks_backlog_by_workspace_idx
  on tasks (workspace_id, position)
  where status = 'backlog';
