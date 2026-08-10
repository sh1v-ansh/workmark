import { describe, it, expect } from 'vitest'
import { validateSuggestedSkills } from '@/lib/agents/listing-assist'

// The model's output is untrusted input. These tests pin the boundary:
// a hallucinated skill_id must never reach listing_requirements, where
// it would either violate the foreign key or silently produce a listing
// that matches nobody.

const TAXONOMY = new Map([
  ['react', 'React'],
  ['postgresql', 'PostgreSQL'],
  ['fastapi', 'FastAPI'],
])

function s(skill_id: string, importance = 3, reason = 'because') {
  return { skill_id, importance, reason }
}

describe('validateSuggestedSkills', () => {
  it('accepts skills that exist and resolves their canonical names', () => {
    const r = validateSuggestedSkills([s('react', 5)], TAXONOMY)
    expect(r.requirements).toEqual([
      { skillId: 'react', canonicalName: 'React', requiredLevel: 5, reason: 'because' },
    ])
    expect(r.unrecognizedSkills).toEqual([])
  })

  it('drops invented skill IDs rather than passing them through', () => {
    const r = validateSuggestedSkills([s('react'), s('vibe-coding'), s('postgresql')], TAXONOMY)
    expect(r.requirements.map((x) => x.skillId)).toEqual(['react', 'postgresql'])
    expect(r.unrecognizedSkills).toEqual(['vibe-coding'])
  })

  it('never fuzzy-matches a near-miss onto a real skill', () => {
    // "reactjs" is one edit from a real node. Silently correcting it
    // would mean the listing asks for something the poster never saw.
    const r = validateSuggestedSkills([s('reactjs'), s('Postgres'), s('REACT')], TAXONOMY)
    expect(r.requirements).toEqual([])
    expect(r.unrecognizedSkills).toEqual(['reactjs', 'Postgres', 'REACT'])
  })

  it('is case-sensitive — IDs are exact keys, not labels', () => {
    expect(validateSuggestedSkills([s('React')], TAXONOMY).requirements).toEqual([])
  })

  it('dedupes a skill suggested twice, keeping the first', () => {
    const r = validateSuggestedSkills([s('react', 5, 'first'), s('react', 1, 'second')], TAXONOMY)
    expect(r.requirements).toHaveLength(1)
    expect(r.requirements[0]).toMatchObject({ requiredLevel: 5, reason: 'first' })
  })

  it('clamps importance into the 1-5 range the column allows', () => {
    const r = validateSuggestedSkills(
      [s('react', 99), s('postgresql', -4), s('fastapi', 0)],
      TAXONOMY,
    )
    expect(r.requirements.map((x) => x.requiredLevel)).toEqual([5, 1, 3])
  })

  it('rounds a non-integer importance rather than letting it hit the CHECK constraint', () => {
    expect(validateSuggestedSkills([s('react', 3.7)], TAXONOMY).requirements[0].requiredLevel).toBe(4)
  })

  it('survives structurally malformed items instead of throwing', () => {
    const junk = [
      null,
      {},
      { skill_id: 42 },
      { skill_id: 'react', importance: 'high' },
      { skill_id: '' },
    ] as unknown as Parameters<typeof validateSuggestedSkills>[0]
    const r = validateSuggestedSkills(junk, TAXONOMY)
    // Only the one with a real ID survives, defaulting its bad importance.
    expect(r.requirements).toEqual([
      { skillId: 'react', canonicalName: 'React', requiredLevel: 3, reason: '' },
    ])
    // Empty and non-string IDs aren't reported as "unrecognized skills" —
    // that list is shown to the poster, and blank entries are noise.
    expect(r.unrecognizedSkills).toEqual([])
  })

  it('handles an empty or missing suggestion list', () => {
    expect(validateSuggestedSkills([], TAXONOMY)).toEqual({ requirements: [], unrecognizedSkills: [] })
    expect(
      validateSuggestedSkills(undefined as unknown as Parameters<typeof validateSuggestedSkills>[0], TAXONOMY),
    ).toEqual({ requirements: [], unrecognizedSkills: [] })
  })

  it('returns nothing when the taxonomy is empty — never invents a fallback', () => {
    const r = validateSuggestedSkills([s('react'), s('postgresql')], new Map())
    expect(r.requirements).toEqual([])
    expect(r.unrecognizedSkills).toEqual(['react', 'postgresql'])
  })

  it('preserves the model ordering of the skills it did accept', () => {
    const r = validateSuggestedSkills([s('fastapi'), s('react'), s('postgresql')], TAXONOMY)
    expect(r.requirements.map((x) => x.skillId)).toEqual(['fastapi', 'react', 'postgresql'])
  })
})
