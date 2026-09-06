import { describe, it, expect } from 'vitest'
import { validateProfileDetails, GRAD_YEAR_MIN, GRAD_YEAR_MAX } from '../src/lib/profile/details'

const valid = {
  full_name: 'Ada Lovelace',
  university: 'University of Massachusetts Amherst',
  major: 'Computer Science',
  degree_type: 'BS',
  graduation_year: 2027,
}

function values(body: unknown) {
  const r = validateProfileDetails(body)
  if (!r.ok) throw new Error(`expected ok, got: ${r.reason}`)
  return r.values
}

function reason(body: unknown) {
  const r = validateProfileDetails(body)
  if (r.ok) throw new Error('expected a rejection')
  return r.reason
}

describe('validateProfileDetails', () => {
  it('accepts a filled-in profile', () => {
    expect(values(valid)).toEqual(valid)
  })

  // The whole point of the function. The students table also holds the
  // application counter, the .edu verification date and the public handle;
  // a settings form must not be able to write any of them, so anything not
  // named is dropped rather than passed through.
  it('drops every field it was not asked to write', () => {
    const out = values({
      ...valid,
      handle: 'stolen-handle',
      active_application_count: 999,
      edu_verified_at: '2020-01-01',
      gpa: 4.0,
      id: 'someone-else',
    })
    expect(Object.keys(out).sort()).toEqual([
      'degree_type', 'full_name', 'graduation_year', 'major', 'university',
    ])
  })

  it('needs a name', () => {
    expect(reason({ ...valid, full_name: '   ' })).toMatch(/name cannot be empty/i)
    expect(reason({ ...valid, full_name: undefined })).toMatch(/name cannot be empty/i)
    expect(reason(null)).toMatch(/invalid request body/i)
  })

  it('treats a blank optional field as "not saying" rather than an empty string', () => {
    const out = values({ full_name: 'Ada', university: '', major: '   ', degree_type: '' })
    expect(out.university).toBeNull()
    expect(out.major).toBeNull()
    expect(out.degree_type).toBeNull()
    expect(out.graduation_year).toBeNull()
  })

  // A number input posts its value as a string. Refusing that would be
  // strict about format rather than about meaning.
  it('accepts a year that arrived as a string', () => {
    expect(values({ ...valid, graduation_year: '2029' }).graduation_year).toBe(2029)
  })

  it('refuses a year that cannot be true', () => {
    expect(reason({ ...valid, graduation_year: 1804 })).toMatch(/between/i)
    expect(reason({ ...valid, graduation_year: GRAD_YEAR_MIN - 1 })).toMatch(/between/i)
    expect(reason({ ...valid, graduation_year: GRAD_YEAR_MAX + 1 })).toMatch(/between/i)
    expect(reason({ ...valid, graduation_year: '2027ish' })).toMatch(/should be a year/i)
    expect(reason({ ...valid, graduation_year: 2027.5 })).toMatch(/should be a year/i)
  })

  it('accepts both ends of the year range', () => {
    expect(values({ ...valid, graduation_year: GRAD_YEAR_MIN }).graduation_year).toBe(GRAD_YEAR_MIN)
    expect(values({ ...valid, graduation_year: GRAD_YEAR_MAX }).graduation_year).toBe(GRAD_YEAR_MAX)
  })

  it('refuses a degree it does not recognise', () => {
    expect(reason({ ...valid, degree_type: 'Doctorate of Vibes' })).toMatch(/degree/i)
  })

  it('trims a name that is mostly whitespace and caps a very long one', () => {
    expect(values({ ...valid, full_name: '  Ada  ' }).full_name).toBe('Ada')
    expect(values({ ...valid, full_name: 'x'.repeat(500) }).full_name).toHaveLength(120)
  })
})
