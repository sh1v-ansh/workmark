import { describe, it, expect } from 'vitest'
import { computeFit, assignTier, type ListingRequirement } from '@/lib/matching/fit'
import type { SkillDepth } from '@/lib/matching/depth'

function depthMap(entries: Record<string, number | { depth: number; verified: boolean }>): Map<string, SkillDepth> {
  return new Map(
    Object.entries(entries).map(([skillId, v]) => {
      const { depth, verified } = typeof v === 'number' ? { depth: v, verified: false } : v
      return [
        skillId,
        { skillId, depth, bestLevel: Math.round(depth), artifactCount: 1, hasVerifiedEvidence: verified },
      ]
    }),
  )
}

function req(skillId: string, requiredLevel = 3): ListingRequirement {
  return { skillId, requiredLevel }
}

describe('computeFit — presence, not threshold', () => {
  it('does NOT downgrade a student whose depth is below the stated required_level', () => {
    // required_level 5 ("Essential"), depth only 0.4 — still present, so
    // no gap. A threshold reading would make this a miss.
    const fit = computeFit([req('react', 5)], depthMap({ react: 0.4 }))
    expect(fit.missingSkillIds).toEqual([])
  })

  it('treats depth 0 with an evidence row as present, and no row as missing', () => {
    const present = computeFit([req('react')], depthMap({ react: 0 }))
    expect(present.missingSkillIds).toEqual([])
    expect(computeFit([req('react')], depthMap({})).missingSkillIds).toEqual(['react'])
  })

  it('names every gap', () => {
    const fit = computeFit([req('react'), req('python'), req('rust')], depthMap({ rust: 2 }))
    expect(fit.missingSkillIds.sort()).toEqual(['python', 'react'])
    expect(fit.matchedSkillIds).toEqual(['rust'])
  })

  it('computes rank score as the importance-weighted mean', () => {
    // (5×3 + 1×1) / 6
    const fit = computeFit([req('react', 5), req('python', 1)], depthMap({ react: 3, python: 1 }))
    expect(fit.rankScore).toBeCloseTo(16 / 6)
  })

  it('counts missing skills as 0 depth, so partial matches rank below full ones', () => {
    const full = computeFit([req('react'), req('python')], depthMap({ react: 2, python: 2 })).rankScore
    const partial = computeFit([req('react'), req('python')], depthMap({ react: 2 })).rankScore
    expect(partial).toBeLessThan(full)
  })

  it('handles a listing with no requirements without crashing', () => {
    expect(computeFit([], depthMap({}))).toMatchObject({ rankScore: 0, confidence: 0, missingSkillIds: [] })
  })
})

describe('computeFit — confidence (§7 step 5)', () => {
  it('is 1 when every required skill is backed by verified evidence', () => {
    const fit = computeFit(
      [req('react'), req('python')],
      depthMap({ react: { depth: 2, verified: true }, python: { depth: 2, verified: true } }),
    )
    expect(fit.confidence).toBe(1)
  })

  it('is 0 when everything is a bare repo link', () => {
    const fit = computeFit([req('react'), req('python')], depthMap({ react: 2, python: 2 }))
    expect(fit.confidence).toBe(0)
  })

  it('weights by importance, not by skill count', () => {
    // Essential skill verified, nice-to-have not: 5/6, not 1/2.
    const fit = computeFit(
      [req('react', 5), req('python', 1)],
      depthMap({ react: { depth: 2, verified: true }, python: { depth: 2, verified: false } }),
    )
    expect(fit.confidence).toBeCloseTo(5 / 6)
  })

  it('counts a missing skill as unverified', () => {
    const fit = computeFit(
      [req('react'), req('python')],
      depthMap({ react: { depth: 2, verified: true } }),
    )
    expect(fit.confidence).toBeCloseTo(0.5)
  })

  it('is independent of rank score — two students can share a score and differ in confidence', () => {
    const reqs = [req('react')]
    const a = computeFit(reqs, depthMap({ react: { depth: 2, verified: true } }))
    const b = computeFit(reqs, depthMap({ react: { depth: 2, verified: false } }))
    expect(a.rankScore).toBe(b.rankScore)
    expect(a.confidence).not.toBe(b.confidence)
  })
})

describe('assignTier — pool-relative (§7)', () => {
  const fullPresence = (score: number) => computeFit([req('react')], depthMap({ react: score }))

  it('is not_yet when two or more skills are missing, whatever the pool', () => {
    const fit = computeFit([req('a'), req('b'), req('c')], depthMap({ a: 9 }))
    expect(assignTier(fit, [0, 0, 0])).toBe('not_yet')
    expect(assignTier(fit, [])).toBe('not_yet')
  })

  it('is reach when exactly one skill is missing, whatever the pool', () => {
    const fit = computeFit([req('a'), req('b')], depthMap({ a: 9 }))
    expect(assignTier(fit, [0, 0, 0])).toBe('reach')
  })

  it('is competitive against an empty pool — no distribution to be top quartile of', () => {
    expect(assignTier(fullPresence(5), [])).toBe('competitive')
    expect(assignTier(fullPresence(0.1), [])).toBe('competitive')
  })

  it('is strong_fit in the top quartile of current applicants', () => {
    const pool = [1, 2, 3, 4]
    expect(assignTier(fullPresence(5), pool)).toBe('strong_fit') // beats 4/4
  })

  it('is competitive above the median but below the top quartile', () => {
    // Needs a pool with a band between 0.5 and 0.75 — a four-element pool
    // only produces shares of 0, .25, .5, .75, 1, so it has no such band.
    const pool = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(assignTier(fullPresence(5.5), pool)).toBe('competitive') // beats 5/8 = 0.625
  })

  it('treats beating three of four applicants as the top quartile', () => {
    expect(assignTier(fullPresence(3.5), [1, 2, 3, 4])).toBe('strong_fit') // beats 3/4 = 0.75
  })

  it('is reach at or below the median even with full presence', () => {
    const pool = [1, 2, 3, 4]
    expect(assignTier(fullPresence(2.5), pool)).toBe('reach') // beats 2/4 = 0.5
    expect(assignTier(fullPresence(0.5), pool)).toBe('reach') // beats 0/4
  })

  it('is relative — the same score lands in different tiers against different pools', () => {
    const fit = fullPresence(3)
    expect(assignTier(fit, [10, 20, 30, 40])).toBe('reach')
    expect(assignTier(fit, [0.1, 0.2, 0.3, 0.4])).toBe('strong_fit')
  })

  it('handles a single-applicant pool', () => {
    expect(assignTier(fullPresence(5), [1])).toBe('strong_fit')
    expect(assignTier(fullPresence(0.5), [1])).toBe('reach')
  })

  it('tolerates the student\'s own score being present in the pool', () => {
    // Callers aren't required to strip it; requiring that would be a
    // subtle correctness trap.
    const fit = fullPresence(5)
    expect(['strong_fit', 'competitive']).toContain(assignTier(fit, [1, 2, 3, 5]))
  })
})
