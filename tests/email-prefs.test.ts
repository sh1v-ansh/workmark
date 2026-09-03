import { describe, it, expect } from 'vitest'
import { wantsEmail, EMAIL_KINDS } from '@/lib/notify/prefs'

// A stand-in for the one query wantsEmail makes.
function client(row: Record<string, unknown> | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error }) }),
      }),
    }),
  } as never
}

describe('wantsEmail', () => {
  it('sends when nothing has been switched off', async () => {
    expect(await wantsEmail(client({ notification_prefs: {}, email_unsubscribed_at: null }), 'u', 'work_submitted')).toBe(true)
  })

  it('respects a single kind being switched off', async () => {
    const row = { notification_prefs: { work_submitted: false }, email_unsubscribed_at: null }
    expect(await wantsEmail(client(row), 'u', 'work_submitted')).toBe(false)
    expect(await wantsEmail(client(row), 'u', 'engagement_closed')).toBe(true)
  })

  // The behaviour most likely to be got wrong later: unsubscribing from
  // "you have an applicant" must not stop the answer to an application the
  // same person sent.
  it('still sends essential mail after unsubscribing from everything', async () => {
    const row = { notification_prefs: {}, email_unsubscribed_at: '2026-01-01T00:00:00Z' }
    expect(await wantsEmail(client(row), 'u', 'application_received')).toBe(false)
    expect(await wantsEmail(client(row), 'u', 'application_accepted')).toBe(true)
    expect(await wantsEmail(client(row), 'u', 'application_rejected')).toBe(true)
  })

  // Fails open on purpose: a database hiccup must not silently swallow the
  // message telling someone they got onto a project.
  it('sends when the preference lookup fails', async () => {
    expect(await wantsEmail(client(null, { message: 'boom' }), 'u', 'work_submitted')).toBe(true)
  })

  it('treats a kind nobody has an opinion about as on', async () => {
    for (const kind of Object.keys(EMAIL_KINDS)) {
      expect(await wantsEmail(client({ notification_prefs: {}, email_unsubscribed_at: null }), 'u', kind as never)).toBe(true)
    }
  })
})
