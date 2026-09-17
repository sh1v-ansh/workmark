import { describe, it, expect } from 'vitest'
import { extractWorkEvents, isWorkEvent } from '../src/lib/workspace/events'

const REPO = { full_name: 'alice/events' }
const SENDER = { login: 'alice' }

function commit(id: string, author: string | null, files: Partial<{ added: string[]; modified: string[]; removed: string[] }> = {}) {
  return {
    id,
    message: `work on ${id}`,
    author: author ? { username: author } : {},
    added: files.added ?? [],
    modified: files.modified ?? [],
    removed: files.removed ?? [],
  }
}

describe('which events are kept', () => {
  it('keeps the six that say something about the work', () => {
    for (const name of ['push', 'pull_request', 'pull_request_review', 'check_suite', 'issue_comment', 'release']) {
      expect(isWorkEvent(name)).toBe(true)
    }
  })

  it('ignores everything else', () => {
    for (const name of ['star', 'fork', 'watch', 'installation', 'member', 'ping']) {
      expect(isWorkEvent(name)).toBe(false)
      expect(extractWorkEvents(name, 'd1', { repository: REPO })).toEqual([])
    }
  })

  it('drops anything with no repository to attach it to', () => {
    expect(extractWorkEvents('push', 'd1', { sender: SENDER })).toEqual([])
  })
})

describe('push', () => {
  const basePush = {
    repository: REPO,
    sender: SENDER,
    ref: 'refs/heads/main',
    head_commit: { timestamp: '2026-03-01T10:00:00Z' },
  }

  it('records the paths a verifier needs, and not the diff', () => {
    const [event] = extractWorkEvents('push', 'd1', {
      ...basePush,
      commits: [commit('c1', 'alice', { added: ['src/api.ts'], modified: ['src/db.ts'] })],
    })

    expect(event.eventType).toBe('push')
    expect(event.repoFullName).toBe('alice/events')
    expect(event.authorLogin).toBe('alice')
    expect(event.occurredAt).toBe('2026-03-01T10:00:00.000Z')
    expect(event.payload.paths).toEqual(['src/api.ts', 'src/db.ts'])
    expect(event.payload.commitCount).toBe(1)
  })

  // The whole reason this splits rather than storing one row per push: on a
  // team, "what did this person do" and "what happened in the repo" are
  // different questions, and a merge makes them diverge.
  it('splits one push into a row per commit author', () => {
    const events = extractWorkEvents('push', 'd1', {
      ...basePush,
      commits: [
        commit('c1', 'alice', { added: ['a.ts'] }),
        commit('c2', 'bob', { added: ['b.ts'] }),
        commit('c3', 'alice', { added: ['c.ts'] }),
      ],
    })

    expect(events).toHaveLength(2)
    const alice = events.find((e) => e.authorLogin === 'alice')!
    const bob = events.find((e) => e.authorLogin === 'bob')!
    expect(alice.payload.commitCount).toBe(2)
    expect(bob.payload.commitCount).toBe(1)
    expect(alice.payload.paths).toEqual(['a.ts', 'c.ts'])
    expect(bob.payload.paths).toEqual(['b.ts'])
  })

  // The delivery id alone would collide between those two rows and the
  // unique index would silently drop the second one.
  it('gives each author row its own external id', () => {
    const events = extractWorkEvents('push', 'd1', {
      ...basePush,
      commits: [commit('c1', 'alice'), commit('c2', 'bob')],
    })
    expect(new Set(events.map((e) => e.externalId)).size).toBe(2)
    expect(events.every((e) => e.externalId.startsWith('d1:'))).toBe(true)
  })

  it('falls back to the pusher when GitHub gives no author login', () => {
    const [event] = extractWorkEvents('push', 'd1', { ...basePush, commits: [commit('c1', null)] })
    expect(event.authorLogin).toBe('alice')
  })

  // A branch delete arrives as a push with no commits. Nothing happened.
  it('writes nothing for a push with no commits', () => {
    expect(extractWorkEvents('push', 'd1', { ...basePush, commits: [] })).toEqual([])
  })

  it('caps what it stores so one payload cannot become a huge row', () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      commit(`c${i}`, 'alice', { added: Array.from({ length: 60 }, (_, j) => `f${i}-${j}.ts`) }))
    const [event] = extractWorkEvents('push', 'd1', { ...basePush, commits: many })
    expect((event.payload.commits as unknown[]).length).toBe(40)
    expect((event.payload.paths as string[]).length).toBeLessThanOrEqual(200)
  })
})

describe('pull requests, reviews and CI', () => {
  it('keeps the size of a pull request, which is how big the change was', () => {
    const [event] = extractWorkEvents('pull_request', 'd2', {
      repository: REPO,
      sender: SENDER,
      action: 'closed',
      pull_request: {
        number: 7, title: 'Add auth', state: 'closed', merged: true,
        additions: 210, deletions: 14, changed_files: 6,
        updated_at: '2026-03-02T09:00:00Z', user: { login: 'bob' }, head: { sha: 'abc' },
      },
    })
    expect(event.authorLogin).toBe('bob')
    expect(event.payload.merged).toBe(true)
    expect(event.payload.changedFiles).toBe(6)
    expect(event.payload.number).toBe(7)
  })

  it('keeps a review verdict, not just that a review happened', () => {
    const [event] = extractWorkEvents('pull_request_review', 'd3', {
      repository: REPO, sender: SENDER,
      review: { state: 'changes_requested', body: 'This leaks a connection.', submitted_at: '2026-03-02T10:00:00Z', user: { login: 'carol' } },
      pull_request: { number: 7 },
    })
    expect(event.authorLogin).toBe('carol')
    expect(event.payload.state).toBe('changes_requested')
    expect(event.payload.pullNumber).toBe(7)
  })

  it('records a finished check suite', () => {
    const [event] = extractWorkEvents('check_suite', 'd4', {
      repository: REPO, sender: SENDER,
      check_suite: { conclusion: 'success', status: 'completed', head_sha: 'abc', head_branch: 'main', updated_at: '2026-03-02T11:00:00Z' },
    })
    expect(event.payload.conclusion).toBe('success')
  })

  // There is one of these for every push, and it says nothing until it
  // finishes. Storing them would double the table for no information.
  it('ignores a check suite that has not finished', () => {
    expect(extractWorkEvents('check_suite', 'd4', {
      repository: REPO, sender: SENDER,
      check_suite: { status: 'in_progress', conclusion: null },
    })).toEqual([])
  })
})

describe('comments and releases', () => {
  it('tells a code review apart from a ticket comment', () => {
    const onPr = extractWorkEvents('issue_comment', 'd5', {
      repository: REPO, sender: SENDER, action: 'created',
      comment: { body: 'nit: rename this', created_at: '2026-03-03T10:00:00Z', user: { login: 'bob' } },
      issue: { number: 7, pull_request: { url: 'https://api.github.com/...' } },
    })[0]
    const onIssue = extractWorkEvents('issue_comment', 'd6', {
      repository: REPO, sender: SENDER, action: 'created',
      comment: { body: 'can we do this next week', created_at: '2026-03-03T10:00:00Z', user: { login: 'bob' } },
      issue: { number: 9 },
    })[0]

    expect(onPr.payload.onPullRequest).toBe(true)
    expect(onIssue.payload.onPullRequest).toBe(false)
  })

  it('records a release', () => {
    const [event] = extractWorkEvents('release', 'd7', {
      repository: REPO, sender: SENDER, action: 'published',
      release: { tag_name: 'v1.0', name: 'First release', published_at: '2026-03-04T10:00:00Z', author: { login: 'alice' } },
    })
    expect(event.payload.tag).toBe('v1.0')
  })
})

describe('malformed payloads', () => {
  // GitHub is consistent, but a replayed or truncated body must not throw
  // inside a webhook — it would be retried for days.
  it('does not throw on missing or wrong-typed fields', () => {
    expect(() => extractWorkEvents('push', 'd8', { repository: REPO, commits: 'not an array' })).not.toThrow()
    expect(() => extractWorkEvents('pull_request', 'd8', { repository: REPO })).not.toThrow()
    expect(() => extractWorkEvents('issue_comment', 'd8', { repository: REPO })).not.toThrow()
    expect(extractWorkEvents('push', 'd8', { repository: REPO, commits: null })).toEqual([])
  })

  it('falls back to now when a timestamp is missing or nonsense', () => {
    const [event] = extractWorkEvents('pull_request', 'd9', {
      repository: REPO, sender: SENDER,
      pull_request: { number: 1, updated_at: 'not a date' },
    })
    expect(Number.isNaN(new Date(event.occurredAt).getTime())).toBe(false)
  })
})
