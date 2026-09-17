-- ============================================================
--  WORKMARK MIGRATION v05_0043 — ask better questions, store the answers
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  An application was one free-text box asking for 50 to 250 words about what
--  the student had built. That is a request for fluent prose about past work,
--  which is the cheapest thing a language model produces — so every answer
--  read the same and posters learned nothing from any of them.
--
--  Two short questions instead, written against the specific listing when it
--  is posted, answered in under sixty words each. See lib/applications/
--  questions.ts for what they ask and why.
-- ============================================================

-- Written once at post time by the listing agent, so the cost is per listing
-- rather than per applicant. Null means this listing never had them generated
-- and the fallback pair is used — questionsFor() degrades rather than
-- rendering an empty form.
alter table listings
  add column if not exists application_questions jsonb;

comment on column listings.application_questions is
  'Two short judgement questions, generated from this listing. Null falls back to the standard pair.';

-- One answer per question, as [{question_id, question, answer}]. The question
-- text is stored alongside the answer on purpose: a poster reading an
-- application in three months needs to see what was asked, and a listing can
-- be edited after somebody has applied to it.
alter table applications
  add column if not exists responses jsonb;

comment on column applications.responses is
  'Answers with the question text as asked. response_text is the old single-box field, kept for applications made before v05_0043.';
