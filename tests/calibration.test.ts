import { describe, it, expect } from 'vitest'
import { tercileOf, BOOTSTRAP_THRESHOLD } from '../src/lib/skills/calibration'
import { levelName, isReachable, SELF_EVIDENCED_CAP, LEVEL_NAMES } from '../src/lib/skills/level-names'

describe('percentile bands', () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90]

  it('puts the bottom third at level 1 and the top third at level 3', () => {
    expect(tercileOf(10, sorted)).toBe(1)
    expect(tercileOf(50, sorted)).toBe(2)
    expect(tercileOf(90, sorted)).toBe(3)
  })

  it('handles an empty distribution without dividing by zero', () => {
    expect(tercileOf(42, [])).toBe(1)
  })

  it('never returns a level above the self-evidenced cap', () => {
    // The whole point of terciles here: a scan can produce 1, 2 or 3 and
    // nothing else, because anything higher needs someone to vouch.
    for (const v of sorted) expect(tercileOf(v, sorted)).toBeLessThanOrEqual(SELF_EVIDENCED_CAP)
  })

  it('waits for enough students before ranking anyone against anyone', () => {
    expect(BOOTSTRAP_THRESHOLD).toBeGreaterThanOrEqual(30)
  })
})

describe('level names', () => {
  it('names every level, including the ones not yet reachable', () => {
    expect(levelName(1)).toBe('Familiar')
    expect(levelName(3)).toBe('Strong')
    expect(levelName(5)).toBe('Expert')
  })

  it('knows which levels a scan can actually produce', () => {
    expect(isReachable(3)).toBe(true)
    expect(isReachable(4)).toBe(false)
    expect(isReachable(5)).toBe(false)
  })

  it('falls back rather than showing undefined for an unexpected value', () => {
    expect(levelName(9)).toBe('Level 9')
  })

  it('has a name for every level up to Expert', () => {
    expect(Object.keys(LEVEL_NAMES)).toHaveLength(5)
  })
})
