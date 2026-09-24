import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { cleanEligibility } from '@/lib/profile/eligibility'

/**
 * Identity answers (gender, race, disability, veteran status...) may only
 * decide which opportunities a student is shown. They must never reach
 * posters, fit/ranking, profiles or model prompts. The cheapest guarantee is
 * that almost nothing can read the table: this fails the build if a file
 * outside the list below mentions it. Adding a file here is a decision to
 * review, not a formality.
 */
const ALLOWED = new Set([
  'src/lib/profile/eligibility.ts',
  'src/app/api/account/eligibility/route.ts',
  'src/app/api/account/export/route.ts',
  'src/app/me/page.tsx',
  'src/app/account/settings/EligibilitySection.tsx',
])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('student_eligibility isolation', () => {
  it('is only read by the allowed files', () => {
    const offenders = files('src')
      .map((p) => p.replace(/\\/g, '/'))
      .filter((p) => !ALLOWED.has(p) && readFileSync(p, 'utf8').includes('student_eligibility'))
    expect(offenders).toEqual([])
  })
})

describe('cleanEligibility', () => {
  it('keeps known answers and drops unknown ones', () => {
    const out = cleanEligibility({ first_gen: 'yes', military: 'general', us_state: 'ma', use_for_opportunities: true })
    expect(out.first_gen).toBe('yes')
    expect(out.military).toBeNull()
    expect(out.us_state).toBe('MA')
    expect(out.use_for_opportunities).toBe(true)
  })

  it('only keeps self-described gender when that option is chosen', () => {
    expect(cleanEligibility({ gender: 'woman', gender_self: 'x' }).gender_self).toBeNull()
    expect(cleanEligibility({ gender: 'self_describe', gender_self: ' two-spirit ' }).gender_self).toBe('two-spirit')
  })

  it('drops "prefer not to say" when categories are also chosen', () => {
    expect(cleanEligibility({ race_ethnicity: ['asian', 'prefer_not', 'bogus'] }).race_ethnicity).toEqual(['asian'])
    expect(cleanEligibility({ race_ethnicity: ['prefer_not'] }).race_ethnicity).toEqual(['prefer_not'])
  })

  it('is off unless explicitly turned on', () => {
    expect(cleanEligibility({ use_for_opportunities: 'true' }).use_for_opportunities).toBe(false)
  })
})
