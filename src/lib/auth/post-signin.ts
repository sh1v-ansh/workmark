// Where somebody lands the moment they are signed in.
//
// This rule existed once, inline in middleware, and now has a second caller:
// the sign-in route can answer it directly because it already holds the
// session and both rows. Two copies of a branch this fiddly would drift
// within a month — faculty went to the wrong place once already — so it
// lives here, as a function with no database and no request in it.

export const STATUS_PAGE = '/account/status'
export const DELETED_PAGE = '/account/deleted'

/**
 * An account that exists but isn't active.
 *
 * A deletion inside its grace period needs the page with the Restore button
 * on it, not the one about suspended and declined accounts.
 */
export function landingForStatus(status: string): string {
  return status === 'deleting' ? DELETED_PAGE : STATUS_PAGE
}

export function destinationAfterSignIn(args: {
  /** Whether an `accounts` row exists. This, not a student profile, is what
   *  "finished onboarding" means — faculty have no student row by design. */
  hasAccount: boolean
  status: string | null
  roles: string[]
  hasStudentProfile: boolean
}): string {
  if (!args.hasAccount) return '/onboarding'
  if (args.status && args.status !== 'active') return landingForStatus(args.status)

  // Faculty land on their own home. The student dashboard asks about skills,
  // a record and a GitHub connection, none of which a professor has — and
  // someone holding both roles is a student first, since that is the side of
  // the product they are being scored on.
  const facultyOnly = args.roles.includes('faculty') && !args.roles.includes('student')
  if (facultyOnly) return '/faculty'

  // An account with the student role but no profile is a signup that stopped
  // halfway. Finish it rather than landing on an empty dashboard.
  return args.hasStudentProfile ? '/student/dashboard' : '/onboarding'
}
