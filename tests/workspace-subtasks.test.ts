import { describe, it, expect } from 'vitest'
import {
  canAddSubtask, childrenOf, hasChildren, countable, canSubmitParent,
  childProgress, decomposedAt, type SubtaskNode,
} from '../src/lib/workspace/subtasks'

function node(extra: Partial<SubtaskNode> = {}): SubtaskNode {
  return { id: 'p', parentTaskId: null, status: 'planned', createdAt: '2026-09-01T00:00:00Z', startedAt: null, ...extra }
}

describe('canAddSubtask', () => {
  it('allows breaking up a top-level task', () => {
    expect(canAddSubtask(node())).toBeNull()
  })

  // A tree is a project plan and nobody maintains one past week two.
  it('refuses a second level', () => {
    expect(canAddSubtask(node({ parentTaskId: 'other' }))).toMatch(/not two/i)
  })

  it('refuses a closed task', () => {
    expect(canAddSubtask(node({ status: 'accepted' }))).toMatch(/closed/i)
  })

  it('refuses set-aside work until it is picked back up', () => {
    expect(canAddSubtask(node({ status: 'abandoned' }))).toMatch(/set aside/i)
  })
})

describe('countable', () => {
  // The rule the whole module exists for. Counting a parent and its children
  // gives a task broken into three four times the credit, in evidence, in
  // metrics and in a week's progress.
  it('counts leaves and never their parent', () => {
    const tasks = [
      node({ id: 'parent' }),
      node({ id: 'a', parentTaskId: 'parent' }),
      node({ id: 'b', parentTaskId: 'parent' }),
      node({ id: 'lonely' }),
    ]
    expect(countable(tasks).map((t) => t.id)).toEqual(['a', 'b', 'lonely'])
  })

  it('counts a childless task as work', () => {
    expect(countable([node({ id: 'solo' })]).map((t) => t.id)).toEqual(['solo'])
  })

  it('is empty for an empty board', () => {
    expect(countable([])).toEqual([])
  })

  it('does not drop a child whose parent is not in the list', () => {
    expect(countable([node({ id: 'orphan', parentTaskId: 'gone' })]).map((t) => t.id)).toEqual(['orphan'])
  })
})

describe('canSubmitParent', () => {
  const parent = node({ id: 'p', status: 'doing' })

  it('allows a parent whose children are all done', () => {
    const tasks = [parent, node({ id: 'a', parentTaskId: 'p', status: 'verified' })]
    expect(canSubmitParent(tasks, 'p')).toBeNull()
  })

  it('refuses while a child is still open', () => {
    const tasks = [parent, node({ id: 'a', parentTaskId: 'p', status: 'doing' })]
    expect(canSubmitParent(tasks, 'p')).toMatch(/1 subtask still open/i)
  })

  // Deciding a piece is not happening is an answer, so the parent closes
  // around it rather than being stuck behind it.
  it('does not count set-aside children as open', () => {
    const tasks = [parent, node({ id: 'a', parentTaskId: 'p', status: 'abandoned' })]
    expect(canSubmitParent(tasks, 'p')).toBeNull()
  })

  it('allows a parent with no children at all', () => {
    expect(canSubmitParent([parent], 'p')).toBeNull()
  })
})

describe('childProgress', () => {
  it('reports how far through the children the work is', () => {
    const tasks = [
      node({ id: 'p' }),
      node({ id: 'a', parentTaskId: 'p', status: 'verified' }),
      node({ id: 'b', parentTaskId: 'p', status: 'doing' }),
    ]
    expect(childProgress(tasks, 'p')).toEqual({ done: 1, total: 2 })
  })

  it('is null on a card with no children, which is most of them', () => {
    expect(childProgress([node({ id: 'p' })], 'p')).toBeNull()
  })
})

describe('decomposedAt', () => {
  const started = node({ id: 'p', startedAt: '2026-09-05T00:00:00Z' })

  // The interesting half. Splitting before touching it is reading the
  // problem; splitting on day three is finding out what it actually was.
  it('is planning when the split came before the work did', () => {
    expect(decomposedAt(started, node({ createdAt: '2026-09-04T00:00:00Z' }))).toBe('planned')
  })

  it('is discovery when the split came after', () => {
    expect(decomposedAt(started, node({ createdAt: '2026-09-08T00:00:00Z' }))).toBe('discovered')
  })

  // Nothing to be before or after. Guessing would make the figure meaningless.
  it('is null when the parent was never started', () => {
    expect(decomposedAt(node({ startedAt: null }), node())).toBeNull()
  })
})

describe('hasChildren and childrenOf', () => {
  const tasks = [node({ id: 'p' }), node({ id: 'a', parentTaskId: 'p' })]
  it('finds them', () => {
    expect(hasChildren(tasks, 'p')).toBe(true)
    expect(childrenOf(tasks, 'p').map((t) => t.id)).toEqual(['a'])
  })
  it('says so when there are none', () => {
    expect(hasChildren(tasks, 'a')).toBe(false)
  })
})
