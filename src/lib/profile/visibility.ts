// What a viewer is allowed to see of a student's engagement history.
//
// Three visibility levels, and the difference between the last two is
// the whole point:
//
//   full     shown normally — project title, brief, who posted it.
//   redacted shown, but as "Confidential engagement". Counts toward
//            skills and track record; the counterparty and the project
//            are suppressed. For work under NDA that still happened.
//   hidden   not shown at all. Still counts toward skills and track
//            record, because the evidence is real and the student
//            shouldn't have to choose between privacy and credit.
//
// The load-bearing rule: TOTAL ENGAGEMENT COUNT IS NEVER DISPLAYED.
// If a profile said "7 engagements" and listed 5, a viewer could infer
// two were hidden, which makes hiding an act that draws attention to
// itself — the opposite of what it's for. Hidden means undetectable, so
// no count, no gaps in numbering, no "2 more" affordance.
//
// Track record aggregates (close-out rate, completed count) DO include
// hidden engagements. That's deliberate and not a contradiction: a rate
// over an undisclosed denominator reveals nothing about which specific
// engagements exist. A viewer can't work backwards from "83%" to a
// particular hidden project.

export type Visibility = 'full' | 'redacted' | 'hidden'

export interface EngagementForDisplay {
  id: string
  visibility: Visibility
  stage: string
  listingTitle: string | null
  posterDisplayName: string | null
  description: string | null
  closedAt: string | null
}

export interface PublicEngagement {
  id: string
  redacted: boolean
  listingTitle: string | null
  posterDisplayName: string | null
  description: string | null
  closedAt: string | null
}

/**
 * Filters and redacts for a PUBLIC viewer (anyone who isn't the student).
 *
 * Only closed engagements appear at all. Work in flight isn't a record
 * of anything yet, and an abandoned one displayed as a line item would
 * turn every abandonment into a public scarlet letter — it belongs in
 * the aggregate close-out rate, which is where the honest signal lives,
 * not in a list.
 */
export function publicEngagements(engagements: EngagementForDisplay[]): PublicEngagement[] {
  return engagements
    .filter((e) => e.stage === 'closed')
    .filter((e) => e.visibility !== 'hidden')
    .map((e) => {
      const redacted = e.visibility === 'redacted'
      return {
        id: e.id,
        redacted,
        listingTitle: redacted ? null : e.listingTitle,
        posterDisplayName: redacted ? null : e.posterDisplayName,
        // The description names the counterparty's project as often as
        // not, so redaction has to drop it too — keeping it would leak
        // exactly what the student chose to suppress.
        description: redacted ? null : e.description,
        closedAt: e.closedAt,
      }
    })
}

/**
 * Whether a public profile should render its work section at all.
 * Distinct from `publicEngagements(...).length > 0` only in intent: an
 * empty section with a heading still tells a viewer something was
 * expected there, so the caller renders nothing rather than an empty
 * state when there's nothing public to show.
 */
export function hasPublicWork(engagements: EngagementForDisplay[]): boolean {
  return publicEngagements(engagements).length > 0
}
