// Building the case for a submitted task, and the checks that cost nothing.
//
// This is the half of verification that never calls a model. Everything here
// is arithmetic over rows the webhook already stored, and it does most of the
// work: whether CI passed, whether tests were touched, whether anything was
// committed at all. The model is only asked the one question arithmetic
// cannot answer — does this change actually satisfy what the task said?
//
// It matters that these run first and separately. They produce the checklist
// a student sees, they are reproducible, they can be shown as reasons, and
// they let a large fraction of submissions be settled without spending
// anything. A task with no commits is not a judgement call.
//
// Nothing here reads the diff. Paths, messages, counts and CI conclusions are
// enough to assemble a case; the diff is large, already in GitHub, and only
// worth fetching for the handful of tasks that reach a real judgement.

export type CheckStatus = 'pass' | 'fail' | 'unknown'

export interface Check {
  id: 'commits' | 'tests' | 'ci' | 'review'
  label: string
  status: CheckStatus
  detail: string
}

/** One work_events row, narrowed to what verification actually reads. */
export interface EvidenceEvent {
  event_type: string
  author_account_id: string | null
  author_login: string | null
  occurred_at: string
  payload: Record<string, unknown> | null
}

export interface TaskForVerification {
  id: string
  title: string
  acceptanceCriteria: string | null
  verifiable: boolean
  assigneeId: string | null
  /** First entry into Doing. Falls back to creation for a task never started. */
  startedAt: string | null
  createdAt: string | null
  submittedAt: string | null
}

export interface CaseFile {
  taskId: string
  /** Events inside the window, attributed to whoever is responsible. */
  events: EvidenceEvent[]
  commitCount: number
  paths: string[]
  commitMessages: string[]
  ciConclusion: string | null
  mergedPullRequests: number
  reviewsReceived: number
  checks: Check[]
  /** Set when there is nothing to judge and no model call is worth making. */
  earlyVerdict: 'needs_work' | 'unverifiable' | null
  earlyReason: string | null
}

/**
 * A test file, as best a path can tell you.
 *
 * Deliberately generous across ecosystems, and deliberately not clever. A
 * false positive here says "tests touched" when somebody edited a fixture,
 * which overstates slightly. A false negative would say a student wrote no
 * tests when they did, which is the worse error to make about somebody's
 * record.
 */
const TEST_PATH = /(^|\/)(tests?|__tests__|spec|specs)\/|\.(test|spec)\.[a-z]+$|_test\.[a-z]+$|test_[^/]*\.py$/i

export function isTestPath(path: string): boolean {
  return TEST_PATH.test(path)
}

/**
 * The window a task's evidence has to fall inside.
 *
 * From when work started to when it was submitted. Commits from before the
 * task existed are somebody else's work, or the same person's earlier work,
 * and counting them would let one afternoon verify five tasks.
 */
export function evidenceWindow(task: TaskForVerification, now: Date = new Date()): { from: string; to: string } {
  const from = task.startedAt ?? task.createdAt ?? new Date(0).toISOString()
  const to = task.submittedAt ?? now.toISOString()
  return { from, to }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Which events belong to this task.
 *
 * Two filters. The window, above. And the person: a task assigned to
 * somebody is verified against THEIR work, because on a team the question is
 * what this person did. An unassigned task falls back to everyone's events,
 * which is right for a solo project and is flagged in the case file so the
 * model is not told more certainty than exists.
 */
export function eventsForTask(
  task: TaskForVerification,
  events: EvidenceEvent[],
  now: Date = new Date(),
): EvidenceEvent[] {
  const { from, to } = evidenceWindow(task, now)
  return events.filter((e) => {
    if (e.occurred_at < from || e.occurred_at > to) return false
    if (task.assigneeId && e.author_account_id && e.author_account_id !== task.assigneeId) return false
    return true
  })
}

/**
 * Assemble everything known about one submitted task.
 *
 * Returns an early verdict for the two cases that need no judgement: work
 * that was never going to leave a trace in a repository, and work that left
 * none.
 */
export function buildCaseFile(
  task: TaskForVerification,
  allEvents: EvidenceEvent[],
  now: Date = new Date(),
): CaseFile {
  const events = eventsForTask(task, allEvents, now)

  const pushes = events.filter((e) => e.event_type === 'push')
  const paths = Array.from(new Set(pushes.flatMap((e) =>
    asArray(e.payload?.paths).filter((p): p is string => typeof p === 'string'))))
  const commitMessages = pushes.flatMap((e) =>
    asArray(e.payload?.commits)
      .map((c) => asString((c as Record<string, unknown>)?.message))
      .filter((m): m is string => m !== null))
  const commitCount = pushes.reduce((n, e) => {
    const count = e.payload?.commitCount
    return n + (typeof count === 'number' ? count : 0)
  }, 0)

  // The most recent finished suite in the window. An earlier failure that was
  // later fixed is not a reason to refuse the work — the question is whether
  // it passes now.
  const suites = events
    .filter((e) => e.event_type === 'check_suite')
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const ciConclusion = suites.length > 0 ? asString(suites[suites.length - 1].payload?.conclusion) : null

  const mergedPullRequests = events.filter(
    (e) => e.event_type === 'pull_request' && e.payload?.merged === true,
  ).length
  const reviewsReceived = events.filter((e) => e.event_type === 'pull_request_review').length

  const testPaths = paths.filter(isTestPath)

  const checks: Check[] = [
    {
      id: 'commits',
      label: 'Code was committed',
      status: commitCount > 0 ? 'pass' : 'fail',
      detail: commitCount > 0
        ? `${commitCount} commit${commitCount === 1 ? '' : 's'} touching ${paths.length} file${paths.length === 1 ? '' : 's'}`
        : 'No commits found between starting and submitting this task',
    },
    {
      id: 'tests',
      label: 'Tests were touched',
      // Not every task needs a test, so the absence of one is unknown rather
      // than a failure. Saying "fail" here would push students to write a
      // token test on tasks that do not want one.
      status: testPaths.length > 0 ? 'pass' : 'unknown',
      detail: testPaths.length > 0
        ? `${testPaths.length} test file${testPaths.length === 1 ? '' : 's'} changed`
        : 'No test files changed — not every task needs one',
    },
    {
      id: 'ci',
      label: 'CI passed',
      status: ciConclusion === 'success' ? 'pass' : ciConclusion === null ? 'unknown' : 'fail',
      detail: ciConclusion === null
        ? 'No CI ran on this repository'
        : `Latest run: ${ciConclusion}`,
    },
    {
      id: 'review',
      label: 'Reviewed or merged',
      status: mergedPullRequests > 0 || reviewsReceived > 0 ? 'pass' : 'unknown',
      detail: mergedPullRequests > 0
        ? `${mergedPullRequests} pull request${mergedPullRequests === 1 ? '' : 's'} merged`
        : reviewsReceived > 0
          ? `${reviewsReceived} review${reviewsReceived === 1 ? '' : 's'}`
          : 'Committed directly, no pull request',
    },
  ]

  let earlyVerdict: CaseFile['earlyVerdict'] = null
  let earlyReason: string | null = null

  if (!task.verifiable) {
    // Design, research, talking to somebody. Looking for commits here fails
    // honest work for having no code, which reads as an insult rather than a
    // bug — so it goes to a person instead.
    earlyVerdict = 'unverifiable'
    earlyReason = 'This task was marked as having no code, so a teammate needs to confirm it.'
  } else if (commitCount === 0) {
    // Settled for nothing. A task with no commits is not a judgement call,
    // and asking a model about it would be paying to be told the obvious.
    earlyVerdict = 'needs_work'
    earlyReason = 'No commits were found between starting this task and submitting it.'
  }

  return {
    taskId: task.id,
    events,
    commitCount,
    paths: paths.slice(0, 120),
    commitMessages: commitMessages.slice(0, 40),
    ciConclusion,
    mergedPullRequests,
    reviewsReceived,
    checks,
    earlyVerdict,
    earlyReason,
  }
}

/**
 * How much the checks alone support this being done.
 *
 * A ceiling on the model's confidence rather than a replacement for it. If
 * CI is red, no amount of persuasive commit messages should let a task
 * through at 90% — the checks are the facts and the judgement sits on top.
 */
export function confidenceCeiling(checks: Check[]): number {
  const by = (id: Check['id']) => checks.find((c) => c.id === id)?.status
  if (by('commits') === 'fail') return 0
  if (by('ci') === 'fail') return 0.5
  // Nothing failed, but nothing corroborates either: no CI, no tests, no
  // review. Plausible and unproven, and it should read that way.
  if (by('ci') === 'unknown' && by('tests') === 'unknown' && by('review') === 'unknown') return 0.75
  return 1
}

/** After this many failed automatic attempts, a person decides. */
export const MAX_AUTOMATIC_ATTEMPTS = 2

/**
 * A board somebody cannot get a card out of is worse than one with no
 * checking at all. Two automatic tries, then it goes to a teammate.
 */
export function needsHumanReview(previousAttempts: number): boolean {
  return previousAttempts >= MAX_AUTOMATIC_ATTEMPTS
}
