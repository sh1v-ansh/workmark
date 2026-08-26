import { describe, it, expect } from 'vitest'
import { sortQueue, severityFor, countsByKind, type QueueItem } from '../src/lib/admin/queue'
import { hasRole, isVerifiedFaculty, isRole, type Account } from '../src/lib/auth/roles'

const NOW = new Date('2026-06-01T00:00:00Z')

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    kind: 'review_request',
    id: over.id ?? 'a',
    title: 'something',
    detail: null,
    subjectName: null,
    subjectId: null,
    createdAt: '2026-05-01T00:00:00Z',
    dueAt: null,
    severity: 'normal',
    weight: 10,
    ...over,
  }
}

const ids = (items: QueueItem[]) => items.map((i) => i.id)

describe('deadline severity', () => {
  it('calls a passed deadline overdue', () => {
    expect(severityFor('2026-05-20T00:00:00Z', NOW)).toBe('overdue')
  })

  it('warns before the deadline, not only after', () => {
    // A dispute you find out about on day 31 is already a failure. The
    // point is to surface it while there's still time.
    expect(severityFor('2026-06-04T00:00:00Z', NOW)).toBe('due_soon')
  })

  it('leaves a distant deadline alone', () => {
    expect(severityFor('2026-07-15T00:00:00Z', NOW)).toBe('normal')
  })

  it('treats an item with no deadline as normal', () => {
    expect(severityFor(null, NOW)).toBe('normal')
  })
})

describe('queue ordering', () => {
  it('puts overdue items first, whatever they are', () => {
    const sorted = sortQueue([
      item({ id: 'routine', weight: 100 }),
      item({ id: 'late', kind: 'dispute', dueAt: '2026-05-01T00:00:00Z', severity: 'overdue', weight: 1 }),
    ])
    expect(ids(sorted)[0]).toBe('late')
  })

  it('orders overdue items by how late they are', () => {
    const sorted = sortQueue([
      item({ id: 'later', dueAt: '2026-05-20T00:00:00Z', severity: 'overdue' }),
      item({ id: 'latest', dueAt: '2026-04-01T00:00:00Z', severity: 'overdue' }),
    ])
    expect(ids(sorted)).toEqual(['latest', 'later'])
  })

  it('ranks approaching deadlines above everything without one', () => {
    const sorted = sortQueue([
      item({ id: 'no-deadline', weight: 99 }),
      item({ id: 'soon', dueAt: '2026-06-03T00:00:00Z', severity: 'due_soon', weight: 1 }),
    ])
    expect(ids(sorted)[0]).toBe('soon')
  })

  it('uses weight before age among ordinary items', () => {
    // An unmatched name 200 students hit matters more than one seen once,
    // even if the rare one has been sitting there longer.
    const sorted = sortQueue([
      item({ id: 'old-and-rare', weight: 1, createdAt: '2025-01-01T00:00:00Z' }),
      item({ id: 'new-and-common', weight: 40, createdAt: '2026-05-30T00:00:00Z' }),
    ])
    expect(ids(sorted)).toEqual(['new-and-common', 'old-and-rare'])
  })

  it('falls back to oldest first when weights match', () => {
    const sorted = sortQueue([
      item({ id: 'newer', createdAt: '2026-05-30T00:00:00Z' }),
      item({ id: 'older', createdAt: '2026-01-01T00:00:00Z' }),
    ])
    expect(ids(sorted)).toEqual(['older', 'newer'])
  })

  it('does not mutate what it was given', () => {
    const input = [item({ id: 'b', weight: 1 }), item({ id: 'a', weight: 9 })]
    sortQueue(input)
    expect(ids(input)).toEqual(['b', 'a'])
  })
})

describe('counts', () => {
  it('counts every kind, including the empty ones', () => {
    const counts = countsByKind([
      item({ kind: 'dispute' }), item({ kind: 'dispute' }), item({ kind: 'failed_job' }),
    ])
    expect(counts.dispute).toBe(2)
    expect(counts.failed_job).toBe(1)
    expect(counts.review_request).toBe(0)
  })
})

describe('roles', () => {
  const account = (over: Partial<Account> = {}): Account => ({
    id: 'u1', roles: ['student'], status: 'active', facultyVerifiedAt: null, ...over,
  })

  it('recognises a role someone holds', () => {
    expect(hasRole(account({ roles: ['admin'] }), 'admin')).toBe(true)
    expect(hasRole(account({ roles: ['student'] }), 'admin')).toBe(false)
  })

  it('lets one person hold two roles', () => {
    // A PhD student takes courses, TAs, and runs lab projects — genuinely
    // both, and a single value would force a wrong answer.
    const phd = account({ roles: ['student', 'faculty'] })
    expect(hasRole(phd, 'student')).toBe(true)
    expect(hasRole(phd, 'faculty')).toBe(true)
  })

  it('fails closed for a signed-out visitor', () => {
    expect(hasRole(null, 'admin')).toBe(false)
    expect(hasRole(null, 'student')).toBe(false)
  })

  it('separates claiming faculty from being verified', () => {
    // The whole design rests on this: an unverified faculty account works,
    // it just doesn't carry faculty weight. That's what makes lying about
    // it worthless.
    const claimed = account({ roles: ['faculty'] })
    const confirmed = account({ roles: ['faculty'], facultyVerifiedAt: '2026-05-01T00:00:00Z' })
    expect(hasRole(claimed, 'faculty')).toBe(true)
    expect(isVerifiedFaculty(claimed)).toBe(false)
    expect(isVerifiedFaculty(confirmed)).toBe(true)
  })

  it('rejects anything that is not a known role', () => {
    expect(isRole('admin')).toBe(true)
    expect(isRole('superuser')).toBe(false)
    expect(isRole(null)).toBe(false)
  })
})
