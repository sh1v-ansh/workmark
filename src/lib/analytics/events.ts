// The things worth recording that somebody did.
//
// ── Why the list is closed ────────────────────────────────────────────────
// Every name a client may send is in here, and /api/events refuses anything
// else. Two reasons. An open name means the table fills with typos —
// `signup_started`, `signupStarted`, `signup-start` — and a funnel built on
// string equality quietly measures a third of the traffic. And a table a
// browser can write arbitrary rows into is one somebody will eventually
// write arbitrary rows into.
//
// ── What must never go in props ───────────────────────────────────────────
// No repository names, no file paths, no email addresses, no skill names
// from private code, no free text a student typed. This table exists to
// count things, and the moment it holds content it becomes the most
// sensitive table in the database while still being the one nobody thinks
// about. Counts, ids, enums, durations. If a prop needs a sentence to
// justify, it belongs somewhere else.

export const EVENTS = {
  // ── Getting in ──────────────────────────────────────────────────────────
  // The one the current funnel cannot see at all. A signup that is started
  // and abandoned leaves no row in any table, so "how many invited people
  // never finish" is not merely unknown — it is unknowable. With a waitlist
  // it is the number that matters most.
  signup_started: 'Opened the signup form',
  signup_submitted: 'Submitted the signup form',
  signup_failed: 'Signup was refused — props.reason says why',
  signin_succeeded: 'Signed in',

  // ── Onboarding ──────────────────────────────────────────────────────────
  // Per step, because "they stopped at the profile" and "they stopped at the
  // terms" are different problems with different fixes.
  onboarding_started: 'Reached the onboarding form',
  onboarding_role_chosen: 'Picked student or faculty — props.role',
  onboarding_completed: 'Finished the profile',

  // ── The thing that makes the product work ───────────────────────────────
  github_connect_started: 'Pressed connect on GitHub',
  github_connected: 'GitHub came back connected',
  repos_chosen: 'Changed which repositories may be read — props.enabled, props.total',
  scan_started: 'Queued a scan — props.repos',
  scan_finished: 'A scan ended — props.status, props.repos, props.failed, props.seconds',
  first_evidence: 'Their first verified skill landed',

  // ── Doing something with it ─────────────────────────────────────────────
  listing_viewed: 'Opened a posting',
  application_submitted: 'Applied to a posting',
  project_started: 'Started a guided project',
  work_submitted: 'Submitted a task for checking',

  // ── The two that mean it worked ─────────────────────────────────────────
  engagement_closed: 'A project was signed off',
  record_shared: 'Shared or downloaded their record — props.how',
} as const

export type EventName = keyof typeof EVENTS

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, value)
}

/**
 * Props, narrowed to what a count can be built from.
 *
 * Strings are allowed because enums are strings — 'student', 'failed',
 * 'pdf'. Nothing stops somebody putting a repository name in one, which is
 * why the rule is stated at the top of this file and enforced by review
 * rather than by types. A length cap is the part worth machine-checking: it
 * turns "somebody put a stack trace in here" from a privacy incident into a
 * truncated string.
 */
export type EventProps = Record<string, string | number | boolean | null>

export const MAX_PROP_LENGTH = 64
export const MAX_PROPS = 8

/** Drop anything oversized or unexpected rather than refusing the event. */
export function cleanProps(raw: unknown): EventProps {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: EventProps = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_PROPS) break
    if (key.length > 40) continue
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_PROP_LENGTH)
    }
    // Objects and arrays are dropped. A nested shape here is always either a
    // mistake or content, and neither belongs.
  }
  return out
}
