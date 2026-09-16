import { describe, it, expect } from 'vitest'
import { TIERS, TIER_ORDER, baseFor, type ArtifactTier } from '../src/lib/skills/tiers'

describe('evidence tiers', () => {
  // The ordering IS the claim. Workmark tells businesses that a verified
  // project outranks a repository somebody linked themselves, and that is
  // what must not drift when a magnitude is tuned. The magnitudes are an
  // unvalidated first guess and are free to move; this is not.
  it('never weakens the order the product claims', () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      expect(baseFor(TIER_ORDER[i])).toBeGreaterThanOrEqual(baseFor(TIER_ORDER[i - 1]))
    }
    // And the two ends must be strictly apart, or the claim says nothing.
    expect(baseFor('workspace_verified')).toBeGreaterThan(baseFor('tier_0'))
  })

  it('puts verified project work at the top', () => {
    const top = TIER_ORDER[TIER_ORDER.length - 1]
    expect(top).toBe('workspace_verified')
    for (const tier of TIER_ORDER.slice(0, -1)) {
      expect(baseFor('workspace_verified')).toBeGreaterThan(baseFor(tier))
    }
  })

  // Deliberate, not an oversight: one has somebody who accepted the work, the
  // other has people who worked alongside it, and there is no basis for
  // saying which is stronger.
  it('leaves listing-driven and multi-contributor level with each other', () => {
    expect(baseFor('listing_driven')).toBe(baseFor('tier_0_5'))
  })

  it('keeps every base inside the 0 to 1 range the composite expects', () => {
    for (const tier of Object.keys(TIERS) as ArtifactTier[]) {
      expect(baseFor(tier)).toBeGreaterThan(0)
      expect(baseFor(tier)).toBeLessThanOrEqual(1)
    }
  })

  it('can explain every tier to the student it was applied to', () => {
    for (const tier of Object.keys(TIERS) as ArtifactTier[]) {
      expect(TIERS[tier].explanation.length).toBeGreaterThan(20)
    }
  })

  it('orders every tier that exists', () => {
    expect([...TIER_ORDER].sort()).toEqual(Object.keys(TIERS).sort())
  })
})
