// When a person, rather than the checker, decides whether work is done.
//
// The verifier settles most submissions on its own, and two kinds of work it
// cannot: a task marked as having no code — design, research, talking to
// somebody — and a task that has already come back needing work twice. Both
// land as `unverifiable`, which means "waiting on a person", not "failed".
//
// Without this path those cards sit in Submitted forever, and the attempt cap
// that makes the automatic checker safe becomes a trap. A board somebody
// cannot get a card out of is worse than a board with no checking on it.
//
// Pure, like membership.ts, for the same reason: the route needs to refuse
// with a sentence and the board needs to hide a button before anyone reaches
// for it, and both have to answer identically.

import { activeMembers, type MemberRow } from './membership'

/**
 * What a person can say about somebody else's work.
 *
 * `not_checked` is not padding. A reviewer who cannot tell — no environment
 * to run it in, no context for the domain — needs somewhere honest to put
 * that. Without it the only ways out of the dialog are a yes or a no they do
 * not mean, and the first one is easier.
 */
export const HUMAN_VERDICTS = ['works', 'partly_works', 'does_not_work', 'not_checked'] as const
export type HumanVerdict = (typeof HUMAN_VERDICTS)[number]

export const HUMAN_VERDICT_LABEL: Record<HumanVerdict, string> = {
  works: 'Works as expected',
  partly_works: 'Partly works',
  does_not_work: "Doesn't work",
  not_checked: "I can't tell",
}

export const HUMAN_VERDICT_HINT: Record<HumanVerdict, string> = {
  works: 'You tried it, or read it, and it does what the task said it would.',
  partly_works: 'Some of it is there. It goes back for the rest.',
  does_not_work: 'It does not do what the task said. It goes back.',
  not_checked: 'You looked and cannot say. Nothing moves, and somebody else can pick it up.',
}

/** The submission state a task must be in before anyone is asked about it. */
export const REVIEWABLE_VERDICT = 'unverifiable'

export interface ReviewableTask {
  id: string
  status: string
  assigneeId: string | null
  /** The verdict on the most recent submission, or null if never submitted. */
  latestVerdict: string | null
  /** Whether a person has already answered on that submission. */
  humanVerdict: string | null
}

export type Refusal = string | null

/**
 * May this person decide this task?
 *
 * The rule that matters is the second one. Whoever did the work never
 * confirms it — not as a courtesy, but because verified evidence somebody can
 * write about themselves is evidence worth nothing, and this is the one path
 * in the product where a human answer becomes a Verified card.
 *
 * Everything else follows from the state machine: a task nobody has submitted
 * has nothing to confirm, and a task the checker settled does not need a
 * second opinion.
 */
export function canReview(
  members: MemberRow[],
  actorId: string,
  task: ReviewableTask,
): Refusal {
  const onTeam = activeMembers(members).some((m) => m.account_id === actorId)
  if (!onTeam) return 'You are not on this project.'

  if (task.assigneeId === actorId) {
    return 'Somebody else has to confirm this one — you did the work.'
  }

  if (task.status !== 'submitted') {
    return 'This task is not waiting to be checked.'
  }
  if (task.latestVerdict !== REVIEWABLE_VERDICT) {
    return task.latestVerdict === null
      ? 'This has not been through the checker yet. Run a check first.'
      : 'The checker already answered this one.'
  }
  if (task.humanVerdict !== null) {
    return 'Somebody has already answered this.'
  }

  return null
}

/**
 * Is there anybody on this team who could answer?
 *
 * A solo project has nobody but the person who did the work, and on a team
 * every reviewable task can still end up assigned to the only other member
 * who is away. Either way the answer is the same: it goes to Workmark staff
 * through the admin queue rather than sitting on the board unanswerable.
 */
export function hasEligibleReviewer(members: MemberRow[], assigneeId: string | null): boolean {
  return activeMembers(members).some((m) => m.account_id !== assigneeId)
}

export interface ReviewOutcome {
  /** What the submission's verdict becomes. */
  submissionVerdict: 'human_verified' | 'needs_work' | 'unverifiable'
  /** Where the card goes, or null to leave it where it is. */
  taskStatus: 'verified' | 'doing' | null
  /**
   * Whether this closes the question.
   *
   * False only for `not_checked`, and the distinction is load-bearing.
   * `human_verdict` is what canReview reads to decide a task has been
   * answered, so writing it for "I can't tell" would mean the first person to
   * shrug locks everybody else out — and the card, whose entire problem was
   * that it needed a person, would sit there looking answered forever.
   *
   * So "I can't tell" is recorded in the notes and leaves the question open.
   * It stays in the admin queue, which is exactly right: it is still waiting.
   */
  recordsAnswer: boolean
  /** Said back to the reviewer, so the dialog closes on a fact. */
  message: string
}

/**
 * What one answer does.
 *
 * Partly-working work goes back to Doing rather than staying in Submitted,
 * for the same reason the automatic checker sends needs-work back: a card in
 * Submitted reads as "waiting on Workmark", and this one is waiting on the
 * student. Leaving it would quietly hide outstanding work.
 */
export function outcomeFor(verdict: HumanVerdict): ReviewOutcome {
  switch (verdict) {
    case 'works':
      return {
        submissionVerdict: 'human_verified',
        taskStatus: 'verified',
        recordsAnswer: true,
        message: 'Confirmed. It moves to Verified and counts toward their record.',
      }
    case 'partly_works':
      return {
        submissionVerdict: 'needs_work',
        taskStatus: 'doing',
        recordsAnswer: true,
        message: 'Sent back to Doing with your note.',
      }
    case 'does_not_work':
      return {
        submissionVerdict: 'needs_work',
        taskStatus: 'doing',
        recordsAnswer: true,
        message: 'Sent back to Doing with your note.',
      }
    case 'not_checked':
      return {
        submissionVerdict: 'unverifiable',
        taskStatus: null,
        recordsAnswer: false,
        message: 'Noted. It stays open so somebody else can look.',
      }
  }
}

/**
 * The tasks this person should be shown at the top of the board.
 *
 * Surfaced rather than left to be found. A reviewable task is work somebody
 * else is blocked on, and a queue nobody can see is a queue nobody clears.
 */
export function awaitingReview(
  members: MemberRow[],
  actorId: string,
  tasks: ReviewableTask[],
): ReviewableTask[] {
  return tasks.filter((t) => canReview(members, actorId, t) === null)
}
