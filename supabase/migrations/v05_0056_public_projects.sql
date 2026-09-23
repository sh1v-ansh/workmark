-- Let any project go public.
--
-- workspaces_single_parent refused a project that started from a guided-
-- project brief AND had a public posting. That rule was written when a brief
-- meant private practice and a posting meant somebody else's job. Now a
-- student can take their own project, guided or not, and post it to find
-- collaborators — which is exactly both. Where the project came from is
-- still recorded in workspaces.origin, which never changes.

alter table workspaces drop constraint if exists workspaces_single_parent;
