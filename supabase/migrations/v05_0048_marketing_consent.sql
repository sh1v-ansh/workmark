-- Permission to send somebody an opportunity they did not ask about.

-- ─── Why this is not a notification preference ───────────────────────────────
-- accounts.notification_prefs already decides who gets told that somebody
-- applied to their project. That is transactional mail: the recipient did
-- something, and this is the outcome. It is exempt under CAN-SPAM's
-- transactional carve-out and needs no consent under GDPR beyond the contract
-- itself.
--
-- "A job came across my desk and you would be a good fit", a hackathon, a
-- fellowship — none of those are the outcome of anything the student did.
-- They are marketing, whether or not they are useful, and marketing is a
-- different legal object: it needs a physical postal address in the footer
-- (CAN-SPAM), and in the EU/UK it needs consent that was freely given,
-- specific, informed and unambiguous (GDPR Art. 4(11) and Art. 7).
--
-- Folding it into notification_prefs would have made it default-on, because
-- that map treats an absent key as yes. Default-on consent is not consent.

-- ─── What has to be stored, and why each column exists ───────────────────────
-- Art. 7(1) puts the burden of proof on us: we must be able to demonstrate
-- that this person consented. A boolean cannot do that. It says somebody,
-- at some point, agreed to something unspecified.
--
--   opted_in_at      — when. Also what makes withdrawal provable: a row with
--                      opted_out_at later than opted_in_at is a complete
--                      record of both halves.
--   consent_text     — the exact words on screen when they ticked it. If the
--                      wording is ever changed, everyone already opted in
--                      stays proved against what they actually read, not
--                      against today's copy.
--   consent_version  — so a material change to the categories can be found
--                      and re-asked without reading every row's text.
--   opted_out_at     — withdrawal has to be as easy as giving it (Art. 7(3)),
--                      and has to be recorded rather than just flipping the
--                      flag back, or "did they ever unsubscribe" is
--                      unanswerable.
--   source           — 'onboarding' or 'settings'. Tells a real opt-in at
--                      signup from one toggled later, which is the first
--                      question asked when a complaint arrives.

alter table accounts
  add column if not exists marketing_opted_in_at   timestamptz,
  add column if not exists marketing_opted_out_at  timestamptz,
  add column if not exists marketing_consent_text  text,
  add column if not exists marketing_consent_version text,
  add column if not exists marketing_consent_source text;

-- Every existing account stays null, which reads as "never asked" and sends
-- nothing. Backfilling these as opted in would be inventing a consent that
-- was never given, which is the precise thing the columns exist to prevent.

comment on column accounts.marketing_opted_in_at is
  'When this person agreed to hear about opportunities. Null means never asked or never agreed — either way, do not send.';
comment on column accounts.marketing_consent_text is
  'The exact wording they were shown. Proof under GDPR Art. 7(1), which puts the burden on us.';

-- ─── The one query that matters ──────────────────────────────────────────────
-- Partial, because the rows that can be sent to are a small slice and this is
-- the only way that slice is ever selected. A full index on a nullable
-- timestamp would be mostly nulls.
create index if not exists accounts_marketing_sendable_idx
  on accounts (marketing_opted_in_at)
  where marketing_opted_in_at is not null and marketing_opted_out_at is null;
