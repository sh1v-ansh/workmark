import { describe, it, expect } from 'vitest'
import { ticketsToRelease, type QueueTask } from '@/lib/workspace/queue'
import { levelForTarget } from '@/lib/briefs/recommend'

const t = (id: string, position: number, extra: Partial<QueueTask> = {}): QueueTask => ({
  id, title: `Task ${id}`, status: 'backlog', position, difficulty: 3, ticketKind: null, ...extra,
})

describe('ticketsToRelease', () => {
  it('releases only the day-one ticket until it is done', () => {
    const tasks = [t('ramp', 0, { ticketKind: 'ramp_up', difficulty: 1 }), t('a', 1), t('b', 2)]
    const out = ticketsToRelease(tasks, new Map(), 2, null)
    expect(out.map((r) => r.taskId)).toEqual(['ramp'])
    // Once it is in flight, nothing else arrives on its own.
    tasks[0].status = 'doing'
    expect(ticketsToRelease(tasks, new Map(), 2, null)).toEqual([])
  })

  it('fills up to capacity in plan order once day one is done', () => {
    const tasks = [t('ramp', 0, { ticketKind: 'ramp_up', status: 'verified' }), t('b', 2), t('a', 1), t('c', 3)]
    expect(ticketsToRelease(tasks, new Map(), 2, null).map((r) => r.taskId)).toEqual(['a', 'b'])
  })

  it('does not release past what is already in flight', () => {
    const tasks = [t('a', 1, { status: 'doing' }), t('b', 2, { status: 'planned' }), t('c', 3)]
    expect(ticketsToRelease(tasks, new Map(), 2, null)).toEqual([])
  })

  it('holds back tasks whose dependencies are unfinished', () => {
    const tasks = [t('schema', 1, { status: 'doing' }), t('api', 2), t('docs', 3)]
    const deps = new Map([['api', ['schema']]])
    expect(ticketsToRelease(tasks, deps, 2, null).map((r) => r.taskId)).toEqual(['docs'])
  })

  it('puts what builds on the just-finished task first, and says so', () => {
    const schema = t('schema', 1, { status: 'verified', title: 'Design the schema' })
    const tasks = [schema, t('other', 2), t('api', 3)]
    const out = ticketsToRelease(tasks, new Map([['api', ['schema']]]), 1, schema)
    expect(out).toHaveLength(1)
    expect(out[0].taskId).toBe('api')
    expect(out[0].note).toContain('Design the schema')
  })

  it('says when the next one is a step up', () => {
    const done = t('easy', 1, { status: 'verified', difficulty: 2 })
    const out = ticketsToRelease([done, t('hard', 2, { difficulty: 5 })], new Map(), 1, done)
    expect(out[0].note).toMatch(/step up/)
  })
})

describe('levelForTarget', () => {
  it('pitches one step above an existing skill', () => {
    expect(levelForTarget(new Map([['react', 2]]), 'react')).toBe('intermediate')
    expect(levelForTarget(new Map([['react', 3]]), 'react')).toBe('advanced')
  })

  it('keeps a new skill at beginner unless they are strong elsewhere', () => {
    expect(levelForTarget(new Map([['python', 2]]), 'rust')).toBe('beginner')
    expect(levelForTarget(new Map([['python', 4]]), 'rust')).toBe('intermediate')
  })
})
