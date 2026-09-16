import { describe, it, expect } from 'vitest'
import {
  checkBasis, scanMayRetract, needsAPerson,
  type RecordedTask, type LiveTask,
} from '../src/lib/fcra/task-basis'

function recorded(ids: string[]): RecordedTask[] {
  return ids.map((id) => ({ id, title: `Task ${id}`, settledBy: 'agent', verifiedAt: '2026-08-01T00:00:00Z' }))
}

function live(entries: [string, string][]): Map<string, LiveTask> {
  return new Map(entries.map(([id, status]) => [id, { id, status, latestVerdict: 'verified' }]))
}

describe('checkBasis', () => {
  it('holds when every task it rested on is still verified', () => {
    const f = checkBasis(recorded(['a', 'b', 'c']), live([['a', 'verified'], ['b', 'accepted'], ['c', 'verified']]))
    expect(f.verdict).toBe('holds')
    expect(f.standing).toBe(3)
    expect(f.fallen).toBe(0)
  })

  it('is weakened when some tasks came back', () => {
    const f = checkBasis(recorded(['a', 'b']), live([['a', 'verified'], ['b', 'doing']]))
    expect(f.verdict).toBe('weakened')
    expect(f.standing).toBe(1)
    expect(f.fallen).toBe(1)
  })

  it('is gone when nothing it rested on is finished any more', () => {
    const f = checkBasis(recorded(['a', 'b']), live([['a', 'doing'], ['b', 'abandoned']]))
    expect(f.verdict).toBe('gone')
    expect(f.standing).toBe(0)
  })

  it('counts a deleted task as fallen', () => {
    const f = checkBasis(recorded(['a', 'b']), live([['a', 'verified']]))
    expect(f.verdict).toBe('weakened')
    expect(f.fallen).toBe(1)
  })

  // A project minted before recordEvidenceBasis existed, or one whose audit
  // write failed — it is best-effort by design — has no recorded basis. That
  // is our logging gap, not the student's missing evidence.
  it('is unknown, not gone, when no basis was ever recorded', () => {
    const f = checkBasis([], live([]))
    expect(f.verdict).toBe('unknown')
    expect(f.note).toMatch(/no record of which tasks/i)
  })

  it('treats set-aside work as not finished', () => {
    expect(checkBasis(recorded(['a']), live([['a', 'abandoned']])).verdict).toBe('gone')
  })

  it('says how many stand, in words a student can read', () => {
    expect(checkBasis(recorded(['a']), live([['a', 'verified']])).note)
      .toMatch(/criteria agreed before the work started/i)
  })
})

describe('scanMayRetract', () => {
  // The bug this module exists for. A repository that went private, was
  // renamed, or stopped tripping a detector must not delete evidence that
  // three confirmed tasks still support.
  it('refuses to let a rescan retract while the tasks stand', () => {
    expect(scanMayRetract(checkBasis(recorded(['a']), live([['a', 'verified']])))).toBe(false)
  })

  it('refuses on a partly fallen basis', () => {
    expect(scanMayRetract(checkBasis(recorded(['a', 'b']), live([['a', 'verified'], ['b', 'doing']])))).toBe(false)
  })

  // Protective for the same reason a skipped scan is.
  it('refuses when no basis was recorded', () => {
    expect(scanMayRetract(checkBasis([], live([])))).toBe(false)
  })

  it('allows it only once nothing is left standing', () => {
    expect(scanMayRetract(checkBasis(recorded(['a']), live([['a', 'doing']])))).toBe(true)
  })
})

describe('needsAPerson', () => {
  it('sends a partly fallen basis to a person', () => {
    expect(needsAPerson(checkBasis(recorded(['a', 'b']), live([['a', 'verified'], ['b', 'doing']])))).toBe(true)
  })

  it('sends an unrecorded basis to a person', () => {
    expect(needsAPerson(checkBasis([], live([])))).toBe(true)
  })

  it('does not bother anyone when the basis plainly holds', () => {
    expect(needsAPerson(checkBasis(recorded(['a']), live([['a', 'verified']])))).toBe(false)
  })

  it('does not bother anyone when it plainly does not', () => {
    expect(needsAPerson(checkBasis(recorded(['a']), live([['a', 'doing']])))).toBe(false)
  })
})
