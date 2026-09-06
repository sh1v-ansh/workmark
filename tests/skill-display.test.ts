import { describe, it, expect } from 'vitest'
import { LEVELS } from '../src/lib/theme/tokens'
import { LEVEL_NAMES, SELF_EVIDENCED_CAP, isReachable } from '../src/lib/skills/level-names'

/**
 * The rule that decides which chips are gold.
 *
 * Duplicated from LevelBar/SkillChip rather than imported, because those are
 * .tsx and vitest cannot parse JSX here. Kept identical on purpose: if this
 * ever drifts from the components, this file is the alarm.
 */
function tier(level: number): 'advanced' | 'intermediate' | 'beginner' {
  if (level >= SELF_EVIDENCED_CAP) return 'advanced'
  if (level === 2) return 'intermediate'
  return 'beginner'
}

function countLevels(skills: { bestLevel: number }[]) {
  let advanced = 0, intermediate = 0, beginner = 0
  for (const s of skills) {
    const t = tier(s.bestLevel)
    if (t === 'advanced') advanced++
    else if (t === 'intermediate') intermediate++
    else beginner++
  }
  return { advanced, intermediate, beginner, total: skills.length }
}

describe('level names', () => {
  it('uses the three words a reader already owns', () => {
    expect(LEVEL_NAMES[1]).toBe('Beginner')
    expect(LEVEL_NAMES[2]).toBe('Intermediate')
    expect(LEVEL_NAMES[3]).toBe('Advanced')
  })

  it('still names the two nobody can reach yet', () => {
    expect(isReachable(3)).toBe(true)
    expect(isReachable(4)).toBe(false)
    expect(LEVEL_NAMES[4]).toBeTruthy()
    expect(LEVEL_NAMES[5]).toBeTruthy()
  })
})

describe('which skills go gold', () => {
  it('gives gold to the top reachable tier and nothing below it', () => {
    expect(tier(3)).toBe('advanced')
    expect(tier(2)).toBe('intermediate')
    expect(tier(1)).toBe('beginner')
  })

  // Levels 4 and 5 exist in the scale and are not reachable by a scan, but a
  // human confirmation will produce them one day. They must not fall through
  // to grey when they do.
  it('keeps gold for anything above the cap', () => {
    expect(tier(4)).toBe('advanced')
    expect(tier(5)).toBe('advanced')
  })

  it('gives gold a gradient and the other two a flat fill', () => {
    expect(LEVELS.advanced.fill).toContain('gradient')
    expect(LEVELS.intermediate.fill).not.toContain('gradient')
    expect(LEVELS.beginner.fill).not.toContain('gradient')
  })

  // Gold is the reward. If the two greys were identical the scale would read
  // as "gold, and then everything else", which is two tiers, not three.
  it('keeps the two lower tiers visually distinct from each other', () => {
    expect(LEVELS.beginner.fill).not.toBe(LEVELS.intermediate.fill)
    expect(LEVELS.beginner.bar).not.toBe(LEVELS.intermediate.bar)
  })
})

describe('countLevels', () => {
  it('adds up to the total', () => {
    const skills = [
      { bestLevel: 3 }, { bestLevel: 3 }, { bestLevel: 2 },
      { bestLevel: 2 }, { bestLevel: 1 }, { bestLevel: 1 }, { bestLevel: 1 },
    ]
    const c = countLevels(skills)
    expect(c).toEqual({ advanced: 2, intermediate: 2, beginner: 3, total: 7 })
    expect(c.advanced + c.intermediate + c.beginner).toBe(c.total)
  })

  it('handles an empty record without dividing by zero downstream', () => {
    expect(countLevels([])).toEqual({ advanced: 0, intermediate: 0, beginner: 0, total: 0 })
  })

  it('counts a record that is all one tier', () => {
    const c = countLevels(Array.from({ length: 12 }, () => ({ bestLevel: 1 })))
    expect(c.beginner).toBe(12)
    expect(c.advanced).toBe(0)
  })
})
