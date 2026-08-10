import { describe, it, expect } from 'vitest'
import { validateHandle, suggestHandle, HANDLE_MAX } from '@/lib/profile/handle'
import { publicEngagements, hasPublicWork, type EngagementForDisplay } from '@/lib/profile/visibility'

describe('validateHandle', () => {
  it('accepts a normal handle and returns it normalized', () => {
    expect(validateHandle('  Shivansh-Soni  ')).toEqual({ ok: true, handle: 'shivansh-soni' })
  })

  it('rejects handles that are too short or too long', () => {
    expect(validateHandle('ab').ok).toBe(false)
    expect(validateHandle('a'.repeat(HANDLE_MAX + 1)).ok).toBe(false)
    expect(validateHandle('a'.repeat(HANDLE_MAX)).ok).toBe(true)
  })

  it('rejects characters that would break a URL or invite spoofing', () => {
    for (const bad of ['has space', 'has_underscore', 'has.dot', 'has/slash', 'emoji🙂', 'Ünicode']) {
      expect(validateHandle(bad).ok).toBe(false)
    }
  })

  it('rejects leading, trailing, and doubled hyphens', () => {
    expect(validateHandle('-lead').ok).toBe(false)
    expect(validateHandle('trail-').ok).toBe(false)
    expect(validateHandle('two--hyphens').ok).toBe(false)
    expect(validateHandle('one-hyphen').ok).toBe(true)
  })

  it('rejects a purely numeric handle — /p/12345 reads as an ID, not a name', () => {
    expect(validateHandle('12345').ok).toBe(false)
    expect(validateHandle('user123').ok).toBe(true)
  })

  it('rejects reserved routes so a handle can never shadow a real page', () => {
    for (const reserved of ['me', 'api', 'login', 'listings', 'students', 'engagements', 'admin', 'settings']) {
      expect(validateHandle(reserved).ok).toBe(false)
    }
  })

  it('is case-insensitive about reservations', () => {
    expect(validateHandle('API').ok).toBe(false)
    expect(validateHandle('Me').ok).toBe(false)
  })

  it('always gives a reason when it refuses', () => {
    for (const bad of ['ab', '-x-', 'api', '999', 'no spaces']) {
      const r = validateHandle(bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('suggestHandle', () => {
  it('prefers the GitHub username — already unique and already public', () => {
    expect(suggestHandle('Shivansh Soni', 'sh1v-ansh')).toBe('sh1v-ansh')
  })

  it('falls back to a slugified name', () => {
    expect(suggestHandle('Shivansh Soni', null)).toBe('shivansh-soni')
  })

  it('collapses punctuation and repeated separators', () => {
    expect(suggestHandle("Mary-Jane  O'Brien", null)).toBe('mary-jane-o-brien')
  })

  it('returns empty rather than an invalid suggestion', () => {
    expect(suggestHandle(null, null)).toBe('')
    expect(suggestHandle('!!', null)).toBe('')
    // Slugifies to a reserved word — better to suggest nothing than
    // something that will be rejected on submit.
    expect(suggestHandle('API', null)).toBe('')
  })
})

function eng(over: Partial<EngagementForDisplay> = {}): EngagementForDisplay {
  return {
    id: 'e1',
    visibility: 'full',
    stage: 'closed',
    listingTitle: 'Ingestion pipeline',
    posterDisplayName: 'Alex Chen',
    description: 'Built the retry logic.',
    closedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('publicEngagements — what a viewer may see', () => {
  it('shows a full-visibility closed engagement in full', () => {
    const [e] = publicEngagements([eng()])
    expect(e).toMatchObject({
      redacted: false,
      listingTitle: 'Ingestion pipeline',
      posterDisplayName: 'Alex Chen',
      description: 'Built the retry logic.',
    })
  })

  it('strips title, poster AND description when redacted', () => {
    const [e] = publicEngagements([eng({ visibility: 'redacted' })])
    expect(e.redacted).toBe(true)
    expect(e.listingTitle).toBeNull()
    expect(e.posterDisplayName).toBeNull()
    // The description routinely names the project — keeping it would
    // leak exactly what redaction is for.
    expect(e.description).toBeNull()
  })

  it('keeps the completion date on a redacted engagement — that it happened is the point', () => {
    const [e] = publicEngagements([eng({ visibility: 'redacted' })])
    expect(e.closedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('omits hidden engagements entirely', () => {
    expect(publicEngagements([eng({ visibility: 'hidden' })])).toEqual([])
  })

  it('leaks no count — a hidden engagement leaves no placeholder', () => {
    const withHidden = publicEngagements([
      eng({ id: 'a' }),
      eng({ id: 'b', visibility: 'hidden' }),
      eng({ id: 'c' }),
    ])
    const withoutHidden = publicEngagements([eng({ id: 'a' }), eng({ id: 'c' })])
    // Identical output: a viewer cannot tell the first list had more in it.
    expect(withHidden).toEqual(withoutHidden)
  })

  it('shows only closed work — in-flight and abandoned never appear as line items', () => {
    const result = publicEngagements([
      eng({ id: 'a', stage: 'accepted' }),
      eng({ id: 'b', stage: 'in_progress' }),
      eng({ id: 'c', stage: 'submitted' }),
      eng({ id: 'd', stage: 'abandoned' }),
      eng({ id: 'e', stage: 'closed' }),
    ])
    expect(result.map((r) => r.id)).toEqual(['e'])
  })

  it('does not turn an abandonment into a public mark — it lives only in the aggregate rate', () => {
    expect(publicEngagements([eng({ stage: 'abandoned' })])).toEqual([])
  })

  it('hasPublicWork agrees with the filtered list', () => {
    expect(hasPublicWork([eng({ visibility: 'hidden' })])).toBe(false)
    expect(hasPublicWork([eng({ stage: 'in_progress' })])).toBe(false)
    expect(hasPublicWork([eng()])).toBe(true)
    expect(hasPublicWork([])).toBe(false)
  })
})
