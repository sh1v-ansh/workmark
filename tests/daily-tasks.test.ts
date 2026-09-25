import { describe, it, expect } from 'vitest'
import { pickDailyBatch, localNow, validTimezone, type BatchTask } from '../src/lib/workspace/daily'

const t = (id: string, position: number, over: Partial<BatchTask> = {}): BatchTask =>
  ({ id, status: 'backlog', position, estimateHours: 1, ticketKind: null, ...over })

describe('pickDailyBatch', () => {
  it('takes about a day of work in plan order', () => {
    const tasks = [t('a', 1, { estimateHours: 2 }), t('b', 2, { estimateHours: 2 }), t('c', 3)]
    expect(pickDailyBatch(tasks, new Map())).toEqual(['a', 'b'])
  })

  it('puts the day-one ticket first', () => {
    const tasks = [t('a', 1), t('ramp', 0, { ticketKind: 'ramp_up' })]
    expect(pickDailyBatch(tasks, new Map())[0]).toBe('ramp')
  })

  it('never more than three tasks', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => t(`t${i}`, i, { estimateHours: 0.5 }))
    expect(pickDailyBatch(tasks, new Map())).toHaveLength(3)
  })

  it('lets a dependent task come with the one it depends on', () => {
    const tasks = [t('a', 1), t('b', 2)]
    expect(pickDailyBatch(tasks, new Map([['b', ['a']]]))).toEqual(['a', 'b'])
  })

  it('skips a task whose dependency is still in the backlog and not picked', () => {
    const tasks = [t('x', 1, { estimateHours: 3 }), t('a', 2), t('b', 3)]
    expect(pickDailyBatch(tasks, new Map([['a', ['later']], ['later', []]]))).toEqual(['x'])
  })

  it('holds the batch when too much is still unfinished', () => {
    const busy = Array.from({ length: 4 }, (_, i) => t(`d${i}`, i, { status: 'doing' }))
    expect(pickDailyBatch([...busy, t('a', 9)], new Map())).toEqual([])
  })
})

describe('localNow', () => {
  it('reads the date and hour in a timezone', () => {
    const at = new Date('2026-09-25T13:30:00Z')
    expect(localNow('America/New_York', at)).toEqual({ date: '2026-09-25', hour: 9 })
    expect(localNow('Asia/Kolkata', at)).toEqual({ date: '2026-09-25', hour: 19 })
  })

  it('falls back to UTC for a bad timezone', () => {
    expect(validTimezone('Not/AZone')).toBeNull()
    expect(localNow('Not/AZone', new Date('2026-09-25T13:30:00Z')).hour).toBe(13)
  })
})
