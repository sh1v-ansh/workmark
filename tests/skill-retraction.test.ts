import { describe, it, expect } from 'vitest'
import { retractionsFor, mayRetract } from '../src/lib/skills/retraction'

const claim = (skillId: string, evidenceId = `ev-${skillId}`) => ({ evidenceId, skillId })

describe('retractionsFor', () => {
  it('leaves alone what the scan still supports', () => {
    const out = retractionsFor([claim('react')], { supported: new Set(['react']) })
    expect(out).toEqual([])
  })

  // The case this module exists for. A record said Advanced at cryptography
  // because one bcrypt line cleared a threshold it should not have. Fixing
  // the rule did nothing for the row already written.
  it('retracts what the scan no longer supports', () => {
    const out = retractionsFor([claim('cryptography'), claim('react')], { supported: new Set(['react']) })
    expect(out.map((r) => r.skillId)).toEqual(['cryptography'])
    expect(out[0].evidenceId).toBe('ev-cryptography')
    expect(out[0].reason).toMatch(/no longer supports/)
  })

  it('retracts everything when the scan supports nothing', () => {
    const out = retractionsFor([claim('a'), claim('b')], { supported: new Set() })
    expect(out).toHaveLength(2)
  })

  it('has nothing to do on a repo with no record yet', () => {
    expect(retractionsFor([], { supported: new Set(['react']) })).toEqual([])
  })
})

describe('mayRetract', () => {
  const good = { scanned: true, partial: false, studentCommitCount: 12, resolvedCount: 7 }

  it('allows it after a scan that plainly worked', () => {
    expect(mayRetract(good)).toBe(true)
  })

  // The whole reason this guard exists. A scan that died halfway looks
  // identical to one that found nothing — both end with an empty set — and
  // letting the first one retract means a rate limit empties a record.
  it('refuses after a scan that only partly finished', () => {
    expect(mayRetract({ ...good, partial: true })).toBe(false)
  })

  it('refuses when the repository was skipped', () => {
    expect(mayRetract({ ...good, scanned: false })).toBe(false)
  })

  // No commits of theirs is not a verdict on skills they proved when they
  // did have commits here — it usually means we failed to match their email.
  it('refuses when none of the commits matched the student', () => {
    expect(mayRetract({ ...good, studentCommitCount: 0 })).toBe(false)
  })

  // A scan resolving nothing at all is far more likely to be a broken scan
  // than a repo that genuinely demonstrates nothing.
  it('refuses when the scan resolved no skills whatsoever', () => {
    expect(mayRetract({ ...good, resolvedCount: 0 })).toBe(false)
  })

  it('allows it when a working scan resolved fewer skills than before', () => {
    expect(mayRetract({ ...good, resolvedCount: 1 })).toBe(true)
  })
})
