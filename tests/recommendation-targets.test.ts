import { describe, it, expect } from 'vitest'
import { pickRecommendationTargets, REASON_COPY, type TargetInput } from '../src/lib/briefs/targets'

function input(over: Partial<TargetInput> = {}): TargetInput {
  return {
    evidence: [],
    demand: new Map(),
    parentBySkill: new Map(),
    childrenByParent: new Map(),
    ...over,
  }
}

describe('pickRecommendationTargets', () => {
  it('returns nothing for a student with no record and no open listings', () => {
    expect(pickRecommendationTargets(input())).toEqual([])
  })

  // Membership and relative order, not absolute position: which slot a
  // reason lands in is not meaningful — the page shows these newest first —
  // so a test that pins index 0 fails the next time the claiming order
  // changes for a real reason.
  it('picks the most-wanted skill the student cannot show', () => {
    const got = pickRecommendationTargets(input({
      demand: new Map([['docker', 5], ['rust', 1], ['react', 3]]),
      evidence: [{ skillId: 'react', level: 3, projectCount: 2 }],
    }))
    expect(got).toContainEqual({ skillId: 'docker', reason: 'gap' })
    const ids = got.map((t) => t.skillId)
    expect(ids.indexOf('docker')).toBeLessThan(ids.indexOf('rust'))
  })

  // The case that made adjacent claim before gap. Redis is both in demand
  // and next door to a strength; the student should be told the second
  // thing, because it is about them.
  it('prefers the personal explanation when both apply', () => {
    const got = pickRecommendationTargets(input({
      evidence: [{ skillId: 'postgres', level: 3, projectCount: 1 }],
      parentBySkill: new Map([['postgres', 'databases']]),
      childrenByParent: new Map([['databases', ['postgres', 'redis']]]),
      demand: new Map([['redis', 7]]),
    }))
    expect(got).toContainEqual({ skillId: 'redis', reason: 'adjacent' })
    expect(got).not.toContainEqual({ skillId: 'redis', reason: 'gap' })
  })

  it('never suggests a skill the student already has as a gap', () => {
    const got = pickRecommendationTargets(input({
      demand: new Map([['react', 9]]),
      evidence: [{ skillId: 'react', level: 3, projectCount: 2 }],
    }))
    expect(got.some((t) => t.skillId === 'react' && t.reason === 'gap')).toBe(false)
  })

  // A level 3 resting on one repository is the most fragile claim on a
  // record. A level 3 with five behind it does not need our help.
  it('deepens the strength with the thinnest evidence behind it', () => {
    const got = pickRecommendationTargets(input({
      evidence: [
        { skillId: 'react', level: 3, projectCount: 5 },
        { skillId: 'postgres', level: 3, projectCount: 1 },
        { skillId: 'python', level: 2, projectCount: 1 },
      ],
    }))
    expect(got).toContainEqual({ skillId: 'postgres', reason: 'deepen' })
  })

  it('does not try to deepen a skill nobody is strong in', () => {
    const got = pickRecommendationTargets(input({
      evidence: [{ skillId: 'python', level: 1, projectCount: 1 }],
    }))
    expect(got.some((t) => t.reason === 'deepen')).toBe(false)
  })

  it('suggests a neighbour of a strength that the student has not touched', () => {
    const got = pickRecommendationTargets(input({
      evidence: [{ skillId: 'postgres', level: 3, projectCount: 1 }],
      parentBySkill: new Map([['postgres', 'databases']]),
      childrenByParent: new Map([['databases', ['postgres', 'redis', 'mongodb']]]),
      demand: new Map([['redis', 2], ['mongodb', 0]]),
    }))
    expect(got).toContainEqual({ skillId: 'redis', reason: 'adjacent' })
  })

  it('does not offer a neighbour they already have', () => {
    const got = pickRecommendationTargets(input({
      evidence: [
        { skillId: 'postgres', level: 3, projectCount: 1 },
        { skillId: 'redis', level: 2, projectCount: 1 },
      ],
      parentBySkill: new Map([['postgres', 'databases']]),
      childrenByParent: new Map([['databases', ['postgres', 'redis']]]),
    }))
    expect(got.some((t) => t.skillId === 'redis')).toBe(false)
  })

  // Three recommendations that all say the same thing is one recommendation
  // printed three times.
  it('never names the same skill twice', () => {
    const got = pickRecommendationTargets(input({
      demand: new Map([['redis', 9]]),
      evidence: [{ skillId: 'postgres', level: 3, projectCount: 1 }],
      parentBySkill: new Map([['postgres', 'databases']]),
      childrenByParent: new Map([['databases', ['postgres', 'redis']]]),
    }))
    expect(new Set(got.map((t) => t.skillId)).size).toBe(got.length)
  })

  it('leaves alone anything they already have an open idea for', () => {
    const got = pickRecommendationTargets(input({
      demand: new Map([['docker', 5], ['rust', 4]]),
      exclude: new Set(['docker']),
    }))
    expect(got.some((t) => t.skillId === 'docker')).toBe(false)
    expect(got[0].skillId).toBe('rust')
  })

  it('honours the limit', () => {
    const got = pickRecommendationTargets(input({
      demand: new Map([['a', 5], ['b', 4], ['c', 3], ['d', 2]]),
    }), 2)
    expect(got).toHaveLength(2)
  })

  it('fills the remaining slots with gaps when there is nothing else to say', () => {
    const got = pickRecommendationTargets(input({
      demand: new Map([['a', 5], ['b', 4], ['c', 3]]),
      evidence: [{ skillId: 'z', level: 1, projectCount: 1 }],
    }), 3)
    expect(got.map((t) => t.skillId)).toEqual(['a', 'b', 'c'])
    expect(got.every((t) => t.reason === 'gap')).toBe(true)
  })

  // A recommendation that reshuffles every night reads as noise, and a
  // student who saw Docker yesterday and Rust today learns to ignore both.
  it('gives the same answer for the same input', () => {
    const build = () => input({
      demand: new Map([['docker', 3], ['rust', 3], ['go', 3]]),
      evidence: [{ skillId: 'react', level: 3, projectCount: 2 }],
    })
    expect(pickRecommendationTargets(build())).toEqual(pickRecommendationTargets(build()))
  })
})

describe('REASON_COPY', () => {
  it('can explain every reason it might be given', () => {
    for (const reason of ['gap', 'deepen', 'adjacent'] as const) {
      const copy = REASON_COPY[reason]
      expect(copy.label.length).toBeGreaterThan(0)
      expect(copy.explain('Docker')).toContain('Docker')
    }
  })
})
