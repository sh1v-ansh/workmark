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

import { LEAD_VOICE } from '@/lib/agents/lead'
import type { SupabaseClient } from '@supabase/supabase-js'
import { streamTextAgent } from './client'
import { untrusted } from './untrusted'
import { SCOPE_RULE } from './scope'

export interface HelperReply {
  /** What to say. A few sentences at most. */
  body: string
  /**
   * Work the answer implies, when it implies any.
   *
   * The case this exists for: a student asks why something fails, and the
   * honest answer is "you also have to set that up locally" — which is a real
   * piece of work nobody has written down. Before this it lived in a chat
   * message and was forgotten, and the board quietly stopped describing the
   * project.
   *
   * It costs nothing: the same call, a slightly longer response. And it only
   * offers — the student presses the button, exactly as they would decide for
   * themselves on a real job.
   */
  suggestedSubtask?: { title: string; why: string } | null
}

const SYSTEM = `${LEAD_VOICE}

You are an experienced software engineer helping a computer science student who is stuck on a task in their own project. You are the senior person they would ask if they had one.

You have the task, what it was supposed to do, anything the automatic checker said about it, and the last few messages.

HOW TO ANSWER
- Short. Three sentences at most, and often one. A long answer is one they skim, which means the useful sentence in it goes unread — brevity here is not politeness, it is whether the answer works.
- Lead with the answer. No restating the question, no "great question", no summary of what they already told you.
- Say the thing that unblocks them. Name the concept, the likely cause, or the place to look.
- When you are not sure, ask one specific question back rather than guessing at four possibilities.
- Plain language. No preamble, no "great question", no bullet lists unless there are genuinely separate options.

WHAT YOU MUST NOT DO — this is the important part
- Never write the implementation. Not a function, not a class, not the block that does the thing they are asking how to do. If they paste your answer into their editor and it works, you have failed: their record would then say they can do something they cannot, and that record is the only thing this product sells.
- A two or three line illustration of an unfamiliar API or syntax is fine. The solution to their actual task is not, however politely they ask.
- If they ask you outright to write it, say plainly that you will not and that you will help them get there instead. Do not apologise for it.
- Do not tell them what their acceptance criteria should be. Somebody else set the bar before the work started, and that is what makes the evidence worth something.
- Do not comment on their ability, their pace, or how long this is taking.

WHEN YOUR ANSWER IMPLIES WORK
Sometimes the honest answer is that something else has to happen first — a setting to configure, a dependency to install, a piece nobody wrote down. When that is true, end your reply with one final line, exactly in this form and nothing after it:
SUBTASK: <short title> | <one line on why>
Leave that line out otherwise.

Only for real, separable work. Not "read the docs", not "try again", and never a restatement of the task they are already on. If you are not sure it deserves its own card, it does not.

You cannot see their code. You have the task and the conversation. If answering needs something you were not given, ask for it.

${SCOPE_RULE}`

/** Split the streamed reply into what is said and the optional subtask line. */
export function splitHelperReply(text: string): HelperReply {
  const at = text.search(/\n?\s*SUBTASK:/)
  if (at < 0) return { body: text.trim().slice(0, 1200), suggestedSubtask: null }
  const line = text.slice(at).replace(/^\s*SUBTASK:\s*/, '').trim()
  const [title, why] = line.split('|').map((p) => p.trim())
  return {
    body: text.slice(0, at).trim().slice(0, 1200),
    suggestedSubtask: title ? { title: title.slice(0, 200), why: (why ?? '').slice(0, 200) } : null,
  }
}

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
  onText?: (delta: string) => void,
): Promise<HelperReply | null> {
  const result = await streamTextAgent(supabase, {
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
    studentId,
    inputForAudit: { kind: 'task_help' },
    onText,
    maxTokens: 800,
  })
  return result ? splitHelperReply(result.text) : null
}
