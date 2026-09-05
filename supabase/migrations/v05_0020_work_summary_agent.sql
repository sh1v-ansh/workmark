-- A new agent kind, and the removal of one that never existed.
--
-- 'work_summary' drafts the description of completed work that both sides
-- of an engagement have to agree on before it closes.
--
-- 'application_scoring' goes. It was reserved in this constraint and never
-- built: applications are scored by plain matching code — skill depth
-- against listing requirements — with no model anywhere near it. That is
-- the right design for the one decision here that determines whether
-- somebody gets work, and leaving the name in a constraint invites the
-- opposite conclusion from anyone reading the schema. Nothing has ever been
-- logged under it, so nothing is orphaned by removing it.

alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in ('posting', 'brief', 'goals', 'taxonomy', 'work_summary'));
