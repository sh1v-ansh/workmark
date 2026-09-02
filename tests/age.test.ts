import { describe, it, expect } from 'vitest'
import { ageOn, eligibleOn, parseDob, MINIMUM_AGE } from '@/lib/auth/age'

// The whole point of this module is the boundary, so that's what's tested.
// Getting it wrong by one day either lets a minor in or locks out someone
// on their birthday, and both are the kind of bug nobody reports.

describe('parseDob', () => {
  it('accepts a real date', () => {
    expect(parseDob('2008-03-04')).toEqual({ y: 2008, m: 3, d: 4 })
  })

  it('rejects days that do not exist', () => {
    expect(parseDob('2007-02-30')).toBeNull()
    expect(parseDob('2007-13-01')).toBeNull()
  })

  it('rejects anything that is not YYYY-MM-DD', () => {
    expect(parseDob('')).toBeNull()
    expect(parseDob('03/04/2008')).toBeNull()
    expect(parseDob('2008-3-4')).toBeNull()
  })
})

describe('ageOn', () => {
  const dob = parseDob('2008-06-15')!

  it('is 17 the day before the birthday', () => {
    expect(ageOn(dob, new Date(2026, 5, 14))).toBe(17)
  })

  it('is 18 on the birthday itself', () => {
    expect(ageOn(dob, new Date(2026, 5, 15))).toBe(MINIMUM_AGE)
  })

  it('is 17 earlier in the same year', () => {
    expect(ageOn(dob, new Date(2026, 0, 1))).toBe(17)
  })

  // The reason parsing is manual: `new Date('2008-06-15')` is UTC midnight,
  // so a naive comparison makes someone in a negative-offset timezone a day
  // younger than they are on their own calendar.
  it('uses local calendar dates, not UTC instants', () => {
    expect(ageOn(dob, new Date(2026, 5, 15, 0, 30))).toBe(18)
  })
})

describe('eligibleOn', () => {
  it('is the eighteenth birthday', () => {
    expect(eligibleOn(parseDob('2009-09-02')!)).toBe('2027-09-02')
  })

  it('rolls a 29 February birthday onto 1 March in a non-leap year', () => {
    expect(eligibleOn(parseDob('2008-02-29')!)).toBe('2026-03-01')
  })
})
