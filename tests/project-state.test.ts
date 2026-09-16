import { describe, it, expect } from 'vitest'
import {
  completed, inFlight, notStarted, open, setAside, blocked, awaitingSomeone, setbacks,
  canAskForMore, progressBrief,
  type ProjectState, type StateTask,
} from '../src/lib/workspace/project-state'
import { canMoveTo, TASK_STATUSES, BOARD_COLUMNS, isOnBoard, type TaskStatus } from '../src/lib/workspace/tasks'
import { capabilityFrontier } from '../src/lib/workspace/metrics'

function task(extra: Partial<StateTask> = {}): StateTask {
  return {
    id: 'task-1', title: 'A task', status: 'planned',
    difficulty: 5, estimateHours: 4, dueOn: null, assigneeId: 'alice',
    startedAt: null, blockedReason: null, abandonedReason: null,
    latestVerdict: null, verdictNote: null, attempts: 0,
    ...extra,
  }
}

function state(tasks: StateTask[]): ProjectState {
  return {
    workspaceId: 'ws-1', title: 'A project', status: 'active',
    deadline: null, tasks, revisions: [],
  }
}

describe('the status set', () => {
  it('keeps abandoned off the board', () => {
    expect(TASK_STATUSES).toContain('abandoned')
    expect(BOARD_COLUMNS as readonly string[]).not.toContain('abandoned')
  })

  it('says which statuses render as columns', () => {
    expect(isOnBoard('doing')).toBe(true)
    expect(isOnBoard('abandoned')).toBe(false)
  })
})

describe('canMoveTo, with set-aside work', () => {
  it('lets unfinished work be set aside from anywhere', () => {
    for (const from of ['backlog', 'planned', 'doing', 'submitted'] as TaskStatus[]) {
      expect(canMoveTo(from, 'abandoned')).toBeNull()
    }
  })

  // Abandoning verified work would take back a verdict the record may
  // already rest on.
  it('refuses to set aside work that is already verified', () => {
    expect(canMoveTo('verified', 'abandoned')).toMatch(/already verified/i)
  })

  it('still refuses to touch an accepted task at all', () => {
    expect(canMoveTo('accepted', 'abandoned')).toMatch(/closed/i)
  })

  it('reopens set-aside work to Planned', () => {
    expect(canMoveTo('abandoned', 'planned')).toBeNull()
  })

  it('does not reopen it straight into Doing', () => {
    expect(canMoveTo('abandoned', 'doing')).toMatch(/comes back to Planned/i)
  })

  it('never lets anyone move a card into Verified', () => {
    expect(canMoveTo('abandoned', 'verified')).toMatch(/Workmark decides/i)
  })
})

describe('capabilityFrontier and set-aside work', () => {
  const hard = (status: TaskStatus, difficulty: number) =>
    ({ status, difficulty } as Parameters<typeof capabilityFrontier>[0][number])

  // The incentive that makes the feature usable at all. If setting work aside
  // counted as a failure, nobody would ever do it and cards would sit in
  // Doing forever, which is the behaviour this was built to replace.
  it('does not count set-aside work as a failure', () => {
    const withAbandoned = [
      hard('verified', 5), hard('verified', 5), hard('verified', 5), hard('verified', 5),
      hard('abandoned', 5),
    ]
    const without = withAbandoned.slice(0, 4)
    expect(capabilityFrontier(withAbandoned)).toBe(capabilityFrontier(without))
  })

  // Nor is it an escape hatch: dropping them shrinks the sample rather than
  // flattering the ratio, so abandoning everything hard yields no frontier
  // at all rather than an inflated one.
  it('falls under the sample floor rather than overstating', () => {
    const mostlyAbandoned = [
      hard('verified', 3), hard('verified', 3),
      hard('abandoned', 8), hard('abandoned', 8), hard('abandoned', 8), hard('abandoned', 8),
    ]
    expect(capabilityFrontier(mostlyAbandoned)).toBeNull()
  })
})

describe('reading a project state', () => {
  const s = state([
    task({ id: 'a', status: 'verified' }),
    task({ id: 'b', status: 'accepted' }),
    task({ id: 'c', status: 'doing' }),
    task({ id: 'd', status: 'submitted' }),
    task({ id: 'e', status: 'planned' }),
    task({ id: 'f', status: 'backlog' }),
    task({ id: 'g', status: 'abandoned', abandonedReason: 'The library does not support streaming here.' }),
  ])

  it('counts only verified and accepted as completed', () => {
    expect(completed(s).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('treats set-aside work as finished, not as open', () => {
    expect(open(s).map((t) => t.id)).toEqual(['c', 'd', 'e', 'f'])
    expect(setAside(s).map((t) => t.id)).toEqual(['g'])
  })

  it('separates started from not started', () => {
    expect(inFlight(s).map((t) => t.id)).toEqual(['c', 'd'])
    expect(notStarted(s).map((t) => t.id)).toEqual(['e', 'f'])
  })

  // The guard on "give me more work": somebody with several of these needs
  // their existing work looked at, not a bigger board.
  it('finds work waiting on somebody else', () => {
    expect(awaitingSomeone(s).map((t) => t.id)).toEqual(['d'])
  })
})

describe('blocked', () => {
  it('reports only cards that are stuck right now', () => {
    const s = state([
      task({ id: 'a', blockedReason: 'Waiting on an API key.' }),
      task({ id: 'b', blockedReason: null }),
    ])
    expect(blocked(s).map((t) => t.id)).toEqual(['a'])
  })
})

describe('setbacks', () => {
  // The input that makes a planner read as senior rather than generative:
  // two failures on one theme is a different next task from a count of two.
  it('gathers what came back and why, from both kinds', () => {
    const s = state([
      task({ id: 'a', status: 'doing', latestVerdict: 'needs_work', verdictNote: 'Error paths are untested.' }),
      task({ id: 'b', status: 'abandoned', abandonedReason: 'Runtime has no streaming support.' }),
      task({ id: 'c', status: 'verified', latestVerdict: 'verified' }),
    ])
    expect(setbacks(s)).toEqual([
      { title: 'A task', note: 'Error paths are untested.' },
      { title: 'A task', note: 'Runtime has no streaming support.' },
    ])
  })

  it('is empty on a project where nothing has gone wrong', () => {
    expect(setbacks(state([task({ status: 'verified', latestVerdict: 'verified' })]))).toEqual([])
  })
})

describe('canAskForMore', () => {
  const active = (tasks: StateTask[]) => state(tasks)

  it('lets a student with a nearly empty board ask', () => {
    expect(canAskForMore(active([task({ status: 'verified' })]))).toBeNull()
  })

  // The guard that matters. Somebody with a pile waiting to be checked needs
  // those looked at, not a bigger board.
  it('refuses while too much is waiting to be checked', () => {
    const waiting = Array.from({ length: 4 }, (_, i) => task({ id: `s${i}`, status: 'submitted' }))
    expect(canAskForMore(active(waiting))).toMatch(/waiting to be checked/i)
  })

  it('refuses when the board is already full of open work', () => {
    const open = Array.from({ length: 9 }, (_, i) => task({ id: `p${i}`, status: 'planned' }))
    expect(canAskForMore(active(open))).toMatch(/already 9 tasks open/i)
  })

  // Set-aside work is finished, so it must not count towards the open cap —
  // otherwise abandoning things would lock you out of asking for more, which
  // is the opposite of the incentive the status exists to create.
  it('does not count set-aside work towards the open cap', () => {
    const aside = Array.from({ length: 9 }, (_, i) =>
      task({ id: `a${i}`, status: 'abandoned', abandonedReason: 'Did not work.' }))
    expect(canAskForMore(active(aside))).toBeNull()
  })

  it('refuses on a project that has not started', () => {
    expect(canAskForMore({ ...state([]), status: 'draft' })).toMatch(/Start the project first/i)
  })

  it('refuses on a finished project', () => {
    expect(canAskForMore({ ...state([]), status: 'closed' })).toMatch(/finished/i)
  })
})

describe('progressBrief', () => {
  it('leads with what went wrong', () => {
    const brief = progressBrief(state([
      task({ id: 'a', status: 'doing', latestVerdict: 'needs_work', verdictNote: 'Error paths are untested.' }),
      task({ id: 'b', status: 'verified', difficulty: 6 }),
    ]))
    expect(brief.indexOf('Error paths are untested.')).toBeLessThan(brief.indexOf('finished and verified'))
  })

  it('names the hardest thing finished', () => {
    const brief = progressBrief(state([
      task({ id: 'a', status: 'verified', difficulty: 3 }),
      task({ id: 'b', status: 'verified', difficulty: 7 }),
    ]))
    expect(brief).toMatch(/hardest at difficulty 7/)
  })

  it('says plainly when nothing is done yet', () => {
    expect(progressBrief(state([task({ status: 'planned' })]))).toMatch(/Nothing has been finished yet/)
  })

  it('reports what is blocked and why', () => {
    const brief = progressBrief(state([task({ blockedReason: 'Waiting on an API key.' })]))
    expect(brief).toMatch(/Waiting on an API key\./)
  })
})
