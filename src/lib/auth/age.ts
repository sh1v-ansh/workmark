// How old someone is, and when they stop being held.
//
// Dates of birth are stored as plain `YYYY-MM-DD` and compared as calendar
// dates, never as instants. `new Date('2008-03-04')` is parsed as UTC
// midnight, so a student in California asking on the morning of their
// birthday would be told they are still seventeen. The parsing here is
// deliberately manual for that reason.

/** Below this, an account is held rather than opened. */
export const MINIMUM_AGE = 18

/**
 * Below this we don't hold the account either — we refuse the signup.
 *
 * COPPA territory, and more to the point a thirteen-year-old is not a
 * university student, so a date this low is a typo or a joke rather than
 * someone who will be eligible in a few months.
 */
export const MINIMUM_SIGNUP_AGE = 13

interface Ymd { y: number; m: number; d: number }

/** Parse `YYYY-MM-DD`, or null if it isn't one. */
export function parseDob(value: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  // Round-trip through Date to reject the 31st of February and friends.
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

/** Whole years old on `on`, counting calendar dates, not elapsed time. */
export function ageOn(dob: Ymd, on: Date = new Date()): number {
  let age = on.getFullYear() - dob.y
  const beforeBirthday =
    on.getMonth() + 1 < dob.m || (on.getMonth() + 1 === dob.m && on.getDate() < dob.d)
  if (beforeBirthday) age -= 1
  return age
}

/**
 * The day a held account opens, as `YYYY-MM-DD`.
 *
 * Someone born on 29 February turns eighteen on 1 March in a non-leap year,
 * which is what Date's overflow gives us for free.
 */
export function eligibleOn(dob: Ymd): string {
  const d = new Date(Date.UTC(dob.y + MINIMUM_AGE, dob.m - 1, dob.d))
  return d.toISOString().slice(0, 10)
}

/** Human-readable form of a `YYYY-MM-DD` date, for telling someone to come back. */
export function formatDay(iso: string): string {
  const p = parseDob(iso)
  if (!p) return iso
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}
