// Engagement stage machine + track record, as pure functions.
//
// Kept out of the route handlers so the rules are testable without a
// database, and so the UI and the API can't disagree about what's
// allowed — the client greys out buttons using the same predicate the
// server enforces with.
//
// The stages describe the state of the WORK, distinct from
// listings.status which describes the state of the advertisement. A
// listing can be 'filled' while its engagement is still 'in_progress'.

export type Stage = 'accepted' | 'in_progress' | 'submitted' | 'closed' | 'abandoned'
export type Actor = 'student' | 'poster'

export const TERMINAL_STAGES: Stage[] = ['closed', 'abandoned']

export function isTerminal(stage: Stage): boolean {
  return TERMINAL_STAGES.includes(stage)
}

/**
 * Who may move a given engagement from one stage to another.
 *
 * The asymmetries are deliberate:
 *  - only the STUDENT can mark work submitted (they're the one who did it)
 *  - only the POSTER can close it out (close-out is what mints evidence,
 *    so the party the evidence is about must not be the one who decides
 *    it's earned)
 *  - EITHER can abandon, and abandonment is always available from any
 *    non-terminal stage. An engagement nobody can abandon silently sits
 *    at in_progress forever and is indistinguishable from one genuinely
 *    still in flight, which makes close_out_rate uncomputable.
 */
const TRANSITIONS: { from: Stage; to: Stage; actors: Actor[] }[] = [
  { from: 'accepted', to: 'in_progress', actors: ['student', 'poster'] },
  { from: 'in_progress', to: 'submitted', actors: ['student'] },
  // Poster can send it back for more work rather than being forced to
  // choose between closing something unfinished and abandoning it.
  { from: 'submitted', to: 'in_progress', actors: ['poster'] },
  { from: 'submitted', to: 'closed', actors: ['poster'] },
  { from: 'accepted', to: 'abandoned', actors: ['student', 'poster'] },
  { from: 'in_progress', to: 'abandoned', actors: ['student', 'poster'] },
  { from: 'submitted', to: 'abandoned', actors: ['student', 'poster'] },
]

export function canTransition(from: Stage, to: Stage, actor: Actor): boolean {
  if (isTerminal(from)) return false
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.actors.includes(actor))
}

export function allowedTransitions(from: Stage, actor: Actor): Stage[] {
  if (isTerminal(from)) return []
  return TRANSITIONS.filter((t) => t.from === from && t.actors.includes(actor)).map((t) => t.to)
}

/**
 * Close-out mints evidence that will follow the student around, so it
 * requires both parties to have signed off on what the work actually
 * was. Without this, one side could write the description unilaterally
 * — the poster understating it, or the student overstating it — and the
 * evidence would carry a claim the other party never agreed to.
 */
export function canCloseOut(engagement: {
  stage: Stage
  description: string | null
  description_agreed_by_student_at: string | null
  description_agreed_by_poster_at: string | null
}): { ok: true } | { ok: false; reason: string } {
  if (engagement.stage !== 'submitted') {
    return { ok: false, reason: 'The student has to submit the work before it can be closed out.' }
  }
  if (!engagement.description?.trim()) {
    return { ok: false, reason: 'Agree on a description of the work before closing out.' }
  }
  if (!engagement.description_agreed_by_student_at) {
    return { ok: false, reason: 'The student has not agreed to the description yet.' }
  }
  if (!engagement.description_agreed_by_poster_at) {
    return { ok: false, reason: 'You have not agreed to the description yet.' }
  }
  return { ok: true }
}

export interface TrackRecord {
  closed: number
  abandoned: number
  active: number
  /**
   * closed / (closed + abandoned). Null when nothing has reached a
   * terminal stage — a student with one in-flight engagement has no rate
   * yet, and showing 0% or 100% off a single data point would be worse
   * than showing nothing.
   */
  closeOutRate: number | null
}

export function computeTrackRecord(stages: Stage[]): TrackRecord {
  const closed = stages.filter((s) => s === 'closed').length
  const abandoned = stages.filter((s) => s === 'abandoned').length
  const active = stages.filter((s) => !isTerminal(s)).length
  const terminal = closed + abandoned
  return {
    closed,
    abandoned,
    active,
    closeOutRate: terminal === 0 ? null : closed / terminal,
  }
}

export const STAGE_LABEL: Record<Stage, string> = {
  accepted: 'Accepted',
  in_progress: 'In progress',
  submitted: 'Submitted for review',
  closed: 'Closed out',
  abandoned: 'Abandoned',
}
