import { describe, it, expect } from 'vitest'
import { gapClosedByListing } from '@/lib/matching/goals'
import type { SkillDepth } from '@/lib/matching/depth'

function depthMap(skillIds: string[]): Map<string, SkillDepth> {
  return new Map(
    skillIds.map((id) => [id, { skillId: id, depth: 2, bestLevel: 2, artifactCount: 1, hasVerifiedEvidence: false }]),
  )
}

function req(skillId: string, requiredLevel = 3) {
  return { skillId, requiredLevel }
}

describe('gapClosedByListing', () => {
  it('is 1 when the student has evidence in every required skill', () => {
    const r = gapClosedByListing([req('react'), req('python')], depthMap(['react', 'python']))
    expect(r.share).toBe(1)
  })

  it('is 0 when they have none of them', () => {
    const r = gapClosedByListing([req('react'), req('python')], depthMap([]))
    expect(r.share).toBe(0)
    expect(r.matchedImportance).toBe(0)
  })

  it('weights by importance, not by skill count', () => {
    // Has the essential skill, missing the nice-to-have: 5/6, not 1/2.
    const r = gapClosedByListing([req('react', 5), req('python', 1)], depthMap(['react']))
    expect(r.share).toBeCloseTo(5 / 6)
  })

  it('ranks a listing you mostly fit above one you barely fit', () => {
    const depth = depthMap(['react'])
    const mostly = gapClosedByListing([req('react', 5), req('python', 1)], depth).share
    const barely = gapClosedByListing([req('react', 1), req('python', 5)], depth).share
    expect(mostly).toBeGreaterThan(barely)
  })

  it('treats presence as binary — depth does not raise coverage', () => {
    // Coverage answers "can you act on this today", which is a presence
    // question. Depth already drives ranking separately; letting it leak
    // in here would double-count it.
    const shallow = new Map<string, SkillDepth>([
      ['react', { skillId: 'react', depth: 0.1, bestLevel: 1, artifactCount: 1, hasVerifiedEvidence: false }],
    ])
    const deep = new Map<string, SkillDepth>([
      ['react', { skillId: 'react', depth: 9, bestLevel: 3, artifactCount: 6, hasVerifiedEvidence: true }],
    ])
    expect(gapClosedByListing([req('react')], shallow).share).toBe(
      gapClosedByListing([req('react')], deep).share,
    )
  })

  it('returns 0 rather than dividing by zero on a listing with no requirements', () => {
    expect(gapClosedByListing([], depthMap(['react']))).toEqual({
      matchedImportance: 0,
      totalImportance: 0,
      share: 0,
    })
  })
})
