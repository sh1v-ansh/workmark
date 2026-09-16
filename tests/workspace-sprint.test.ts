import { describe, it, expect } from 'vitest'
import {
  currentSprint, isOverdue, daysRemaining, progressOf, canClose,
  nextDates, nextName, retroBrief, kickoffBrief,
  SPRINT_DAYS, OVERDUE_GRACE_DAYS,
  type Sprint, type SprintTask,
} from '../src/lib/workspace/sprint'

const NOW = new Date('2026-09-16T09:00:00Z')
const DAY = 86_400_000

function on(offsetDays: number): string {
  return new Date(NOW.getTime() + offsetDays * DAY).toISOString().slice(0, 10)
}

function sprint(extra: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sp-1', name: 'Week 1', goal: 'Get auth working',
    startsOn: on(-3), endsOn: on(3), closedAt: null, retro: null,
    ...extra,
  }
}

function task(extra: Partial<SprintTask> = {}): SprintTask {
  return { id: 't1', title: 'A task', status: 'planned', sprintId: 'sp-1', estimateHours: 4, difficulty: 5, ...extra }
}

describe('currentSprint', () => {
  it('is the one nobody has closed', () => {
    const closed = sprint({ id: 'old', closedAt: '2026-09-01T00:00:00Z' })
    expect(currentSprint([closed, sprint()])?.id).toBe('sp-1')
  })

  it('is null once everything is reviewed', () => {
    expect(currentSprint([sprint({ closedAt: '2026-09-01T00:00:00Z' })])).toBeNull()
  })

  it('is null on a project with no sprints', () => {
    expect(currentSprint([])).toBeNull()
  })
})

describe('isOverdue', () => {
  it('is false while the sprint is still running', () => {
    expect(isOverdue(sprint(), NOW)).toBe(false)
  })

  // Ending Friday and reviewing it Monday is normal, not a failure.
  it('allows a day of grace past the end date', () => {
    expect(isOverdue(sprint({ endsOn: on(-OVERDUE_GRACE_DAYS) }), NOW)).toBe(false)
  })

  it('is true once it is properly late', () => {
    expect(isOverdue(sprint({ endsOn: on(-5) }), NOW)).toBe(true)
  })

  it('is never true for a sprint already reviewed', () => {
    expect(isOverdue(sprint({ endsOn: on(-30), closedAt: '2026-09-01T00:00:00Z' }), NOW)).toBe(false)
  })
})

describe('daysRemaining', () => {
  it('counts down to the end date', () => {
    expect(daysRemaining(sprint({ endsOn: on(3) }), NOW)).toBe(3)
  })

  it('goes negative once the sprint is over', () => {
    expect(daysRemaining(sprint({ endsOn: on(-2) }), NOW)).toBeLessThan(0)
  })
})

describe('progressOf', () => {
  const s = sprint()

  it('counts only the tasks in this sprint', () => {
    const p = progressOf(s, [
      task({ id: 'a', status: 'verified' }),
      task({ id: 'b', status: 'doing' }),
      task({ id: 'c', status: 'verified', sprintId: 'other' }),
      task({ id: 'd', status: 'planned', sprintId: null }),
    ])
    expect(p.committed).toBe(2)
    expect(p.done).toBe(1)
  })

  // Set aside is neither done nor outstanding. Counting it as done flatters
  // the week; counting it as unfinished punishes honesty.
  it('holds set-aside work apart from both', () => {
    const p = progressOf(s, [
      task({ id: 'a', status: 'verified' }),
      task({ id: 'b', status: 'abandoned' }),
    ])
    expect(p.done).toBe(1)
    expect(p.setAside).toBe(1)
    expect(p.notStarted).toBe(0)
    expect(p.inFlight).toBe(0)
    // One of one counted task finished, not one of two.
    expect(p.share).toBe(1)
  })

  it('adds up committed hours where estimates were given', () => {
    const p = progressOf(s, [task({ id: 'a', estimateHours: 4 }), task({ id: 'b', estimateHours: null })])
    expect(p.hoursCommitted).toBe(4)
  })

  it('has no share to report on an empty sprint', () => {
    expect(progressOf(s, []).share).toBeNull()
  })

  it('has no share when everything was set aside', () => {
    expect(progressOf(s, [task({ status: 'abandoned' })]).share).toBeNull()
  })
})

describe('canClose', () => {
  // Unfinished work is the normal case and is what a retro is about. Refusing
  // would teach people to close sprints by emptying them.
  it('allows closing a sprint with work still open', () => {
    expect(canClose(sprint())).toBeNull()
  })

  it('refuses a sprint that was already reviewed', () => {
    expect(canClose(sprint({ closedAt: '2026-09-01T00:00:00Z' }))).toMatch(/already been reviewed/i)
  })
})

describe('nextDates and nextName', () => {
  it('runs for a week starting today', () => {
    const { startsOn, endsOn } = nextDates(NOW)
    expect(startsOn).toBe(on(0))
    expect(endsOn).toBe(on(SPRINT_DAYS - 1))
  })

  it('numbers sprints in sequence', () => {
    expect(nextName([])).toBe('Week 1')
    expect(nextName([sprint(), sprint({ id: 'sp-2' })])).toBe('Week 3')
  })
})

describe('retroBrief', () => {
  it('names the goal and what was committed', () => {
    const brief = retroBrief(sprint(), [task({ status: 'verified' })], { slipped: [], setbacks: [] })
    expect(brief).toMatch(/Get auth working/)
    expect(brief).toMatch(/Committed 1 task/)
  })

  it('says plainly when no goal was set', () => {
    const brief = retroBrief(sprint({ goal: null }), [], { slipped: [], setbacks: [] })
    expect(brief).toMatch(/no goal was set/)
  })

  // The reasons are the point. A retro built from counts alone cannot tell
  // "saw it coming and renegotiated" from "missed it".
  it('carries the reason an estimate moved', () => {
    const brief = retroBrief(sprint(), [], {
      slipped: [{ title: 'Auth', reason: 'The OAuth callback needed a second round trip.' }],
      setbacks: [],
    })
    expect(brief).toMatch(/second round trip/)
  })

  it('marks a slip that was never explained', () => {
    const brief = retroBrief(sprint(), [], { slipped: [{ title: 'Auth', reason: null }], setbacks: [] })
    expect(brief).toMatch(/no reason given/)
  })
})

describe('kickoffBrief', () => {
  const s = sprint()
  const t = (extra: Partial<SprintTask> = {}) => task({ ...extra })

  // The one number nobody has ever told a student about themselves, and the
  // reason this is worth a model call at all.
  it('turns estimate bias into the hours it actually means', () => {
    const brief = kickoffBrief(s, [t({ estimateHours: 10 })], { bias: 0.4, spread: 0.3, sample: 8 })
    expect(brief).toMatch(/underestimate by about 40%/)
    expect(brief).toMatch(/nearer 14/)
  })

  it('says so plainly when there is not enough history', () => {
    const brief = kickoffBrief(s, [t()], { bias: null, spread: null, sample: 0 })
    expect(brief).toMatch(/Not enough finished work yet/)
    expect(brief).toMatch(/Do not guess/)
  })

  // A small sample is the same as none. Telling somebody they underestimate
  // by 40% on the basis of two tasks is a number that looks like knowledge.
  it('treats too small a sample as no history', () => {
    expect(kickoffBrief(s, [t()], { bias: 0.4, spread: 0.2, sample: 2 }))
      .toMatch(/Not enough finished work yet/)
  })

  it('flags tasks carrying no estimate, which understate the week', () => {
    const brief = kickoffBrief(s, [t({ id: 'a', estimateHours: 4 }), t({ id: 'b', estimateHours: null })],
      { bias: null, spread: null, sample: 0 })
    expect(brief).toMatch(/1 of them carry no estimate/)
  })

  it('names the hardest task', () => {
    const brief = kickoffBrief(s, [t({ id: 'a', difficulty: 3 }), t({ id: 'b', difficulty: 8 })],
      { bias: null, spread: null, sample: 0 })
    expect(brief).toMatch(/difficulty 8 of 10/)
  })

  it('reports overestimating in the other direction', () => {
    expect(kickoffBrief(s, [t({ estimateHours: 10 })], { bias: -0.25, spread: 0.2, sample: 9 }))
      .toMatch(/overestimate by about 25%/)
  })

  it("counts only this weeks tasks", () => {
    const brief = kickoffBrief(s, [t({ id: 'a', estimateHours: 4 }), t({ id: 'b', estimateHours: 99, sprintId: 'other' })],
      { bias: null, spread: null, sample: 0 })
    expect(brief).toMatch(/1 task\(s\), 4 estimated hours/)
  })
})
