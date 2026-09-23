import { describe, it, expect } from 'vitest'
import { mayEmail, consentFieldsForSignup, CONSENT_TEXT, CONSENT_VERSION } from '../src/lib/notify/marketing'

describe('mayEmail', () => {
  it('sends to somebody who agreed and has not withdrawn', () => {
    expect(mayEmail({ optedInAt: '2026-09-22T10:00:00Z', optedOutAt: null })).toBe(true)
  })

  // The single most important case. An absent record is "never asked", and
  // the notification-preference map elsewhere in this app treats absent as
  // yes — which is exactly the mistake this module exists to not repeat.
  it('does not send to somebody who was never asked', () => {
    expect(mayEmail({ optedInAt: null, optedOutAt: null })).toBe(false)
    expect(mayEmail(null)).toBe(false)
    expect(mayEmail(undefined)).toBe(false)
  })

  it('does not send to somebody who withdrew', () => {
    expect(mayEmail({ optedInAt: '2026-09-22T10:00:00Z', optedOutAt: '2026-09-23T10:00:00Z' })).toBe(false)
  })

  // Reading "they opted back in" out of two timestamps is the kind of
  // subtlety that fails silently and expensively. Opting back in clears the
  // opt-out, so both set is always no.
  it('refuses when both are set, whatever the order', () => {
    expect(mayEmail({ optedInAt: '2026-09-24T10:00:00Z', optedOutAt: '2026-09-23T10:00:00Z' })).toBe(false)
  })
})

describe('consentFieldsForSignup', () => {
  it('records the wording and the version when they agreed', () => {
    const fields = consentFieldsForSignup(true)
    expect(fields.marketing_opted_in_at).toBeTruthy()
    expect(fields.marketing_consent_text).toBe(CONSENT_TEXT)
    expect(fields.marketing_consent_version).toBe(CONSENT_VERSION)
    expect(fields.marketing_consent_source).toBe('onboarding')
    expect(fields.marketing_opted_out_at).toBeNull()
  })

  // Leaving a box unticked is not a withdrawal. Writing an opt-out
  // timestamp would later read as one they never made.
  it('writes nothing at all when they left the box unticked', () => {
    const fields = consentFieldsForSignup(false)
    expect(Object.values(fields).every((v) => v === null)).toBe(true)
  })

  it('produces a record that mayEmail then refuses', () => {
    const fields = consentFieldsForSignup(false)
    expect(mayEmail({
      optedInAt: fields.marketing_opted_in_at,
      optedOutAt: fields.marketing_opted_out_at,
    })).toBe(false)
  })
})

describe('the consent wording', () => {
  // Consent to "emails from Workmark" is not specific, and therefore is not
  // consent under Art. 4(11). It has to name what it covers.
  it('names the categories it covers', () => {
    for (const category of ['role', 'internship', 'hackathon', 'fellowship']) {
      expect(CONSENT_TEXT.toLowerCase()).toContain(category)
    }
  })

  // Withdrawal has to be as easy as the giving, and somebody agreeing has to
  // have been told it is possible. Matched loosely on purpose — this is
  // asserting the promise is present, not policing the phrasing.
  it('says it can be switched off', () => {
    expect(CONSENT_TEXT).toMatch(/turn it off|turn this off|unsubscribe|stop at any time/i)
  })
})
