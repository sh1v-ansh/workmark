// The review at the end of a week.
//
// This is where the PM half of the guided project lives. Everything else on
// the board measures; this is the one moment that says something back, and it
// is the only part of Workmark whose output is advice rather than a record.
//
// ── What makes this worth a model call ────────────────────────────────────
// The figures are arithmetic and could be printed without any of this. What
// cannot be printed is the reading: four tasks committed and two finished is
// a bad week if the estimates were fine and a normal one if the student hit
// something nobody could have predicted and said so at the time. The reasons
// in task_revisions are what separate those, and a human PM reading them is
// exactly the job being done here.
//
// One call per sprint per project — eight over a four-week guided project,
// counting kickoffs. That is the whole budget for the PM persona.
//
// ── Why it does not grade ─────────────────────────────────────────────────
// A retro that scores the week would be read as a mark, and a student who
// reads a mark optimises for it: they would stop committing to anything hard
// and stop setting work aside honestly, which are the two behaviours this
// board exists to make safe. It describes and it suggests one thing. The
// measurement lives in workspace_metrics, where it is not addressed to them.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgentLogged } from './client'
import { untrusted } from './untrusted'

export interface Retro {
  /** What happened, two or three sentences, addressed to the student. */
  summary: string
  /** The one thing worth changing next week. Never more than one. */
  suggestion: string
}

const SYSTEM = `You are an experienced engineering manager reviewing one week of work with a computer science student on a project they are doing to build up a verifiable record of their skills.

You are given what they committed to, what they finished, what they set aside, and the reasons they gave when an estimate or deadline moved.

Write two things.

SUMMARY — two or three sentences saying what actually happened this week, addressed to the student as "you". Lead with the most informative fact, which is usually not the count. If estimates moved and they said why at the time, that is the story: it means they saw the problem coming and renegotiated, which is what a good engineer does and is more interesting than whether the number was hit. If work was set aside with a clear finding, treat that as a result — the week produced knowledge.

SUGGESTION — exactly one thing to do differently next week. Concrete and small enough to act on. If the week went well, say what to keep doing rather than inventing a fault.

How to write it:
- Plainly, the way a senior colleague talks in a one-to-one. Short sentences.
- Specific to this week's facts. Never generic advice about planning or communication.
- No score, no grade, no percentage as a verdict, and no praise adjectives. "You finished three of five" is a fact; "great progress" is noise.

Never do these:
- Do not treat set-aside work as failure. A student who found out an approach does not work has produced a result, and a review that punishes it teaches them to hide it next time.
- Do not invent a cause. If an estimate moved and no reason was given, say the reason is missing and make that the suggestion — do not guess why.
- Do not comment on anything not in the facts you were given. You cannot see the code, the repository or the student's calendar.
- Do not tell them to work harder or longer. That is never the actionable answer and it is not yours to say.`

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 600 },
    suggestion: { type: 'string', maxLength: 300 },
  },
  required: ['summary', 'suggestion'],
  additionalProperties: false,
} as const

/**
 * Review one sprint.
 *
 * Returns null when the agent is unavailable or refuses, and the caller
 * closes the sprint anyway. A retro is the valuable half of this feature but
 * it is not the load-bearing half: a sprint that closed without one is a
 * sprint with a gap in it, whereas a sprint that would not close because a
 * model call failed is a board somebody cannot move past.
 */
export async function reviewSprint(
  supabase: SupabaseClient,
  studentId: string,
  facts: string,
): Promise<{ value: Retro; callId: string | null } | null> {
  const response = await callStructuredAgentLogged<Retro>(supabase, {
    agentType: 'retro',
    system: SYSTEM,
    userContent: untrusted('What happened this week', facts),
    schema: SCHEMA,
    studentId,
    inputForAudit: { kind: 'sprint_retro' },
  })

  if (!response) return null
  return { value: response.value, callId: response.callId }
}
