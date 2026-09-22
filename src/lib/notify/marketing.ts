// Permission to send somebody something they did not ask for.
//
// ── The line this module draws ────────────────────────────────────────────
// Everything in prefs.ts is transactional: the recipient did something and
// this is the outcome. Somebody applied to your project. Your work was
// checked. Those need no consent beyond the account itself, and CAN-SPAM
// exempts them from the postal-address rule.
//
// This is the other kind. "A role came up that fits what you can build."
// A hackathon. A fellowship. Useful, wanted by most people, and still
// marketing — because it is not the outcome of anything they did. It needs
// consent that was freely given, specific, informed and unambiguous
// (GDPR Art. 4(11)), a postal address in the footer (CAN-SPAM §7704), and
// withdrawal as easy as the giving (Art. 7(3)).
//
// Keeping the two apart in code is what stops the easy mistake: reusing the
// notification-preference map, which treats an absent key as yes and would
// therefore have opted in every account that ever existed.

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The exact words somebody ticks.
 *
 * Stored on the account alongside the timestamp, because Art. 7(1) puts the
 * burden of proof on us and a boolean proves nothing. Change this and you
 * must change CONSENT_VERSION with it — everyone who agreed to the old
 * wording stays proved against the old wording, which is the point.
 *
 * Written to be specific about the categories, because consent to "emails
 * from Workmark" is not specific and therefore is not consent.
 */
export const CONSENT_TEXT =
  'Tell me when a role, internship, hackathon or fellowship comes up that '
  + 'fits what my record shows I can build. This is how Workmark brings work '
  + 'to me rather than waiting for me to find it. I can turn it off any time.'

/**
 * Bumped whenever CONSENT_TEXT changes materially.
 *
 * Existing rows keep the version they agreed to. Somebody who consented to
 * v1 has not consented to v2, and finding everyone who needs re-asking has
 * to be one query rather than a diff across every stored string.
 */
export const CONSENT_VERSION = '2026-09-22b'

export type ConsentSource = 'onboarding' | 'settings'

/** The columns that decide whether marketing may be sent to somebody. */
export interface MarketingConsent {
  optedInAt: string | null
  optedOutAt: string | null
}

/**
 * May we send this person marketing?
 *
 * Opted out wins regardless of dates. A record where both are set and the
 * opt-out is older would mean they opted back in, which is legitimate — but
 * reading that from two timestamps is the kind of subtlety that goes wrong
 * silently and expensively, so the answer to "are both set" is no. Opting
 * back in clears the opt-out explicitly; see setConsent.
 */
export function mayEmail(consent: MarketingConsent | null | undefined): boolean {
  if (!consent) return false
  if (consent.optedOutAt !== null) return false
  return consent.optedInAt !== null
}

/**
 * Record a decision, either way.
 *
 * Opting in clears the opt-out rather than leaving both set, so mayEmail
 * never has to compare two timestamps. Opting out leaves opted_in_at where
 * it is — the fact that they once agreed is part of the record, and erasing
 * it would lose the ability to show what they agreed to and when.
 */
export async function setConsent(
  admin: SupabaseClient,
  userId: string,
  optedIn: boolean,
  source: ConsentSource,
): Promise<void> {
  const now = new Date().toISOString()

  const patch = optedIn
    ? {
        marketing_opted_in_at: now,
        marketing_opted_out_at: null,
        marketing_consent_text: CONSENT_TEXT,
        marketing_consent_version: CONSENT_VERSION,
        marketing_consent_source: source,
      }
    : {
        marketing_opted_out_at: now,
      }

  const { error } = await admin.from('accounts').update(patch).eq('id', userId)
  if (error) throw new Error(`Could not record the choice: ${error.message}`)
}

/**
 * The fields to write when an account is first created.
 *
 * Separate from setConsent because the account row does not exist yet — it
 * is being inserted — and because "declined at signup" must be stored as
 * nothing rather than as an opt-out. Never asked and said no look the same
 * to mayEmail, and should: both mean do not send. But an opt-out timestamp
 * on somebody who simply left a box unticked would later read as a
 * withdrawal they never made.
 */
export function consentFieldsForSignup(optedIn: boolean): Record<string, string | null> {
  if (!optedIn) {
    return {
      marketing_opted_in_at: null,
      marketing_opted_out_at: null,
      marketing_consent_text: null,
      marketing_consent_version: null,
      marketing_consent_source: null,
    }
  }
  return {
    marketing_opted_in_at: new Date().toISOString(),
    marketing_opted_out_at: null,
    marketing_consent_text: CONSENT_TEXT,
    marketing_consent_version: CONSENT_VERSION,
    marketing_consent_source: 'onboarding',
  }
}
