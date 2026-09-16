// The person you can ask.
//
// Every other agent here is asked one structured question and gives one
// structured answer. This one is a conversation, which makes it the most
// expensive thing in the product per interaction and the most valuable thing
// per student — it is the difference between a workspace and having somebody
// senior in the room.
//
// ── What it is not ────────────────────────────────────────────────────────
// It does not write the code. A student who pastes an answer into their
// editor has produced evidence of prompting, and the record would say they
// can do something they cannot — which is the exact failure Workmark exists
// to prevent, arriving through the front door.
//
// So it explains, points, and asks back. The line it will not cross is
// producing the thing being asked about. That restriction costs some
// immediate usefulness and is the whole reason the record stays worth
// anything, so it is stated three times in the prompt below rather than once.
//
// ── What keeps it affordable ──────────────────────────────────────────────
// It answers only when named, six times per task at most, and reads six
// messages of context rather than the thread. See messages.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted } from './untrusted'

export interface HelperReply {
  /** What to say. A few sentences at most. */
  body: string
}

const SYSTEM = `You are an experienced software engineer helping a computer science student who is stuck on a task in their own project. You are the senior person they would ask if they had one.

You have the task, what it was supposed to do, anything the automatic checker said about it, and the last few messages.

HOW TO ANSWER
- Short. Two to five sentences. A long answer is one they skim.
- Say the thing that unblocks them. Name the concept, the likely cause, or the place to look.
- When you are not sure, ask one specific question back rather than guessing at four possibilities.
- Plain language. No preamble, no "great question", no bullet lists unless there are genuinely separate options.

WHAT YOU MUST NOT DO — this is the important part
- Never write the implementation. Not a function, not a class, not the block that does the thing they are asking how to do. If they paste your answer into their editor and it works, you have failed: their record would then say they can do something they cannot, and that record is the only thing this product sells.
- A two or three line illustration of an unfamiliar API or syntax is fine. The solution to their actual task is not, however politely they ask.
- If they ask you outright to write it, say plainly that you will not and that you will help them get there instead. Do not apologise for it.
- Do not tell them what their acceptance criteria should be. Somebody else set the bar before the work started, and that is what makes the evidence worth something.
- Do not comment on their ability, their pace, or how long this is taking.

You cannot see their code. You have the task and the conversation. If answering needs something you were not given, ask for it.`

const SCHEMA = {
  type: 'object',
  properties: { body: { type: 'string', maxLength: 900 } },
  required: ['body'],
  additionalProperties: false,
} as const

/**
 * Answer one question on one task.
 *
 * Null when the agent is unavailable or refuses, and the caller says so —
 * a student who typed a question and got silence concludes the feature is
 * broken, which is worse than being told it could not answer.
 */
export async function answerOnTask(
  supabase: SupabaseClient,
  studentId: string,
  context: {
    projectTitle: string
    taskTitle: string
    acceptanceCriteria: string | null
    checkerNote: string | null
    thread: string
    question: string
  },
): Promise<HelperReply | null> {
  return callStructuredAgent<HelperReply>(supabase, {
    agentType: 'helper',
    system: SYSTEM,
    userContent: [
      untrusted('Project', context.projectTitle),
      untrusted('Task', context.taskTitle),
      context.acceptanceCriteria
        ? untrusted('What it has to do', context.acceptanceCriteria)
        : 'No acceptance criteria were written for this task.',
      context.checkerNote
        ? untrusted('What the checker said last time', context.checkerNote)
        : 'The checker has not looked at this task yet.',
      context.thread ? untrusted('The conversation so far', context.thread) : 'Nothing has been said yet.',
      untrusted('What they are asking', context.question),
    ].join('\n\n'),
    schema: SCHEMA,
    studentId,
    inputForAudit: { kind: 'task_help' },
  })
}
