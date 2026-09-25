import { describe, it, expect } from 'vitest'
import { normalisePlannedTask, parsePlanLines, jsonObjects, MIN_TASKS, MAX_TASKS } from '../src/lib/agents/planner'
import { WORK_ROLES } from '../src/lib/workspace/membership'

// The shape the schema promises. Each test bends one field.
function raw(over: Record<string, unknown> = {}) {
  return {
    title: 'Build the events API',
    detail: 'Endpoints for listing and creating events.',
    acceptance_criteria: 'GET and POST both work and are covered by tests.',
    before_question: 'What will you try first for the list endpoint?',
    suggested_role: 'backend',
    estimate_hours: 6,
    difficulty: 5,
    verifiable: true,
    depends_on: [0],
    ...over,
  } as Parameters<typeof normalisePlannedTask>[0]
}

describe('what comes back from the planner', () => {
  it('passes a well-formed task through', () => {
    expect(normalisePlannedTask(raw())).toEqual({
      title: 'Build the events API',
      detail: 'Endpoints for listing and creating events.',
      acceptanceCriteria: 'GET and POST both work and are covered by tests.',
      beforeQuestion: 'What will you try first for the list endpoint?',
      suggestedRole: 'backend',
      estimateHours: 6,
      difficulty: 5,
      verifiable: true,
      dependsOn: [0],
    })
  })

  // Null rather than a made-up question. A hand-written task never goes
  // through the planner, and a card whose question failed to arrive must
  // still be startable — checkpoints.ts falls back to the standard one.
  it('falls back to no question rather than a bad one', () => {
    expect(normalisePlannedTask(raw({ before_question: 'too short' })).beforeQuestion).toBeNull()
    expect(normalisePlannedTask(raw({ before_question: undefined })).beforeQuestion).toBeNull()
  })

  it('plans between five and twelve tasks', () => {
    expect(MIN_TASKS).toBe(5)
    expect(MAX_TASKS).toBe(12)
  })
})

// Structured output is reliable, not a guarantee. A task with an empty title
// or a 400-hour estimate would go into the database and then into somebody's
// evidence, so the schema is checked rather than trusted.
describe('re-checking the model', () => {
  it('drops a task with no real title', () => {
    expect(normalisePlannedTask(raw({ title: '' }))).toBeNull()
    expect(normalisePlannedTask(raw({ title: '  ' }))).toBeNull()
    expect(normalisePlannedTask(raw({ title: 'x' }))).toBeNull()
  })

  it('refuses a role that is not one of ours', () => {
    expect(normalisePlannedTask(raw({ suggested_role: 'devops' }))!.suggestedRole).toBeNull()
    expect(normalisePlannedTask(raw({ suggested_role: null }))!.suggestedRole).toBeNull()
  })

  it('accepts every role that is', () => {
    for (const role of WORK_ROLES) {
      expect(normalisePlannedTask(raw({ suggested_role: role }))!.suggestedRole).toBe(role)
    }
  })

  it('clamps an absurd estimate rather than storing it', () => {
    expect(normalisePlannedTask(raw({ estimate_hours: 400 }))!.estimateHours).toBe(60)
    expect(normalisePlannedTask(raw({ estimate_hours: 0.1 }))!.estimateHours).toBe(0.5)
  })

  it('rounds estimates to the quarter hour', () => {
    expect(normalisePlannedTask(raw({ estimate_hours: 3.34 }))!.estimateHours).toBe(3.25)
  })

  it('falls back rather than storing a missing number', () => {
    expect(normalisePlannedTask(raw({ estimate_hours: 'six' }))!.estimateHours).toBe(4)
    expect(normalisePlannedTask(raw({ difficulty: 'hard' }))!.difficulty).toBe(5)
  })

  it('clamps difficulty to the scale', () => {
    expect(normalisePlannedTask(raw({ difficulty: 99 }))!.difficulty).toBe(10)
    expect(normalisePlannedTask(raw({ difficulty: 0 }))!.difficulty).toBe(1)
  })

  // Defaulting to false would quietly exempt work from checking, which is the
  // wrong way for this to fail.
  it('treats a task as verifiable unless it explicitly says otherwise', () => {
    expect(normalisePlannedTask(raw({ verifiable: false }))!.verifiable).toBe(false)
    expect(normalisePlannedTask(raw({ verifiable: undefined }))!.verifiable).toBe(true)
    expect(normalisePlannedTask(raw({ verifiable: 'no' }))!.verifiable).toBe(true)
  })

  it('ignores nonsense in the dependency list', () => {
    expect(normalisePlannedTask(raw({ depends_on: [0, -1, 2.5, 'three', 4] }))!.dependsOn).toEqual([0, 4])
    expect(normalisePlannedTask(raw({ depends_on: 'none' }))!.dependsOn).toEqual([])
  })

  it('caps the long text fields', () => {
    const task = normalisePlannedTask(raw({
      title: 'x'.repeat(500),
      detail: 'y'.repeat(9000),
      acceptance_criteria: 'z'.repeat(9000),
    }))!
    expect(task.title.length).toBe(200)
    expect(task.detail.length).toBe(4000)
    expect(task.acceptanceCriteria.length).toBe(4000)
  })
})

describe('parsePlanLines', () => {
  const line = (over: Record<string, unknown> = {}) => JSON.stringify(raw(over))

  it('reads one task per line and skips anything that is not a task', () => {
    const text = ['Here is the plan:', line({ title: 'First', depends_on: [] }), '', line({ title: 'Second' })].join('\n')
    expect(parsePlanLines(text).map((t) => t.title)).toEqual(['First', 'Second'])
  })

  it('renumbers dependencies when a line is dropped', () => {
    const text = [
      line({ title: 'Alpha', depends_on: [] }),
      line({ title: '', depends_on: [] }),
      '{ not json',
      line({ title: 'Gamma', depends_on: [0, 1, 2] }),
    ].join('\n')
    const tasks = parsePlanLines(text)
    expect(tasks.map((t) => t.title)).toEqual(['Alpha', 'Gamma'])
    // 0 still points at Alpha; 1 was the empty title and 2 the broken line.
    expect(tasks[1].dependsOn).toEqual([0])
  })

  it('drops self and forward references', () => {
    const tasks = parsePlanLines([line({ title: 'Alpha', depends_on: [0, 1] }), line({ title: 'Beta', depends_on: [0] })].join('\n'))
    expect(tasks[0].dependsOn).toEqual([])
    expect(tasks[1].dependsOn).toEqual([0])
  })

  it('stops at the task cap', () => {
    const text = Array.from({ length: MAX_TASKS + 4 }, (_, i) => line({ title: `Task ${i}`, depends_on: [] })).join('\n')
    expect(parsePlanLines(text)).toHaveLength(MAX_TASKS)
  })
})

describe('jsonObjects', () => {
  it('reads objects broken across lines and raw line breaks inside strings', () => {
    const text = 'Here you go:\n{"title": "Build the kernel",\n "detail": "Tile it.\nNew to this? Read the CUDA guide.", "n": {"x": 1}}\n{"title": "Benchmark it"}'
    const objects = jsonObjects(text)
    expect(objects).toHaveLength(2)
    expect(JSON.parse(objects[0]).detail).toBe('Tile it.\nNew to this? Read the CUDA guide.')
    expect(JSON.parse(objects[1]).title).toBe('Benchmark it')
  })

  it('keeps braces and escaped quotes inside strings', () => {
    const [one] = jsonObjects('{"title": "Use a {template} and a \\"quote\\""}')
    expect(JSON.parse(one).title).toBe('Use a {template} and a "quote"')
  })

  it('leaves an unfinished object for later', () => {
    expect(jsonObjects('{"title": "done"} {"title": "still wri')).toHaveLength(1)
  })
})
