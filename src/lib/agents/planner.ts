// The planner: turning a project into a plan the student then owns.
//
// The important word is "proposes". This drafts tasks; the student accepts,
// edits, reorders, deletes and adds. That is not a UX nicety — it is the
// measurement. Whether somebody takes an AI plan wholesale, reshapes it, or
// throws most of it out is one of the clearest signals in the product about
// how they turn an ambiguous problem into executable work, and it only
// exists if the plan arrives as a proposal rather than as a fact.
//
// So nothing here writes a task directly. It returns drafts, the route
// stores them with origin 'ai_proposed', and every later edit flips that to
// 'ai_edited'. The three values are the evidence.
//
// One call per project. Re-planning mid-project is more useful and costs a
// call each time; the deliberate choice is one at the start plus a manual
// "suggest more tasks", so a dormant project costs nothing.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted, untrustedList } from './untrusted'
import { WORK_ROLES, type WorkRole } from '@/lib/workspace/membership'

export interface DraftTask {
  title: string
  detail: string
  acceptanceCriteria: string
  suggestedRole: WorkRole | null
  estimateHours: number
  difficulty: number
  verifiable: boolean
  /** Index into the same array. Used to draw the order, not enforced. */
  dependsOn: number[]
}

export interface PlanResult {
  tasks: DraftTask[]
  /** The agent_calls row, so tasks can point at the plan that proposed them. */
  callId: string | null
}

const MIN_TASKS = 5
const MAX_TASKS = 12

const SYSTEM = `You break a student software project into a first plan of tasks.

The student will edit this. Your job is a good starting point they can argue with, not a specification they must follow. A plan that is obviously wrong in one place and right in eight is more useful than a vague plan that is never wrong.

What makes a task good here:
- It names a specific piece of work, not an area. "Add rate limiting to the events endpoint", not "backend work".
- It has acceptance criteria concrete enough that somebody reading the repository afterwards could tell whether it was done. This is the field a verification engine later compares against real commits, tests and CI, so write it as observable outcomes rather than intentions.
- It is a few hours to a couple of days. Anything larger should be split; anything under an hour should be folded into its neighbour.
- It is honest about order. Schema before the endpoints that read it, auth before the thing it protects.

Estimates are in hours and should reflect a student working alone at their stated level, including the reading and the false starts — not the time it would take somebody who had done it before. Students systematically underestimate; do not copy that habit.

difficulty is 1 to 10 for how hard this task is for a capable student, independent of how long it takes. A long tedious task can be difficulty 3. A short subtle one can be difficulty 8.

Most tasks produce code. Set verifiable to false only for work that genuinely leaves no trace in a repository — user interviews, choosing between vendors, sketching an interface on paper. Design work that ends in committed files is verifiable.

Assign each task a role from the list you are given, or null if any of them could do it. Match the roles the team actually has: do not propose six machine-learning tasks to a team of two frontend students.

Do not include project setup, repository creation, or "read the documentation" as tasks. The repository already exists and the student is already working.

Write plainly, in second person. No preamble, no encouragement.`

const SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      minItems: MIN_TASKS,
      maxItems: MAX_TASKS,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'One specific piece of work.' },
          detail: { type: 'string', description: 'A sentence or two of what it involves.' },
          acceptance_criteria: {
            type: 'string',
            description: 'Observable outcomes that say this is done.',
          },
          suggested_role: {
            type: ['string', 'null'],
            enum: [...WORK_ROLES, null],
          },
          estimate_hours: { type: 'number', minimum: 0.5, maximum: 60 },
          difficulty: { type: 'integer', minimum: 1, maximum: 10 },
          verifiable: { type: 'boolean' },
          depends_on: {
            type: 'array',
            items: { type: 'integer', minimum: 0 },
            description: 'Indexes of earlier tasks in this list that must come first.',
          },
        },
        required: [
          'title', 'detail', 'acceptance_criteria', 'suggested_role',
          'estimate_hours', 'difficulty', 'verifiable', 'depends_on',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
} as const

interface AgentResponse {
  tasks: {
    title: string
    detail: string
    acceptance_criteria: string
    suggested_role: string | null
    estimate_hours: number
    difficulty: number
    verifiable: boolean
    depends_on: number[]
  }[]
}

export interface PlanRequest {
  title: string
  summary: string | null
  /** Work roles the team actually holds, so the plan fits the people on it. */
  teamRoles: WorkRole[]
  teamSize: number
  deadline: string | null
  /** Titles already on the board, so a top-up does not repeat them. */
  existingTitles: string[]
}

export async function planProject(
  supabase: SupabaseClient,
  studentId: string,
  request: PlanRequest,
): Promise<PlanResult | null> {
  const roles = request.teamRoles.length > 0 ? request.teamRoles : [...WORK_ROLES]

  const userContent = [
    untrusted('Project name', request.title),
    untrusted('What it is', request.summary ?? 'The student did not describe it beyond the name.'),
    `Team size: ${request.teamSize}`,
    untrustedList('Roles the team holds', roles),
    request.deadline ? `Deadline: ${request.deadline}` : 'No deadline set.',
    request.existingTitles.length > 0
      ? untrustedList('Tasks already on the board — do not repeat these', request.existingTitles)
      : 'The board is empty.',
  ].join('\n\n')

  const response = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'planner',
    system: SYSTEM,
    userContent,
    schema: SCHEMA,
    inputForAudit: {
      workspace_title: request.title,
      team_size: request.teamSize,
      existing_task_count: request.existingTitles.length,
    },
    studentId,
  })

  if (!response || !Array.isArray(response.tasks)) return null

  const tasks = response.tasks.map(normalise).filter((t): t is DraftTask => t !== null)
  if (tasks.length === 0) return null

  // The call id lets each stored task point at the plan that proposed it,
  // which is what makes "of nine suggestions, how many survived" answerable
  // later. Best-effort: a missing id costs the acceptance rate, not the plan.
  const { data: call } = await supabase
    .from('agent_calls')
    .select('id')
    .eq('agent_type', 'planner')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { tasks, callId: (call?.id as string) ?? null }
}

/**
 * Re-check what came back.
 *
 * The schema constrains the model, and this constrains the schema being
 * wrong. Structured output is reliable and not a guarantee: a task with an
 * empty title or an estimate of 400 hours would go straight into the
 * database and then into somebody's evidence.
 */
function normalise(raw: AgentResponse['tasks'][number]): DraftTask | null {
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : ''
  if (title.length < 2) return null

  const role = typeof raw.suggested_role === 'string'
    && (WORK_ROLES as readonly string[]).includes(raw.suggested_role)
    ? (raw.suggested_role as WorkRole)
    : null

  const estimate = Number(raw.estimate_hours)
  const difficulty = Number(raw.difficulty)

  return {
    title,
    detail: typeof raw.detail === 'string' ? raw.detail.trim().slice(0, 4000) : '',
    acceptanceCriteria: typeof raw.acceptance_criteria === 'string'
      ? raw.acceptance_criteria.trim().slice(0, 4000)
      : '',
    suggestedRole: role,
    estimateHours: Number.isFinite(estimate) ? clamp(round(estimate), 0.5, 60) : 4,
    difficulty: Number.isInteger(difficulty) ? clamp(difficulty, 1, 10) : 5,
    verifiable: raw.verifiable !== false,
    dependsOn: Array.isArray(raw.depends_on)
      ? raw.depends_on.filter((n) => Number.isInteger(n) && n >= 0).slice(0, 6)
      : [],
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function round(n: number): number {
  return Math.round(n * 4) / 4
}

export { normalise as normalisePlannedTask, MIN_TASKS, MAX_TASKS }
