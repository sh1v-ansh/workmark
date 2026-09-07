import { describe, it, expect } from 'vitest'
import {
  isTestPath, evidenceWindow, eventsForTask, buildCaseFile,
  confidenceCeiling, needsHumanReview, MAX_AUTOMATIC_ATTEMPTS,
  type EvidenceEvent, type TaskForVerification,
} from '../src/lib/workspace/verify'

const NOW = new Date('2026-03-10T12:00:00Z')

function task(over: Partial<TaskForVerification> = {}): TaskForVerification {
  return {
    id: 't1',
    title: 'Build the events API',
    acceptanceCriteria: 'GET and POST work, covered by tests.',
    verifiable: true,
    assigneeId: 'alice',
    startedAt: '2026-03-08T09:00:00Z',
    createdAt: '2026-03-07T09:00:00Z',
    submittedAt: '2026-03-09T17:00:00Z',
    ...over,
  }
}

function push(at: string, author: string | null, paths: string[], commits = 1): EvidenceEvent {
  return {
    event_type: 'push',
    author_account_id: author,
    author_login: author,
    occurred_at: at,
    payload: {
      paths,
      commitCount: commits,
      commits: Array.from({ length: commits }, (_, i) => ({ message: `commit ${i}`, paths })),
    },
  }
}

function ci(at: string, conclusion: string): EvidenceEvent {
  return {
    event_type: 'check_suite',
    author_account_id: 'alice',
    author_login: 'alice',
    occurred_at: at,
    payload: { conclusion },
  }
}

describe('test file detection', () => {
  it.each([
    'tests/api.test.ts', 'src/__tests__/api.ts', 'spec/models_spec.rb',
    'api.test.tsx', 'handler_test.go', 'tests/test_views.py', 'src/foo.spec.js',
  ])('recognises %s', (path) => expect(isTestPath(path)).toBe(true))

  it.each(['src/api.ts', 'README.md', 'src/latest/index.ts', 'contest/main.c'])(
    'does not mistake %s for a test', (path) => expect(isTestPath(path)).toBe(false))
})

describe('the evidence window', () => {
  it('runs from starting the task to submitting it', () => {
    expect(evidenceWindow(task(), NOW)).toEqual({
      from: '2026-03-08T09:00:00Z', to: '2026-03-09T17:00:00Z',
    })
  })

  it('falls back to creation for a task that was never moved to Doing', () => {
    expect(evidenceWindow(task({ startedAt: null }), NOW).from).toBe('2026-03-07T09:00:00Z')
  })

  it('runs to now for a task still open', () => {
    expect(evidenceWindow(task({ submittedAt: null }), NOW).to).toBe(NOW.toISOString())
  })
})

describe('which events count', () => {
  // Counting commits from before the task existed would let one afternoon
  // verify five tasks.
  it('ignores work from before the task started and after it was submitted', () => {
    const events = [
      push('2026-03-07T10:00:00Z', 'alice', ['early.ts']),
      push('2026-03-08T10:00:00Z', 'alice', ['during.ts']),
      push('2026-03-10T10:00:00Z', 'alice', ['after.ts']),
    ]
    const kept = eventsForTask(task(), events, NOW)
    expect(kept).toHaveLength(1)
    expect((kept[0].payload!.paths as string[])[0]).toBe('during.ts')
  })

  // On a team the question is what THIS person did.
  it('only counts the assignee’s work when a task is assigned', () => {
    const events = [
      push('2026-03-08T10:00:00Z', 'alice', ['a.ts']),
      push('2026-03-08T11:00:00Z', 'bob', ['b.ts']),
    ]
    expect(eventsForTask(task(), events, NOW)).toHaveLength(1)
  })

  it('counts everyone’s work on an unassigned task', () => {
    const events = [
      push('2026-03-08T10:00:00Z', 'alice', ['a.ts']),
      push('2026-03-08T11:00:00Z', 'bob', ['b.ts']),
    ]
    expect(eventsForTask(task({ assigneeId: null }), events, NOW)).toHaveLength(2)
  })

  // A commit by somebody who never consented has no account id. It is still
  // part of the repository's history.
  it('keeps unattributed events rather than dropping them', () => {
    const events = [push('2026-03-08T10:00:00Z', null, ['x.ts'])]
    expect(eventsForTask(task(), events, NOW)).toHaveLength(1)
  })
})

describe('the free checks', () => {
  const events = [
    push('2026-03-08T10:00:00Z', 'alice', ['src/api.ts', 'tests/api.test.ts'], 3),
    ci('2026-03-08T11:00:00Z', 'success'),
  ]

  it('reports commits, tests and CI from the evidence', () => {
    const file = buildCaseFile(task(), events, NOW)
    expect(file.commitCount).toBe(3)
    expect(file.ciConclusion).toBe('success')
    const status = (id: string) => file.checks.find((c) => c.id === id)!.status
    expect(status('commits')).toBe('pass')
    expect(status('tests')).toBe('pass')
    expect(status('ci')).toBe('pass')
  })

  // An earlier failure that was later fixed is not a reason to refuse work.
  it('takes the most recent CI result, not the worst', () => {
    const file = buildCaseFile(task(), [
      push('2026-03-08T09:30:00Z', 'alice', ['a.ts']),
      ci('2026-03-08T10:00:00Z', 'failure'),
      ci('2026-03-08T11:00:00Z', 'success'),
    ], NOW)
    expect(file.ciConclusion).toBe('success')
  })

  // Saying "fail" would push students to write a token test on tasks that do
  // not want one.
  it('treats missing tests as unknown, not as a failure', () => {
    const file = buildCaseFile(task(), [push('2026-03-08T10:00:00Z', 'alice', ['src/api.ts'])], NOW)
    expect(file.checks.find((c) => c.id === 'tests')!.status).toBe('unknown')
  })

  it('treats a repository with no CI as unknown', () => {
    const file = buildCaseFile(task(), [push('2026-03-08T10:00:00Z', 'alice', ['a.ts'])], NOW)
    expect(file.checks.find((c) => c.id === 'ci')!.status).toBe('unknown')
  })
})

describe('what never reaches the model', () => {
  // Paying to be told the obvious.
  it('settles a task with no commits for nothing', () => {
    const file = buildCaseFile(task(), [], NOW)
    expect(file.earlyVerdict).toBe('needs_work')
    expect(file.earlyReason).toContain('No commits')
  })

  // Looking for commits on design or research work fails honest work for
  // having no code.
  it('sends work that was never going to have code to a person', () => {
    const file = buildCaseFile(task({ verifiable: false }), [], NOW)
    expect(file.earlyVerdict).toBe('unverifiable')
  })

  it('lets a task with real evidence through to be judged', () => {
    const file = buildCaseFile(task(), [push('2026-03-08T10:00:00Z', 'alice', ['a.ts'])], NOW)
    expect(file.earlyVerdict).toBeNull()
  })
})

describe('the confidence ceiling', () => {
  const checks = (over: Record<string, string>) =>
    (['commits', 'tests', 'ci', 'review'] as const).map((id) => ({
      id, label: id, status: (over[id] ?? 'pass') as 'pass' | 'fail' | 'unknown', detail: '',
    }))

  it('allows full confidence when everything corroborates', () => {
    expect(confidenceCeiling(checks({}))).toBe(1)
  })

  // A persuasive commit message must not talk a task past red CI.
  it('caps hard when CI failed', () => {
    expect(confidenceCeiling(checks({ ci: 'fail' }))).toBe(0.5)
  })

  it('is zero with no commits, whatever else is true', () => {
    expect(confidenceCeiling(checks({ commits: 'fail' }))).toBe(0)
  })

  // Plausible and unproven should read that way.
  it('caps when nothing corroborates either way', () => {
    expect(confidenceCeiling(checks({ ci: 'unknown', tests: 'unknown', review: 'unknown' }))).toBe(0.75)
  })
})

describe('the attempt cap', () => {
  // A board somebody cannot get a card out of is worse than one with no
  // checking at all.
  it('hands over to a person after two failed automatic tries', () => {
    expect(MAX_AUTOMATIC_ATTEMPTS).toBe(2)
    expect(needsHumanReview(0)).toBe(false)
    expect(needsHumanReview(1)).toBe(false)
    expect(needsHumanReview(2)).toBe(true)
    expect(needsHumanReview(5)).toBe(true)
  })
})
