// Turning a GitHub webhook into rows worth keeping.
//
// This is the ledger the verifier reads. The alternative design — scan the
// repository when a task is submitted — pays for a full repository read per
// task and gets slower as the project grows. Here GitHub tells us as things
// happen, the facts are stored once, and a submission assembles its case
// from rows that already exist. That is the whole reason work_events exists
// and the reason it has to be built before the verifier rather than after.
//
// Two rules shape everything below.
//
// Trim on the way in. A push payload carries every commit in full, plus the
// pusher, the repository, the organisation and a copy of the head commit.
// What a verifier needs is the messages, the paths and the counts. Storing
// the rest means a jsonb column that is mostly GitHub's boilerplate, backed
// up nightly for years.
//
// Attribute by author, not by pusher. On a team the question is never "what
// happened in this repo", it is "what did THIS person do" — and the two
// differ every time somebody merges a branch or pushes on behalf of a pair.
// So a push containing commits by two people becomes two rows, one per
// author, and author_account_id stays true rather than approximately true.

export type WorkEventType =
  | 'push'
  | 'pull_request'
  | 'pull_request_review'
  | 'check_suite'
  | 'issue_comment'
  | 'release'

export interface ExtractedEvent {
  eventType: WorkEventType
  repoFullName: string
  /** GitHub login of whoever the event is really about. */
  authorLogin: string | null
  /** Unique per (repo, type). Built from the delivery id, so a redelivery
   *  collides with the row it already wrote instead of counting twice. */
  externalId: string
  occurredAt: string
  payload: Record<string, unknown>
}

/** GitHub sends far more than this. Anything not listed is not stored. */
const HANDLED = new Set<string>([
  'push', 'pull_request', 'pull_request_review', 'check_suite', 'issue_comment', 'release',
])

export function isWorkEvent(eventName: string): boolean {
  return HANDLED.has(eventName)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function when(value: unknown): string {
  const raw = str(value)
  if (!raw) return new Date().toISOString()
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

/**
 * How much of a commit is worth keeping.
 *
 * File paths matter — the verifier checks whether the changed files overlap
 * what the task said it would touch. The diff itself does not: it is large,
 * it is already in GitHub, and the verifier fetches it on demand for the
 * handful of tasks that reach a judgement.
 */
const MAX_COMMITS_STORED = 40
const MAX_PATHS_PER_COMMIT = 30

interface TrimmedCommit {
  id: string
  message: string
  authorLogin: string | null
  paths: string[]
  fileCount: number
}

function trimCommits(raw: unknown): TrimmedCommit[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_COMMITS_STORED).map((entry) => {
    const commit = obj(entry)
    const author = obj(commit.author)
    const paths = [
      ...(Array.isArray(commit.added) ? commit.added : []),
      ...(Array.isArray(commit.modified) ? commit.modified : []),
      ...(Array.isArray(commit.removed) ? commit.removed : []),
    ].filter((p): p is string => typeof p === 'string')

    return {
      id: (str(commit.id) ?? '').slice(0, 40),
      // Long enough for a real message, short enough that a pasted stack
      // trace in a commit body does not become a database row.
      message: (str(commit.message) ?? '').slice(0, 500),
      authorLogin: str(author.username),
      paths: paths.slice(0, MAX_PATHS_PER_COMMIT),
      fileCount: paths.length,
    }
  })
}

/**
 * One webhook delivery becomes zero, one, or several rows.
 *
 * Several only for a push with commits by more than one person — see the
 * note at the top about why the pusher is the wrong answer.
 */
export function extractWorkEvents(
  eventName: string,
  deliveryId: string,
  body: unknown,
): ExtractedEvent[] {
  if (!isWorkEvent(eventName)) return []

  const payload = obj(body)
  const repo = obj(payload.repository)
  const repoFullName = str(repo.full_name)
  if (!repoFullName) return []

  const sender = str(obj(payload.sender).login)
  const delivery = deliveryId.slice(0, 80) || `${eventName}-${Date.now()}`

  if (eventName === 'push') {
    const commits = trimCommits(payload.commits)
    // A branch delete, or a push of nothing. Nothing happened worth a row.
    if (commits.length === 0) return []

    const head = obj(payload.head_commit)
    const occurredAt = when(head.timestamp)
    const ref = str(payload.ref)

    // Group by whoever actually wrote each commit. The pusher is the
    // fallback only when GitHub gives no author login at all.
    const byAuthor = new Map<string, TrimmedCommit[]>()
    for (const commit of commits) {
      const key = commit.authorLogin ?? sender ?? 'unknown'
      const list = byAuthor.get(key)
      if (list) list.push(commit)
      else byAuthor.set(key, [commit])
    }

    return Array.from(byAuthor.entries()).map(([login, own]) => ({
      eventType: 'push' as const,
      repoFullName,
      authorLogin: login === 'unknown' ? null : login,
      // The delivery id alone would collide between the two rows one push
      // produces, and the unique constraint would silently drop the second.
      externalId: `${delivery}:${login}`,
      occurredAt,
      payload: {
        ref,
        pusher: sender,
        commitCount: own.length,
        commits: own,
        // Paths across the whole push, deduped: the single most useful
        // thing to filter on when assembling a case file for a task.
        paths: Array.from(new Set(own.flatMap((c) => c.paths))).slice(0, 200),
      },
    }))
  }

  if (eventName === 'pull_request') {
    const pr = obj(payload.pull_request)
    return [{
      eventType: 'pull_request',
      repoFullName,
      authorLogin: str(obj(pr.user).login) ?? sender,
      externalId: delivery,
      occurredAt: when(pr.updated_at ?? pr.created_at),
      payload: {
        action: str(payload.action),
        number: typeof pr.number === 'number' ? pr.number : null,
        title: (str(pr.title) ?? '').slice(0, 300),
        body: (str(pr.body) ?? '').slice(0, 2000),
        state: str(pr.state),
        merged: pr.merged === true,
        draft: pr.draft === true,
        additions: typeof pr.additions === 'number' ? pr.additions : null,
        deletions: typeof pr.deletions === 'number' ? pr.deletions : null,
        changedFiles: typeof pr.changed_files === 'number' ? pr.changed_files : null,
        headSha: str(obj(pr.head).sha),
      },
    }]
  }

  if (eventName === 'pull_request_review') {
    const review = obj(payload.review)
    return [{
      eventType: 'pull_request_review',
      repoFullName,
      authorLogin: str(obj(review.user).login) ?? sender,
      externalId: delivery,
      occurredAt: when(review.submitted_at),
      payload: {
        // Reviewing is the clearest signal of technical judgment that shows
        // up in a repository at all, so the verdict is kept rather than
        // just the fact of a review.
        state: str(review.state),
        body: (str(review.body) ?? '').slice(0, 2000),
        pullNumber: typeof obj(payload.pull_request).number === 'number'
          ? obj(payload.pull_request).number
          : null,
      },
    }]
  }

  if (eventName === 'check_suite') {
    const suite = obj(payload.check_suite)
    const conclusion = str(suite.conclusion)
    // In-progress suites say nothing yet, and there is one for every push.
    if (!conclusion) return []
    return [{
      eventType: 'check_suite',
      repoFullName,
      // A CI result belongs to whoever wrote the commit, not to the bot
      // that ran it.
      authorLogin: str(obj(suite.head_commit).author && obj(obj(suite.head_commit).author).name)
        ?? str(obj(payload.sender).login),
      externalId: delivery,
      occurredAt: when(suite.updated_at),
      payload: {
        conclusion,
        status: str(suite.status),
        headSha: str(suite.head_sha),
        headBranch: str(suite.head_branch),
      },
    }]
  }

  if (eventName === 'release') {
    const release = obj(payload.release)
    return [{
      eventType: 'release',
      repoFullName,
      authorLogin: str(obj(release.author).login) ?? sender,
      externalId: delivery,
      occurredAt: when(release.published_at ?? release.created_at),
      payload: {
        action: str(payload.action),
        tag: str(release.tag_name),
        name: (str(release.name) ?? '').slice(0, 200),
        draft: release.draft === true,
      },
    }]
  }

  // issue_comment
  const comment = obj(payload.comment)
  return [{
    eventType: 'issue_comment',
    repoFullName,
    authorLogin: str(obj(comment.user).login) ?? sender,
    externalId: delivery,
    occurredAt: when(comment.created_at),
    payload: {
      action: str(payload.action),
      body: (str(comment.body) ?? '').slice(0, 2000),
      issueNumber: typeof obj(payload.issue).number === 'number' ? obj(payload.issue).number : null,
      // A comment on a pull request arrives as an issue_comment with this
      // key present. Worth distinguishing: one is code review, the other is
      // a conversation on a ticket.
      onPullRequest: !!obj(payload.issue).pull_request,
    },
  }]
}
