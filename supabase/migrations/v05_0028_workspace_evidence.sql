-- The evidence side: what GitHub said, what the verifier decided, and the
-- things people write to each other while the work happens.
--
-- work_events is the piece that makes verification affordable. The obvious
-- design — scan the repo when a task is submitted — costs a full repository
-- read per task and gets slower as the project grows. Instead GitHub tells us
-- as things happen, we store the events, and a submission assembles a case
-- file from rows that are already here. Deterministic checks run for free on
-- top of that, and exactly one model call is spent on the judgement.
--
-- It follows that this table must exist BEFORE the verifier. Built in the
-- other order, every check is a repo scan and the feature is too expensive to
-- turn on.

create table work_events (
  id                uuid default gen_random_uuid() primary key,
  workspace_id      uuid references workspaces(id) on delete cascade not null,
  repo_full_name    text not null,

  event_type        text not null check (event_type in (
                      'push', 'pull_request', 'pull_request_review',
                      'check_suite', 'issue_comment', 'release')),

  -- Attribution is the whole point on a team. GitHub gives us a login; the
  -- account id is resolved from students.github_username, which the App
  -- callback writes and which v05_0024 stopped students from forging. It
  -- stays nullable because a commit can come from someone outside the
  -- workspace, and that is a fact worth keeping rather than dropping.
  author_login      text,
  author_account_id uuid references accounts(id) on delete set null,

  -- GitHub's own id for the delivery, so a redelivered webhook is ignored
  -- rather than counted twice.
  external_id       text,

  occurred_at       timestamptz not null,
  recorded_at       timestamptz default now(),

  -- Trimmed at write time, not stored whole. A push payload carries the full
  -- commit list and more besides; what a verifier needs is the messages, the
  -- paths and the counts.
  payload           jsonb,

  unique (repo_full_name, event_type, external_id)
);

create index work_events_workspace_idx on work_events (workspace_id, occurred_at desc);
create index work_events_author_idx    on work_events (author_account_id, occurred_at desc)
  where author_account_id is not null;

-- ─── Verification ───────────────────────────────────────────────────────────
create table task_submissions (
  id             uuid default gen_random_uuid() primary key,
  workspace_id   uuid references workspaces(id) on delete cascade not null,
  task_id        uuid references tasks(id) on delete cascade not null,
  submitted_by   uuid references accounts(id) on delete set null,
  submitted_at   timestamptz default now(),

  verdict        text not null default 'pending'
                   check (verdict in ('pending', 'verified', 'needs_work', 'unverifiable', 'human_verified')),

  -- 0 to 1. Never rounded to a yes: the product promise is that Workmark
  -- says what the evidence supports and no more.
  confidence     numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),

  -- The deterministic checks, each with its own answer: CI passed, tests
  -- touched, changed paths overlap what the task named. These cost nothing
  -- and produce most of the checklist; the model only writes the judgement.
  checks         jsonb,
  notes          text,

  -- The audit trail already used for every other agent call.
  agent_call_id  uuid references agent_calls(id) on delete set null,
  decided_at     timestamptz,

  -- A person's answer, when the work is not the kind a machine can check or
  -- when the student disputes the verdict.
  human_verdict  text check (human_verdict is null or human_verdict in
                   ('works', 'partly_works', 'does_not_work', 'not_checked')),
  human_actor_id uuid references accounts(id) on delete set null,

  -- Attempts are capped in the API at two before a person is asked. A board
  -- somebody cannot get a card out of is worse than one with no checking.
  attempt        int not null default 1 check (attempt >= 1)
);

create index task_submissions_task_idx on task_submissions (task_id, submitted_at desc);

-- ─── Checkpoints ────────────────────────────────────────────────────────────
-- Seconds, not an exam. These are the only place a student is asked anything
-- directly, and the spec is right that they should be rare: the primary
-- evidence is the work, and a workspace that interrogates you is one people
-- stop opening.
create table task_checkpoints (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  task_id       uuid references tasks(id) on delete cascade not null,
  account_id    uuid references accounts(id) on delete cascade not null,
  kind          text not null check (kind in ('before', 'blocked', 'after')),
  question      text not null,
  answer        text,
  asked_at      timestamptz default now(),
  answered_at   timestamptz,
  -- Skipping is allowed and is itself recorded. A required question gets
  -- answered with whatever makes it go away, which is worse than no answer.
  skipped_at    timestamptz
);

create index task_checkpoints_task_idx    on task_checkpoints (task_id);
create index task_checkpoints_pending_idx on task_checkpoints (account_id)
  where answered_at is null and skipped_at is null;

-- ─── Files ──────────────────────────────────────────────────────────────────
-- Metadata here, bytes in Supabase Storage. A file in a column makes every
-- query that touches the row expensive and every backup enormous.
create table workspace_files (
  id             uuid default gen_random_uuid() primary key,
  workspace_id   uuid references workspaces(id) on delete cascade not null,
  task_id        uuid references tasks(id) on delete set null,
  kind           text not null default 'attachment'
                   check (kind in ('attachment', 'presentation')),
  storage_path   text not null unique,
  file_name      text not null,
  content_type   text,
  size_bytes     bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by    uuid references accounts(id) on delete set null,
  uploaded_at    timestamptz default now()
);

create index workspace_files_workspace_idx on workspace_files (workspace_id, uploaded_at desc);

-- ─── Messages ───────────────────────────────────────────────────────────────
-- application_messages was the pattern, not the table: it is capped at 500
-- characters, tied to an application, and strictly between two people.
create table workspace_messages (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  -- A message about a specific task. Null is the general channel. One table
  -- rather than two, so "what was said about this" and "what was said here"
  -- are the same query with a different filter.
  task_id       uuid references tasks(id) on delete cascade,
  sender_id     uuid references accounts(id) on delete set null,
  body          text not null check (char_length(body) between 1 and 4000),
  created_at    timestamptz default now(),
  edited_at     timestamptz
);

create index workspace_messages_idx      on workspace_messages (workspace_id, created_at desc);
create index workspace_messages_task_idx on workspace_messages (task_id, created_at)
  where task_id is not null;

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table work_events        enable row level security;
alter table task_submissions   enable row level security;
alter table task_checkpoints   enable row level security;
alter table workspace_files    enable row level security;
alter table workspace_messages enable row level security;

-- Read-only to everyone. Written by the webhook under the service role,
-- because an event a client can insert is an event a client can invent — and
-- these are the rows a verified skill is ultimately built on.
create policy "Members: read work events"
  on work_events for select using (is_workspace_member(workspace_id));

-- Same reasoning: a student may ask for verification, and may never write
-- its answer. The verdict columns are set by the job under the service role.
create policy "Members: read submissions"
  on task_submissions for select using (is_workspace_member(workspace_id));
create policy "Members: submit work"
  on task_submissions for insert
  with check (is_workspace_member(workspace_id) and submitted_by = auth.uid() and verdict = 'pending');

create policy "Members: read checkpoints"
  on task_checkpoints for select using (is_workspace_member(workspace_id));
-- Only the person who was asked may answer, and only their own row.
create policy "Owner of the checkpoint: answer it"
  on task_checkpoints for update
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy "Members: read files"   on workspace_files for select using (is_workspace_member(workspace_id));
create policy "Members: upload files" on workspace_files for insert
  with check (is_workspace_member(workspace_id) and uploaded_by = auth.uid());
create policy "Uploader or owner: remove a file"
  on workspace_files for delete
  using (uploaded_by = auth.uid() or is_workspace_owner(workspace_id));

create policy "Members: read messages" on workspace_messages for select using (is_workspace_member(workspace_id));
create policy "Members: send messages" on workspace_messages for insert
  with check (is_workspace_member(workspace_id) and sender_id = auth.uid());
create policy "Sender: edit their own message"
  on workspace_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy "Admins: read submissions" on task_submissions for select using (is_admin());

-- Answering a checkpoint must not let somebody rewrite the question they were
-- asked, and editing a message must not let them move it to another task.
revoke update on public.task_checkpoints from authenticated;
grant update (answer, answered_at, skipped_at) on public.task_checkpoints to authenticated;

revoke update on public.workspace_messages from authenticated;
grant update (body, edited_at) on public.workspace_messages to authenticated;
