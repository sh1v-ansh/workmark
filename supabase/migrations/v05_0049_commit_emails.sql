-- The addresses a student's commits are actually signed with.

-- ─── Why this table has to exist ─────────────────────────────────────────────
-- The scanner used to ask GitHub "which commits here are by this login", and
-- GitHub answers by matching the commit's author email against the addresses
-- verified on that account. Anything else is nobody's as far as the API is
-- concerned.
--
-- So a student who committed from a lab machine, or with their university
-- address, or with git's default user@hostname, or before they added that
-- address to GitHub, got zero commits attributed and therefore no evidence at
-- all from a repository they wrote every line of. The scan reported success.
-- Silent, total, and indistinguishable from having done nothing.
--
-- This is where the answer to "yes, that one is mine too" lives.

create table if not exists student_commit_emails (
  student_id   uuid not null references students(id) on delete cascade,
  -- Stored lowercased; attribution.ts normalizes before comparing. Email
  -- local parts are technically case-sensitive and in practice never are,
  -- and a record that fails to match because of a capital letter is worse
  -- than the pedantry is worth.
  email        text not null,
  -- Where the claim came from, so a support question can be answered.
  --   'github'    — GitHub already verified it against their account.
  --   'confirmed' — we found it on commits and they said it was theirs.
  source       text not null check (source in ('github', 'confirmed')),
  confirmed_at timestamptz not null default now(),
  primary key (student_id, email)
);

-- ─── The rule that stops this being a way to steal work ──────────────────────
-- An address is only ever offered to a student when GitHub has not already
-- attributed its commits to some other account (see attributeCommits). That
-- check lives in code because it needs the commit data, but the consequence
-- is worth stating here: two students cannot both claim the same address for
-- the same commits, because an address GitHub has attributed to anybody is
-- never offered to anybody.
--
-- The primary key is per student, not global, on purpose. A shared machine
-- address genuinely used by two people is a real thing, and neither of them
-- is lying about it.

alter table student_commit_emails enable row level security;

-- Readable by the owner. Written only by the service role: this decides what
-- lands on a record, so a client that could insert here could attribute
-- anybody's commits to itself.
drop policy if exists "own commit emails" on student_commit_emails;
create policy "own commit emails" on student_commit_emails
  for select using (student_id = auth.uid());

create index if not exists student_commit_emails_student_idx
  on student_commit_emails (student_id);

-- ─── Addresses we have seen but nobody has claimed ───────────────────────────
-- Written by a scan, read by the page that asks "41 commits here are from
-- priya@lab-machine.local — is that you?". Separate from the table above
-- because it is a question, not an answer, and because it must be possible
-- to say no.
create table if not exists observed_commit_emails (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  email         text not null,
  -- The name git had configured next to it. This is what makes the question
  -- answerable at a glance — an address alone is often unrecognisable.
  display_name  text,
  repo_full_name text not null,
  commit_count  int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- Set when they say "not me", so we stop asking. Distinct from deleting
  -- the row, which would just make the next scan ask again.
  dismissed_at  timestamptz,
  unique (student_id, email, repo_full_name)
);

alter table observed_commit_emails enable row level security;

drop policy if exists "own observed emails" on observed_commit_emails;
create policy "own observed emails" on observed_commit_emails
  for select using (student_id = auth.uid());

create index if not exists observed_commit_emails_pending_idx
  on observed_commit_emails (student_id)
  where dismissed_at is null;
