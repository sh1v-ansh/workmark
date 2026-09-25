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
import { streamTextAgent } from './client'
import { untrusted, untrustedList } from './untrusted'
import { WORK_ROLES, type WorkRole } from '@/lib/workspace/membership'

export interface DraftTask {
  title: string
  detail: string
  acceptanceCriteria: string
  /** Asked when this card is started. Null falls back to the standard one. */
  beforeQuestion: string | null
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

Assume the student may not know every tool or idea a task names. When a task depends on a concept or technology a student at their level might not have used (for example JWT, database migrations, WebSockets, Docker, a specific library), end its detail with a sentence starting "New to this?" that says in one plain sentence what it is and where to start: the official documentation or tutorial by name, and a link only if it is the official site you are certain of (for example https://react.dev/learn). Never invent links, blog posts or videos. Skip this line when the task uses nothing a beginner would need to look up.

Do not include project setup, repository creation, or "read the documentation" as tasks. The repository already exists and the student is already working.

Write plainly, in second person. No preamble, no encouragement.

Output format: one task per line, in the order they should be done. Each line is a single JSON object with exactly these keys:
- title: one specific piece of work
- detail: a sentence or two of what it involves, then " New to this? ..." on the same line when it applies
- acceptance_criteria: observable outcomes that say this is done
- before_question: one short question, asked when the student starts this task, about what they will try first. Specific to this task and answerable in fifteen seconds; something a person can be concretely wrong about, not "how will you approach this"
- suggested_role: one of the roles you are given, or null
- estimate_hours: a number from 0.5 to 60
- difficulty: an integer from 1 to 10
- verifiable: true or false
- depends_on: an array of 0-based line numbers of earlier tasks that must come first

Between ${MIN_TASKS} and ${MAX_TASKS} lines. Nothing else: no markdown, no code fences, no blank lines, no commentary.`


interface RawTask {
  title: string
  detail: string
  acceptance_criteria: string
  before_question: string
  suggested_role: string | null
  estimate_hours: number
  difficulty: number
  verifiable: boolean
  depends_on: number[]
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
  /**
   * What has happened so far, from projectState's progressBrief.
   *
   * Null on a first plan, where there is nothing to say. Present on every
   * top-up, which is what stops the second run reading like the first one
   * with different words.
   */
  progress?: string | null
}

export async function planProject(
  supabase: SupabaseClient,
  studentId: string,
  request: PlanRequest,
  /** Called once per task as soon as its line is finished. */
  onTask?: (task: DraftTask) => void,
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
    // What has actually happened, when there is anything to say. This is the
    // difference between a planner that generates tasks and one that reads as
    // though somebody senior has been watching: knowing that two tasks came
    // back on the same theme changes what the next one should be.
    request.progress ? untrusted('What has happened so far', request.progress) : null,
  ].filter((line): line is string => line !== null).join('\n\n')

  // One task per line, so each card can be shown the moment its line ends
  // instead of after the whole plan. The final text is re-parsed below and
  // is what gets saved; the live lines are only for the person watching.
  let buffer = ''
  let shown = 0
  let scanned = 0
  const response = await streamTextAgent(supabase, {
    agentType: 'planner',
    system: SYSTEM,
    userContent,
    inputForAudit: {
      workspace_title: request.title,
      team_size: request.teamSize,
      existing_task_count: request.existingTitles.length,
    },
    studentId,
    maxTokens: 10000,
    onText: onTask
      ? (delta) => {
          buffer += delta
          const objects = jsonObjects(buffer)
          for (const raw of objects.slice(scanned)) {
            const task = parseObject(raw)
            if (task && shown < MAX_TASKS) { shown++; onTask(task) }
          }
          scanned = objects.length
        }
      : undefined,
  })

  if (!response) return null
  const tasks = parsePlanLines(response.text)
  if (tasks.length === 0) return null
  return { tasks, callId: response.callId }
}

/**
 * Every complete top-level {...} in the text, in order.
 *
 * Read by brace depth rather than by line: a model asked for one object per
 * line still sometimes breaks one across lines, or puts a real line break
 * inside a string, and splitting on newlines then lost both halves. Raw
 * line breaks inside strings are escaped so JSON.parse accepts them.
 */
export function jsonObjects(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let inString = false
  let escaped = false
  let current = ''
  let prev = '\n'
  for (const ch of text) {
    const lineStart = prev === '\n'
    prev = ch
    // A "{" in the first column outside a string starts a new task, even if
    // the last one never closed: a broken object must not swallow the next.
    if (depth > 0 && !inString && lineStart && ch === '{') {
      depth = 1
      current = '{'
      continue
    }
    if (depth === 0) {
      if (ch === '{') { depth = 1; current = '{' }
      continue
    }
    if (inString) {
      if (escaped) { escaped = false; current += ch; continue }
      if (ch === '\\') { escaped = true; current += ch; continue }
      if (ch === '"') inString = false
      current += ch === '\n' ? '\\n' : ch === '\r' ? '' : ch === '\t' ? '\\t' : ch
      continue
    }
    current += ch
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { out.push(current); current = '' }
    }
  }
  return out
}

function parseObject(raw: string): DraftTask | null {
  try {
    return normalise(JSON.parse(raw) as RawTask)
  } catch {
    return null
  }
}

/**
 * The whole plan from the model's text, one task per line.
 *
 * depends_on counts lines, so when a line is dropped (bad JSON, empty title)
 * the indexes after it are renumbered, and any edge pointing at the dropped
 * line goes with it.
 */
export function parsePlanLines(text: string): DraftTask[] {
  const kept: DraftTask[] = []
  const newIndex = new Map<number, number>()
  jsonObjects(text).forEach((raw, lineNo) => {
    const task = parseObject(raw)
    if (task && kept.length < MAX_TASKS) {
      newIndex.set(lineNo, kept.length)
      kept.push(task)
    }
  })
  return kept.map((task, i) => ({
    ...task,
    dependsOn: task.dependsOn
      .map((d) => newIndex.get(d))
      .filter((d): d is number => d !== undefined && d < i),
  }))
}

/**
 * Re-check what came back.
 *
 * The prompt constrains the model, and this catches the model being
 * wrong. It is reliable and not a guarantee: a task with an
 * empty title or an estimate of 400 hours would go straight into the
 * database and then into somebody's evidence.
 */
function normalise(raw: RawTask): DraftTask | null {
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
    beforeQuestion: typeof raw.before_question === 'string' && raw.before_question.length >= 10
      ? raw.before_question.slice(0, 300)
      : null,
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
