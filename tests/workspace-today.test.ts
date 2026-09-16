import { describe, it, expect } from 'vitest'
import { rankToday, emptyReason, SHOW_TODAY, type TodayTask } from '../src/lib/workspace/today'

const ME = 'alice'
const TODAY = '2026-09-16'

function task(extra: Partial<TodayTask> = {}): TodayTask {
  return {
    id: 't1', title: 'A task', status: 'planned', assigneeId: ME,
    dueOn: null, difficulty: 5, sprintId: null, blockedAt: null, parentTaskId: null,
    ...extra,
  }
}
const rank = (tasks: TodayTask[], deps: { taskId: string; dependsOnTaskId: string }[] = [], sprintId: string | null = null) =>
  rankToday(tasks, deps, { userId: ME, sprintId, today: TODAY })

describe('what comes first', () => {
  it('puts something overdue above everything', () => {
    const got = rank([
      task({ id: 'soon', dueOn: '2026-09-16' }),
      task({ id: 'late', dueOn: '2026-09-14' }),
    ])
    expect(got[0].task.id).toBe('late')
    expect(got[0].reason).toMatch(/2 days overdue/)
  })

  it('puts due-today above due-later', () => {
    const got = rank([task({ id: 'later', dueOn: '2026-09-18' }), task({ id: 'now', dueOn: TODAY })])
    expect(got[0].task.id).toBe('now')
    expect(got[0].reason).toBe('Due today')
  })

  // The reason is the whole value of ranking. A list with no explanation is
  // one people re-sort in their head and then ignore.
  it('says how many things are stuck behind a card', () => {
    const got = rank(
      [task({ id: 'blocker' }), task({ id: 'a' }), task({ id: 'b' })],
      [{ taskId: 'a', dependsOnTaskId: 'blocker' }, { taskId: 'b', dependsOnTaskId: 'blocker' }],
    )
    expect(got[0].task.id).toBe('blocker')
    expect(got[0].reason).toMatch(/2 other tasks are waiting on this/)
  })

  it('does not count finished waiters as urgency', () => {
    const got = rank(
      [task({ id: 'blocker' }), task({ id: 'a', status: 'verified' })],
      [{ taskId: 'a', dependsOnTaskId: 'blocker' }],
    )
    expect(got[0].reason).not.toMatch(/waiting on this/)
  })

  it('surfaces what they committed to this week', () => {
    const got = rank([task({ id: 'x', sprintId: 'sp' })], [], 'sp')
    expect(got[0].reason).toMatch(/committed to this for the week/)
  })

  it('prefers finishing over starting on a tie', () => {
    const got = rank([task({ id: 'fresh', status: 'planned' }), task({ id: 'started', status: 'doing' })])
    expect(got[0].task.id).toBe('started')
  })

  it('never offers more than a strip', () => {
    const many = Array.from({ length: 9 }, (_, i) => task({ id: `t${i}` }))
    expect(rank(many)).toHaveLength(SHOW_TODAY)
  })
})

describe('what is left out', () => {
  // Putting something they said they cannot proceed on at the top of "do this
  // today" is the product ignoring what they took the trouble to tell it.
  it('leaves out anything blocked', () => {
    expect(rank([task({ blockedAt: '2026-09-15T00:00:00Z' })])).toHaveLength(0)
  })

  it('leaves out work waiting on an unfinished dependency', () => {
    const got = rank(
      [task({ id: 'a' }), task({ id: 'dep', status: 'doing' })],
      [{ taskId: 'a', dependsOnTaskId: 'dep' }],
    )
    expect(got.map((r) => r.task.id)).toEqual(['dep'])
  })

  it('lets it through once the dependency is done', () => {
    const got = rank(
      [task({ id: 'a' }), task({ id: 'dep', status: 'verified' })],
      [{ taskId: 'a', dependsOnTaskId: 'dep' }],
    )
    expect(got.map((r) => r.task.id)).toEqual(['a'])
  })

  it('leaves out finished, set-aside and submitted work', () => {
    expect(rank([
      task({ id: 'a', status: 'verified' }),
      task({ id: 'b', status: 'abandoned' }),
      task({ id: 'c', status: 'submitted' }),
    ])).toHaveLength(0)
  })

  // A container is not a thing you sit down and do.
  it('leaves out parents and offers their pieces', () => {
    const got = rank([task({ id: 'parent' }), task({ id: 'kid', parentTaskId: 'parent' })])
    expect(got.map((r) => r.task.id)).toEqual(['kid'])
  })

  it('leaves out somebody else’s work but keeps unassigned', () => {
    const got = rank([task({ id: 'theirs', assigneeId: 'bob' }), task({ id: 'free', assigneeId: null })])
    expect(got.map((r) => r.task.id)).toEqual(['free'])
  })
})

describe('emptyReason', () => {
  // "Nothing to do" on a board where everything is blocked is actively wrong.
  it('says when the work is all blocked', () => {
    expect(emptyReason([task({ blockedAt: '2026-09-15T00:00:00Z' })], { userId: ME }))
      .toMatch(/Unblocking one of them is the work/)
  })

  it('says when everything is waiting to be checked', () => {
    expect(emptyReason([task({ status: 'submitted' })], { userId: ME })).toMatch(/waiting to be checked/)
  })

  it('says when there is genuinely nothing assigned', () => {
    expect(emptyReason([task({ assigneeId: 'bob' })], { userId: ME })).toMatch(/Nothing is assigned to you/)
  })

  it('says when it is all done', () => {
    expect(emptyReason([task({ status: 'verified' })], { userId: ME })).toMatch(/finished/)
  })
})
