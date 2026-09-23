import { describe, it, expect } from 'vitest'
import { parseListingFields } from '@/lib/listings/fields'

const base = { title: 'Build a thing', brief: 'What it is', requirements: [{ skillId: 'react', requiredLevel: 3 }] }

describe('parseListingFields', () => {
  it('accepts a normal listing', () => {
    const r = parseListingFields({ ...base, hours_per_week: 10, work_mode: 'remote' })
    expect(r.ok && r.values.hours_per_week).toBe(10)
  })

  it('refuses a listing with no usable skills', () => {
    expect(parseListingFields({ ...base, requirements: [{ skillId: 'react', requiredLevel: 9 }] }).ok).toBe(false)
  })

  it('refuses numbers that are not whole numbers in range', () => {
    expect(parseListingFields({ ...base, team_size: '3' }).ok).toBe(false)
    expect(parseListingFields({ ...base, declared_difficulty: 11 }).ok).toBe(false)
  })

  it('drops an unknown work mode rather than storing it', () => {
    const r = parseListingFields({ ...base, work_mode: 'on the moon' })
    expect(r.ok && r.values.work_mode).toBe(null)
  })
})
