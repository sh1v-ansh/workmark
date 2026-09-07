-- An invitation you cannot read is not an invitation.
--
-- The select policy on workspaces is is_workspace_member(id), and that
-- function deliberately requires accepted_at to be set — an unanswered
-- invitation grants nothing. Correct, and it made the invite flow useless:
-- somebody invited to a project could read their own membership row and
-- nothing else, so the screen asking them to accept had no title, no
-- summary, and nothing to decide on.
--
-- Nobody should have to answer an invitation blind.
--
-- Narrow on purpose. It grants the workspace row only, only while an
-- invitation is genuinely outstanding, and only to the person invited.
-- Accepting moves them to the ordinary member policy; declining or being
-- removed sets removed_at and this stops matching. Tasks, messages and
-- events remain unreadable throughout — an invitee sees what the project is
-- called, not what is in it.
--
-- No recursion risk: this is a policy on `workspaces` reading
-- `workspace_members`, which is a different table.
create policy "Invitees: read the workspace they were invited to"
  on workspaces for select
  using (
    exists (
      select 1 from workspace_members m
       where m.workspace_id = workspaces.id
         and m.account_id = auth.uid()
         and m.accepted_at is null
         and m.removed_at is null
    )
  );
