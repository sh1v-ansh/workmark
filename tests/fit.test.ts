import { describe, it, expect } from 'vitest'
import { computeFit, type ListingRequirement } from '@/lib/matching/fit'
import type { SkillDepth } from '@/lib/matching/depth'

function depthMap(entries: Record<string, number>): Map<string, SkillDepth> {
  return new Map(
    Object.entries(entries).map(([skillId, depth]) => [
      skillId,
      { skillId, depth, bestLevel: Math.round(depth), artifactCount: 1 },
    ]),
  )
}

function req(skillId: string, requiredLevel = 3): ListingRequirement {
  return { skillId, requiredLevel }
}

describe('computeFit — tier assignment is presence-based', () => {
  it('is competitive when every required skill has evidence', () => {
    const fit = computeFit([req('react'), req('python')], depthMap({ react: 1.2, python: 1.2 }))
    expect(fit.tier).toBe('competitive')
    expect(fit.missingSkillIds).toEqual([])
  })

  it('upgrades to strong_fit when weighted mean depth reaches 3.0', () => {
    const fit = computeFit([req('react'), req('python')], depthMap({ react: 3.0, python: 3.2 }))
    expect(fit.tier).toBe('strong_fit')
  })

  it('is reach when exactly one required skill has no evidence', () => {
    const fit = computeFit([req('react'), req('python')], depthMap({ react: 1.2 }))
    expect(fit.tier).toBe('reach')
    expect(fit.missingSkillIds).toEqual(['python'])
  })

  it('is not_yet when two or more required skills have no evidence', () => {
    const fit = computeFit([req('react'), req('python'), req('rust')], depthMap({ react: 1.2 }))
    expect(fit.tier).toBe('not_yet')
    expect(fit.missingSkillIds).toEqual(['python', 'rust'])
  })

  it('names every gap so the student knows exactly what is missing', () => {
    const fit = computeFit([req('react'), req('python'), req('rust')], depthMap({ rust: 2 }))
    expect(fit.missingSkillIds.sort()).toEqual(['python', 'react'])
    expect(fit.matchedSkillIds).toEqual(['rust'])
  })

  it('treats a listing with no requirements as competitive rather than crashing', () => {
    const fit = computeFit([], depthMap({}))
    expect(fit.tier).toBe('competitive')
    expect(fit.rankScore).toBe(0)
  })
})

describe('computeFit — required_level is IMPORTANCE, never a threshold', () => {
  // This is the property most likely to be broken by a well-meaning
  // "improvement", so it gets asserted directly rather than implied.
  it('does NOT downgrade a student whose depth is below the stated required_level', () => {
    // required_level 5 ("Essential"), student depth only 0.4 — still
    // present, so still competitive. A threshold reading would make this
    // a miss.
    const fit = computeFit([req('react', 5)], depthMap({ react: 0.4 }))
    expect(fit.tier).toBe('competitive')
    expect(fit.missingSkillIds).toEqual([])
  })

  it('treats depth 0 with an evidence row as present, and no row as missing', () => {
    const present = computeFit([req('react')], new Map([['react', { skillId: 'react', depth: 0, bestLevel: 0, artifactCount: 1 }]]))
    expect(present.missingSkillIds).toEqual([])

    const absent = computeFit([req('react')], depthMap({}))
    expect(absent.missingSkillIds).toEqual(['react'])
  })

  it('weights rank score by importance — the same depth counts more on an essential skill', () => {
    const depth = depthMap({ react: 3, python: 0.5 })
    const reactEssential = computeFit([req('react', 5), req('python', 1)], depth).rankScore
    const pythonEssential = computeFit([req('react', 1), req('python', 5)], depth).rankScore
    expect(reactEssential).toBeGreaterThan(pythonEssential)
  })

  it('computes rank score as the importance-weighted mean', () => {
    // (5×3 + 1×1) / (5+1) = 16/6
    const fit = computeFit([req('react', 5), req('python', 1)], depthMap({ react: 3, python: 1 }))
    expect(fit.rankScore).toBeCloseTo(16 / 6)
  })

  it('counts missing skills as 0 depth, so a partial match ranks below a full one', () => {
    const full = computeFit([req('react'), req('python')], depthMap({ react: 2, python: 2 })).rankScore
    const partial = computeFit([req('react'), req('python')], depthMap({ react: 2 })).rankScore
    expect(partial).toBeLessThan(full)
    expect(partial).toBeCloseTo(1) // (3×2 + 3×0) / 6
  })
})

describe('computeFit — ranking within a tier', () => {
  it('ranks a deeper candidate above a shallower one with identical presence', () => {
    const reqs = [req('react'), req('python')]
    const deep = computeFit(reqs, depthMap({ react: 3, python: 3 }))
    const shallow = computeFit(reqs, depthMap({ react: 1, python: 1 }))
    expect(deep.tier).toBe('strong_fit')
    expect(shallow.tier).toBe('competitive')
    expect(deep.rankScore).toBeGreaterThan(shallow.rankScore)
  })

  it('reports per-skill detail for every requirement, present or not', () => {
    const fit = computeFit([req('react'), req('python')], depthMap({ react: 2 }))
    expect(fit.perSkill).toHaveLength(2)
    expect(fit.perSkill.find((s) => s.skillId === 'react')).toMatchObject({ present: true, depth: 2 })
    expect(fit.perSkill.find((s) => s.skillId === 'python')).toMatchObject({ present: false, depth: 0 })
  })
})
