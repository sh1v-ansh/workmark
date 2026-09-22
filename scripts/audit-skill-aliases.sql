-- Find the wrong answers the canonicaliser has already cached.
--
-- ── Why a script and not a migration ─────────────────────────────────────────
-- These rows are judgement calls. `bcr` resolving to Cryptography might be a
-- real abbreviation somebody used or might be nonsense the embedding matched
-- by accident, and no rule written in advance can tell them apart. So this
-- lists them for a person to read; the deletes at the bottom are commented
-- out on purpose.
--
-- ── Why they are there ───────────────────────────────────────────────────────
-- canonicalizeSkills auto-accepts a nearest-neighbour match at 0.85 cosine
-- similarity and writes it to skill_aliases, which means a wrong answer is
-- cached and re-fires on every future scan for every student. The taxonomy
-- embeddings are built from the canonical name alone, so a node called "R"
-- is stored as the embedding of one letter — a vector with almost no meaning,
-- which short or opaque tokens land near by accident. That is fixed going
-- forward (see degenerateTarget in canonicalize.ts). This finds what was
-- already written.

-- ─── 1. Matches against one- and two-character names ─────────────────────────
-- The degenerate-embedding cases. Anything here that is not an exact,
-- case-insensitive match for the skill's own name is almost certainly wrong.
select
  a.raw_string,
  a.skill_id,
  s.canonical_name,
  a.created_at,
  case
    when lower(a.raw_string) = lower(s.canonical_name) then 'exact — keep'
    else 'SUSPECT — the embedding guessed this'
  end as verdict
from skill_aliases a
join skills s on s.id = a.skill_id
where length(trim(s.canonical_name)) <= 2
order by verdict desc, a.created_at desc;

-- ─── 2. How many students each wrong alias has already affected ──────────────
-- Run this before deleting anything: it says whether a bad alias put a skill
-- on one record or on all of them, which decides whether a re-scan is worth
-- asking people to do.
select
  s.canonical_name,
  count(distinct e.student_id) as students_affected,
  count(*) as evidence_rows
from current_skill_evidence e
join skills s on s.id = e.skill_id
where length(trim(s.canonical_name)) <= 2
group by s.canonical_name
order by students_affected desc;

-- ─── 3. Cryptography, specifically ───────────────────────────────────────────
-- Not a bad alias — bcrypt really does map to Cryptography, deliberately, in
-- seed-aliases.ts. The bug there was never the name, it was the level: a
-- manifest line the student never touched cleared the evidence bar and then
-- inherited the whole repository's difficulty score. Fixed in relevance.ts.
--
-- This shows who is currently carrying the skill and at what level, so the
-- before/after of a re-scan is checkable.
select
  e.student_id,
  e.difficulty_cleared,
  e.raw_composite,
  e.verification_method
from current_skill_evidence e
join skills s on s.id = e.skill_id
where s.id = 'cryptography'
order by e.difficulty_cleared desc;

-- ─── 4. The cleanup, when you have read the above ────────────────────────────
-- Deleting an alias does not remove the evidence it produced; it only stops
-- the next scan repeating the mistake. Re-scanning is what corrects a record,
-- because writeOrCorrectEvidence is what supersedes an existing row.
--
-- Uncomment, edit the list to what you actually decided, and run.

-- delete from skill_aliases
-- where skill_id in ('r-lang')
--   and lower(raw_string) <> 'r';
