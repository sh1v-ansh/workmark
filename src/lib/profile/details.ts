/**
 * The parts of a student profile the student is allowed to change.
 *
 * This list is the whole security boundary for PATCH /api/profile, so it is
 * a whitelist and not a blacklist. The students table also holds
 * `active_application_count` (kept in step by a trigger), `edu_verified_at`
 * (how the account proved it was a student in the first place) and `handle`
 * (claimed through its own route, because it has a uniqueness check and a
 * publication decision attached). None of those may ever be written from a
 * settings form, so none of them appear here.
 *
 * Kept out of the route file so it can be tested on its own.
 */

export const DEGREE_TYPES = ['BS', 'MS', 'PhD', 'BA', 'Other'] as const

/** Wide enough to cover anyone currently enrolled, narrow enough to catch a
 *  typo. The onboarding form uses the same range. */
export const GRAD_YEAR_MIN = 2024
export const GRAD_YEAR_MAX = 2035

export interface ProfileDetails {
  full_name: string
  university: string | null
  major: string | null
  degree_type: string | null
  graduation_year: number | null
}

export type ValidationResult =
  | { ok: true; values: ProfileDetails }
  | { ok: false; reason: string }

const MAX_TEXT = 120

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.slice(0, MAX_TEXT)
}

/**
 * Turns whatever arrived in the request body into exactly the five columns
 * that may be written, or an explanation of why not.
 *
 * Postel's law, in the direction that is actually safe: a graduation year
 * arriving as the string "2027" is accepted because that is what a number
 * input sends, while a graduation year of 1804 is refused because no reading
 * of it is true. Being liberal about format is not the same as being liberal
 * about meaning.
 */
export function validateProfileDetails(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, reason: 'Invalid request body.' }
  }
  const input = body as Record<string, unknown>

  const fullName = text(input.full_name)
  if (!fullName) return { ok: false, reason: 'Your name cannot be empty.' }

  const degree = text(input.degree_type)
  if (degree !== null && !(DEGREE_TYPES as readonly string[]).includes(degree)) {
    return { ok: false, reason: 'That is not a degree we recognise.' }
  }

  let year: number | null = null
  const rawYear = input.graduation_year
  if (rawYear !== null && rawYear !== undefined && rawYear !== '') {
    const parsed = typeof rawYear === 'number' ? rawYear : Number(rawYear)
    if (!Number.isInteger(parsed)) {
      return { ok: false, reason: 'Graduation year should be a year, like 2027.' }
    }
    if (parsed < GRAD_YEAR_MIN || parsed > GRAD_YEAR_MAX) {
      return { ok: false, reason: `Graduation year should be between ${GRAD_YEAR_MIN} and ${GRAD_YEAR_MAX}.` }
    }
    year = parsed
  }

  return {
    ok: true,
    values: {
      full_name: fullName,
      university: text(input.university),
      major: text(input.major),
      degree_type: degree,
      graduation_year: year,
    },
  }
}
