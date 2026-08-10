import { describe, it, expect } from 'vitest'
import { depthFromEvidenceRows, recencyMultiplier, type EvidenceRow } from '@/lib/matching/depth'

const NOW = new Date('2026-06-01T00:00:00Z')

/** Days before NOW, as an ISO string. */
function ago(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function ev(over: Partial<EvidenceRow> = {}): EvidenceRow {
  return {
    skill_id: 'react',
    base: 0.4,
    tier_weight: 0.4,
    difficulty_cleared: 3,
    artifact_id: 'artifact-1',
    verification_method: 'repo_link',
    created_at: ago(30),
    ...over,
  }
}

describe('recencyMultiplier — §6 bands', () => {
  it('is 1.0 under six months', () => {
    expect(recencyMultiplier(ago(30), NOW)).toBe(1.0)
    expect(recencyMultiplier(ago(150), NOW)).toBe(1.0)
  })
  it('is 0.9 from six to twelve months', () => {
    expect(recencyMultiplier(ago(200), NOW)).toBe(0.9)
  })
  it('is 0.8 from one to two years', () => {
    expect(recencyMultiplier(ago(500), NOW)).toBe(0.8)
  })
  it('floors at 0.7 and never reaches zero', () => {
    expect(recencyMultiplier(ago(800), NOW)).toBe(0.7)
    expect(recencyMultiplier(ago(5000), NOW)).toBe(0.7)
  })
})

describe('depthFromEvidenceRows — §6 formula', () => {
  it('returns nothing for a student with no evidence', () => {
    expect(depthFromEvidenceRows([], NOW).size).toBe(0)
  })

  it('scores a single recent row as weight × difficulty', () => {
    const d = depthFromEvidenceRows([ev({ tier_weight: 0.4, difficulty_cleared: 3 })], NOW)
    expect(d.get('react')!.depth).toBeCloseTo(1.2) // 0.4 × 3 × 0.85^0 × 1.0
  })

  it('SUMS evidence rather than taking the max — every piece adds', () => {
    // This is the property the previous max-based implementation broke.
    const one = depthFromEvidenceRows([ev({ artifact_id: 'a' })], NOW).get('react')!.depth
    const two = depthFromEvidenceRows([ev({ artifact_id: 'a' }), ev({ artifact_id: 'b' })], NOW).get('react')!.depth
    expect(two).toBeGreaterThan(one)
    expect(two).toBeCloseTo(1.2 + 1.2 * 0.85)
  })

  it('never lets an additional piece of evidence contribute zero or less', () => {
    let previous = 0
    for (let n = 1; n <= 15; n++) {
      const rows = Array.from({ length: n }, (_, i) => ev({ artifact_id: `a${i}` }))
      const depth = depthFromEvidenceRows(rows, NOW).get('react')!.depth
      expect(depth).toBeGreaterThan(previous)
      previous = depth
    }
  })

  it('applies 0.85^(k-1) by RANK, strongest evidence first', () => {
    // Weak row listed first; it must still take the decayed slot.
    const d = depthFromEvidenceRows(
      [ev({ artifact_id: 'weak', difficulty_cleared: 1 }), ev({ artifact_id: 'strong', difficulty_cleared: 3 })],
      NOW,
    )
    // strong (0.4×3=1.2) at k=0, weak (0.4×1=0.4) at k=1
    expect(d.get('react')!.depth).toBeCloseTo(1.2 + 0.4 * 0.85)
  })

  it('leaves the tenth piece of evidence contributing roughly 23% of face value', () => {
    expect(Math.pow(0.85, 9)).toBeCloseTo(0.232, 3)
  })

  it('makes three hard projects outrank twelve trivial ones', () => {
    const hard = depthFromEvidenceRows(
      Array.from({ length: 3 }, (_, i) => ev({ artifact_id: `h${i}`, difficulty_cleared: 3 })),
      NOW,
    ).get('react')!.depth
    const trivial = depthFromEvidenceRows(
      Array.from({ length: 12 }, (_, i) => ev({ artifact_id: `t${i}`, difficulty_cleared: 1 })),
      NOW,
    ).get('react')!.depth
    expect(hard).toBeGreaterThan(trivial)
  })

  it('discounts older evidence without discarding it', () => {
    const recent = depthFromEvidenceRows([ev({ created_at: ago(30) })], NOW).get('react')!.depth
    const old = depthFromEvidenceRows([ev({ created_at: ago(900) })], NOW).get('react')!.depth
    expect(old).toBeCloseTo(recent * 0.7)
    expect(old).toBeGreaterThan(0)
  })

  it('ranks attested work above self-evidenced work at the same difficulty', () => {
    const solo = depthFromEvidenceRows([ev({ tier_weight: 0.4 })], NOW).get('react')!.depth
    const attested = depthFromEvidenceRows([ev({ tier_weight: 1.0 })], NOW).get('react')!.depth
    expect(attested).toBeCloseTo(solo * 2.5)
  })

  it('falls back to base when tier_weight is null', () => {
    const d = depthFromEvidenceRows([ev({ tier_weight: null, base: 0.5, difficulty_cleared: 2 })], NOW)
    expect(d.get('react')!.depth).toBeCloseTo(1.0)
  })

  it('reports bestLevel and artifactCount for display', () => {
    const d = depthFromEvidenceRows(
      [ev({ artifact_id: 'a', difficulty_cleared: 1 }), ev({ artifact_id: 'b', difficulty_cleared: 3 })],
      NOW,
    )
    expect(d.get('react')!.bestLevel).toBe(3)
    expect(d.get('react')!.artifactCount).toBe(2)
  })

  it('flags verified evidence for the confidence figure', () => {
    expect(depthFromEvidenceRows([ev({ verification_method: 'repo_link' })], NOW).get('react')!.hasVerifiedEvidence).toBe(false)
    for (const method of ['deployment', 'package', 'ci', 'attested', 'human_review']) {
      expect(
        depthFromEvidenceRows([ev({ verification_method: method })], NOW).get('react')!.hasVerifiedEvidence,
        method,
      ).toBe(true)
    }
  })

  it('groups independently per skill', () => {
    const d = depthFromEvidenceRows(
      [ev({ skill_id: 'react', difficulty_cleared: 3 }), ev({ skill_id: 'python', difficulty_cleared: 1 })],
      NOW,
    )
    expect(d.size).toBe(2)
    expect(d.get('react')!.depth).toBeGreaterThan(d.get('python')!.depth)
  })
})
