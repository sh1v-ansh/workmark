import { describe, it, expect } from 'vitest'
import { depthFromEvidenceRows } from '@/lib/matching/depth'

// Shorthand for building evidence rows — every test cares about two or
// three fields, so spelling out all six every time obscures the case.
function ev(over: Partial<{ skill_id: string; base: number; tier_weight: number | null; difficulty_cleared: number; artifact_id: string | null }> = {}) {
  return {
    skill_id: 'react',
    base: 0.4,
    tier_weight: 0.4,
    difficulty_cleared: 3,
    artifact_id: 'artifact-1',
    ...over,
  }
}

describe('depthFromEvidenceRows', () => {
  it('returns nothing for a student with no evidence', () => {
    expect(depthFromEvidenceRows([]).size).toBe(0)
  })

  it('scores a single row as level × weight', () => {
    const d = depthFromEvidenceRows([ev({ difficulty_cleared: 3, tier_weight: 0.4 })])
    expect(d.get('react')!.depth).toBeCloseTo(1.2)
    expect(d.get('react')!.bestLevel).toBe(3)
    expect(d.get('react')!.artifactCount).toBe(1)
  })

  it('takes the BEST level, not the mean — one hard project beats several trivial ones', () => {
    const d = depthFromEvidenceRows([
      ev({ artifact_id: 'a', difficulty_cleared: 1 }),
      ev({ artifact_id: 'b', difficulty_cleared: 3 }),
    ])
    expect(d.get('react')!.bestLevel).toBe(3)
  })

  it('takes the best tier weight, so attested work outranks self-evidenced work in the same skill', () => {
    const d = depthFromEvidenceRows([
      ev({ artifact_id: 'a', tier_weight: 0.4, difficulty_cleared: 3 }),
      ev({ artifact_id: 'b', tier_weight: 1.0, difficulty_cleared: 3 }),
    ])
    // 3 × 1.0 × (1 + 0.1 for the second artifact)
    expect(d.get('react')!.depth).toBeCloseTo(3.3)
  })

  it('adds +0.1 corroboration per additional distinct artifact', () => {
    const one = depthFromEvidenceRows([ev({ artifact_id: 'a' })]).get('react')!.depth
    const two = depthFromEvidenceRows([ev({ artifact_id: 'a' }), ev({ artifact_id: 'b' })]).get('react')!.depth
    expect(two / one).toBeCloseTo(1.1)
  })

  it('caps corroboration at +0.3 so volume can never outrank depth', () => {
    const many = depthFromEvidenceRows(
      Array.from({ length: 20 }, (_, i) => ev({ artifact_id: `a${i}` })),
    ).get('react')!.depth
    // 3 × 0.4 × 1.3 — not 3 × 0.4 × (1 + 1.9)
    expect(many).toBeCloseTo(1.56)
  })

  it('keeps a deep single project ahead of many shallow ones — the cap doing its job', () => {
    const deep = depthFromEvidenceRows([ev({ difficulty_cleared: 3, artifact_id: 'deep' })]).get('react')!.depth
    const shallow = depthFromEvidenceRows(
      Array.from({ length: 20 }, (_, i) => ev({ difficulty_cleared: 1, artifact_id: `s${i}` })),
    ).get('react')!.depth
    expect(deep).toBeGreaterThan(shallow)
  })

  it('counts artifacts distinctly — rescanning one repo must not inflate depth', () => {
    const d = depthFromEvidenceRows([
      ev({ artifact_id: 'same' }),
      ev({ artifact_id: 'same' }),
      ev({ artifact_id: 'same' }),
    ])
    expect(d.get('react')!.artifactCount).toBe(1)
    expect(d.get('react')!.depth).toBeCloseTo(1.2) // no corroboration bonus
  })

  it('falls back to base when tier_weight is null', () => {
    const d = depthFromEvidenceRows([ev({ tier_weight: null, base: 0.5, difficulty_cleared: 2 })])
    expect(d.get('react')!.depth).toBeCloseTo(1.0)
  })

  it('groups independently per skill', () => {
    const d = depthFromEvidenceRows([
      ev({ skill_id: 'react', difficulty_cleared: 3 }),
      ev({ skill_id: 'python', difficulty_cleared: 1 }),
    ])
    expect(d.size).toBe(2)
    expect(d.get('react')!.bestLevel).toBe(3)
    expect(d.get('python')!.bestLevel).toBe(1)
  })
})
