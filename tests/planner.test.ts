import { describe, it, expect } from 'vitest'
import { normalisePlannedTask, MIN_TASKS, MAX_TASKS } from '../src/lib/agents/planner'
import { WORK_ROLES } from '../src/lib/workspace/membership'

// The shape the schema promises. Each test bends one field.
function raw(over: Record<string, unknown> = {}) {
  return {
    title: 'Build the events API',
    detail: 'Endpoints for listing and creating events.',
    acceptance_criteria: 'GET and POST both work and are covered by tests.',
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
      suggestedRole: 'backend',
      estimateHours: 6,
      difficulty: 5,
      verifiable: true,
      dependsOn: [0],
    })
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
