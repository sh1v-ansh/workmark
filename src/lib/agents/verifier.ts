// The verification agent: one call, a batch of tasks.
//
// This is the only place in Workmark where a model decides something that
// lands on a student's permanent record, so it is deliberately the most
// constrained agent here.
//
// It never sees a task with no evidence — those are settled by arithmetic
// before this runs. It never sees the raw diff — paths, commit messages and
// CI conclusions are what a case is made of, and the diff is large and
// already in GitHub. And its confidence is capped afterwards by what the
// deterministic checks found, so a persuasive commit message cannot talk a
// task past red CI.
//
// Batched because the expensive part is context, not questions. Ten tasks
// submitted in a day share a repository, a project and a team; asking about
// all of them in one call costs roughly what two separate calls would.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted, untrustedList } from './untrusted'
import type { CaseFile } from '@/lib/workspace/verify'

export interface VerifierTask {
  taskId: string
  title: string
  acceptanceCriteria: string | null
  caseFile: CaseFile
}

export interface VerifierVerdict {
  taskId: string
  verdict: 'verified' | 'needs_work'
  confidence: number
  note: string
}

const SYSTEM = `You decide whether submitted work meets what a task said it would do.

You are given, for each task: what the student said "done" would mean, and the evidence collected from their repository while the task was open — commit messages, the files they changed, whether CI passed, whether anything was merged or reviewed.

Judge the task against ITS OWN acceptance criteria and nothing else. Not against how you would have built it, not against whether the code is good, not against whether the criteria were ambitious enough. A modest task done exactly as described is verified.

A commit is not proof that something works. Changed file paths tell you what area was touched, not whether the behaviour exists. Weigh evidence accordingly: passing CI on changed test files is strong, a commit message claiming a feature is weak on its own.

Set verdict to "needs_work" when the evidence does not support the criteria having been met — files changed in an unrelated area, criteria describing three things where only one was touched, CI failing on the code in question. Say specifically what is missing. "Needs work" is not a criticism; it is a request for the one thing that would settle it.

confidence is how strongly the evidence supports your verdict, from 0 to 1. Use the whole range. A task whose criteria are vague, or whose evidence is a single commit with no tests and no CI, should not score above 0.6 in either direction — that is honest uncertainty, not a hedge.

note is one or two sentences a student will read. Plain, specific, no preamble. Name the file or the criterion you are reasoning about. Never invent a file, a test or a commit that is not in the evidence you were given.

Where acceptance criteria are missing or say nothing checkable, say so in the note and keep confidence low rather than guessing at what the task probably meant.`

const SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          verdict: { type: 'string', enum: ['verified', 'needs_work'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          note: { type: 'string' },
        },
        required: ['task_id', 'verdict', 'confidence', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
} as const

interface AgentResponse {
  verdicts: { task_id: string; verdict: string; confidence: number; note: string }[]
}

function describe(task: VerifierTask, index: number): string {
  const c = task.caseFile
  const lines = [
    `--- Task ${index + 1} (id: ${task.taskId}) ---`,
    untrusted('Title', task.title),
    untrusted('Done means', task.acceptanceCriteria ?? 'The student did not write acceptance criteria.'),
    `Commits: ${c.commitCount}`,
    `CI: ${c.ciConclusion ?? 'no CI ran'}`,
    `Merged pull requests: ${c.mergedPullRequests}. Reviews: ${c.reviewsReceived}.`,
  ]
  if (c.paths.length > 0) lines.push(untrustedList('Files changed', c.paths))
  if (c.commitMessages.length > 0) lines.push(untrustedList('Commit messages', c.commitMessages))
  return lines.join('\n')
}

/**
 * One call for the whole batch.
 *
 * Returns null when the agent is unavailable or the response is unusable, so
 * the caller leaves the run pending rather than writing a verdict it did not
 * get. A verdict is the one thing here that must never be guessed.
 */
export async function verifyBatch(
  supabase: SupabaseClient,
  studentId: string,
  projectTitle: string,
  tasks: VerifierTask[],
): Promise<VerifierVerdict[] | null> {
  if (tasks.length === 0) return []

  const userContent = [
    untrusted('Project', projectTitle),
    `There are ${tasks.length} submitted task${tasks.length === 1 ? '' : 's'} to judge. Return one verdict for each, using the id given.`,
    ...tasks.map(describe),
  ].join('\n\n')

  const response = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'verification',
    system: SYSTEM,
    userContent,
    schema: SCHEMA,
    inputForAudit: {
      project: projectTitle,
      task_count: tasks.length,
      task_ids: tasks.map((t) => t.taskId),
    },
    studentId,
  })

  if (!response || !Array.isArray(response.verdicts)) return null

  // Matched back by id rather than by position. A model that returns the
  // verdicts in a different order, or drops one, would otherwise assign
  // somebody else's judgement to a task — which is the worst failure this
  // code has available to it.
  const wanted = new Set(tasks.map((t) => t.taskId))
  const out: VerifierVerdict[] = []
  const seen = new Set<string>()

  for (const raw of response.verdicts) {
    const taskId = typeof raw.task_id === 'string' ? raw.task_id : ''
    if (!wanted.has(taskId) || seen.has(taskId)) continue
    seen.add(taskId)

    const confidence = Number(raw.confidence)
    out.push({
      taskId,
      verdict: raw.verdict === 'verified' ? 'verified' : 'needs_work',
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
      note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 1000) : '',
    })
  }

  return out
}
