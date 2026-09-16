import { describe, it, expect } from 'vitest'
import {
  addDays, daysBetween, weekdayIndex, monthView, shiftMonth, monthOf,
  byDueDate, spanAt, isOverdue, type DatedTask,
} from '../src/lib/workspace/calendar'

function task(extra: Partial<DatedTask> = {}): DatedTask {
  return { id: 't1', title: 'A task', status: 'planned', dueOn: '2026-09-16', ...extra }
}

describe('date arithmetic stays on plain dates', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-09-16', 1)).toBe('2026-09-17')
    expect(addDays('2026-09-16', -1)).toBe('2026-09-15')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })

  // The bug this module exists to avoid. Crossing a DST boundary with local
  // date arithmetic drops or gains an hour and lands on the wrong day; these
  // spans cross the US and EU changeovers in both directions.
  it('is unaffected by daylight saving', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
    expect(daysBetween('2026-10-01', '2026-11-01')).toBe(31)
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('counts Monday as the first day of the week', () => {
    // 2026-09-14 is a Monday.
    expect(weekdayIndex('2026-09-14')).toBe(0)
    expect(weekdayIndex('2026-09-20')).toBe(6)
  })
})

describe('monthView', () => {
  const view = monthView('2026-09', '2026-09-16')

  it('is always six whole weeks, so the panel never changes height', () => {
    expect(view.weeks).toHaveLength(6)
    for (const week of view.weeks) expect(week).toHaveLength(7)
  })

  it('starts on a Monday', () => {
    expect(weekdayIndex(view.weeks[0][0].date)).toBe(0)
  })

  it('marks which days belong to other months', () => {
    const borrowed = view.weeks.flat().filter((c) => !c.inMonth)
    expect(borrowed.length).toBeGreaterThan(0)
    for (const cell of borrowed) expect(cell.date.slice(0, 7)).not.toBe('2026-09')
  })

  it('contains every day of the month exactly once', () => {
    const own = view.weeks.flat().filter((c) => c.inMonth).map((c) => c.date)
    expect(own).toHaveLength(30)
    expect(new Set(own).size).toBe(30)
  })

  it('marks today, and only today', () => {
    expect(view.weeks.flat().filter((c) => c.isToday).map((c) => c.date)).toEqual(['2026-09-16'])
  })

  it('names the month for a person', () => {
    expect(view.label).toBe('September 2026')
  })
})

describe('shiftMonth', () => {
  it('moves forward and back', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-09', -1)).toBe('2026-08')
  })

  it('rolls over a year in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('reads the month off a date', () => {
    expect(monthOf('2026-09-16')).toBe('2026-09')
  })
})

describe('byDueDate', () => {
  it('groups tasks on the day they are due', () => {
    const got = byDueDate([task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c', dueOn: '2026-09-18' })])
    expect(got.get('2026-09-16')?.map((t) => t.id)).toEqual(['a', 'b'])
  })

  // A calendar that invented a position for undated work would be showing
  // something untrue about a board that is mostly undated.
  it('leaves undated work off the calendar', () => {
    expect(byDueDate([task({ dueOn: null })]).size).toBe(0)
  })
})

describe('spanAt', () => {
  const week = { from: '2026-09-14', to: '2026-09-20' }

  it('finds the ends and the middle', () => {
    expect(spanAt(week, '2026-09-14')).toBe('start')
    expect(spanAt(week, '2026-09-17')).toBe('middle')
    expect(spanAt(week, '2026-09-20')).toBe('end')
  })

  it('is null outside the range', () => {
    expect(spanAt(week, '2026-09-13')).toBeNull()
    expect(spanAt(week, '2026-09-21')).toBeNull()
  })

  it('calls a one-day range single, which is what a deadline is', () => {
    expect(spanAt({ from: '2026-09-16', to: '2026-09-16' }, '2026-09-16')).toBe('single')
  })
})

describe('isOverdue', () => {
  it('flags unfinished work past its date', () => {
    expect(isOverdue(task({ dueOn: '2026-09-15' }), '2026-09-16')).toBe(true)
  })

  it('does not flag work due today', () => {
    expect(isOverdue(task({ dueOn: '2026-09-16' }), '2026-09-16')).toBe(false)
  })

  // Delivered late is a fact for the record, not something to keep flagging
  // in red on a calendar somebody is using to plan the week ahead.
  it('stops flagging once the work is done', () => {
    expect(isOverdue(task({ dueOn: '2026-09-01', status: 'verified' }), '2026-09-16')).toBe(false)
    expect(isOverdue(task({ dueOn: '2026-09-01', status: 'abandoned' }), '2026-09-16')).toBe(false)
  })
})
