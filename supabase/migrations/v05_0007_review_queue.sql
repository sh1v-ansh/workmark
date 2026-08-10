-- ============================================================
--  WORKMARK MIGRATION v05_0007 — human review queue
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  §3's fallback verification path. Deployment, package registry, and
--  passing CI cover code that runs; they cover nothing for a design
--  portfolio, a research writeup, or a demo that exists only as a video.
--  'human_review' was already a legal value of artifacts
--  .verification_method — this adds the queue that produces it.
--
--  Deliberately a queue and not a workflow: at current scale one person
--  reviews these, and a status enum plus a note is the whole mechanism.
-- ============================================================

create table if not exists review_requests (
  id            uuid default gen_random_uuid() primary key,
  student_id    uuid references students(id) on delete cascade not null,
  artifact_id   uuid references artifacts(id) on delete cascade,
  -- What the student is asking us to look at. A URL rather than a repo,
  -- since anything with a scannable repo doesn't need this path.
  url           text not null,
  -- The student's own account of what it is and what they did. The
  -- reviewer has no other context — there's no commit graph to read.
  note          text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at  timestamptz default now() not null,
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  -- Why, in the reviewer's words. Shown to the student on rejection —
  -- a rejection with no reason is unactionable and reads as arbitrary.
  review_note   text
);

create index if not exists idx_review_requests_status  on review_requests(status, requested_at);
create index if not exists idx_review_requests_student on review_requests(student_id);

alter table review_requests enable row level security;

-- Students see and file their own. They never update one: a consumer
-- editing the status of their own review request would make the record
-- worthless, the same reason disputes are insert-and-read only.
create policy "Students: read own review requests"
  on review_requests for select using (auth.uid() = student_id);

create policy "Students: file own review requests"
  on review_requests for insert with check (auth.uid() = student_id);

-- Reviewing is service-role only. There is no admin role in the schema
-- yet, so the reviewer is whoever holds the service key — an honest
-- reflection of "one person reviews these" rather than a permission
-- system pretending to be more than it is.
