// Pressure-testing a week before it starts.
//
// The half of a project manager's job that a retro cannot do. A review at the
// end says what happened; this says "that is three weeks of work" while there
// is still time to do something about it.
//
// ── Why this is worth a call ──────────────────────────────────────────────
// Because of one number nobody has ever told a student about themselves.
// workspace_metrics measures estimate bias — whether they are consistently
// optimistic and by how much — and somebody who underestimates by 40% every
// week is not bad at their job, they are predictably wrong in a direction
// that can simply be multiplied out. That is a useful thing to hear and an
// impossible thing to learn on your own.
//
// One call per week per project, and only when asked.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted } from './untrusted'

export interface ScopeCheck {
  /** Whether the week looks achievable. Three states, not a score. */
  verdict: 'looks_right' | 'tight' | 'too_much'
  /** Two sentences, addressed to the student. */
  reasoning: string
  /** One concrete adjustment, or what to keep if the week is fine. */
  suggestion: string
}

const SYSTEM = `You are an experienced engineering manager sitting down with a computer science student at the start of a week, looking at what they have just committed to.

Your job is to say whether the week is achievable, before it starts, while there is still time to change it.

Give three things.

VERDICT — one of: looks_right, tight, too_much.

REASONING — two sentences, addressed to them as "you". Lead with the arithmetic where there is any. If they have a measured estimate bias, use it: "you have underestimated by about a third on past tasks, so these twelve hours have historically meant nearer sixteen" is the single most useful sentence you can say, because nobody has ever measured that about them before. If there is not enough history, say so plainly and judge on the hours and the difficulty alone.

SUGGESTION — one concrete change. Move a specific kind of task out, add an estimate to the ones missing one, or — if the week looks right — say what makes it look right so they repeat it.

How to write it:
- Plainly, the way a senior colleague talks. Short sentences.
- Arithmetic over adjectives. "Sixteen hours against your usual ten" beats "quite ambitious".
- Never praise or scold. This is a planning conversation, not a performance review.

Never do these:
- Do not invent a bias, a velocity or a history you were not given. If it says there is not enough data, there is not enough data.
- Do not tell them to work more hours. The point of the exercise is to fit the work to the week, not the week to the work.
- Do not suggest dropping the hardest task by default. Difficulty is where the record is earned, and a week of easy work is worth less to them than a hard week that slips.`

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['looks_right', 'tight', 'too_much'] },
    reasoning: { type: 'string', maxLength: 500 },
    suggestion: { type: 'string', maxLength: 300 },
  },
  required: ['verdict', 'reasoning', 'suggestion'],
  additionalProperties: false,
} as const

/**
 * Check one week's scope.
 *
 * Null when the agent is unavailable or refuses. The caller says so and the
 * week carries on: this is advice, and a board that will not let somebody
 * work because advice failed to arrive would be a worse product.
 */
export async function checkScope(
  supabase: SupabaseClient,
  studentId: string,
  facts: string,
): Promise<ScopeCheck | null> {
  const reply = await callStructuredAgent<ScopeCheck>(supabase, {
    agentType: 'kickoff',
    system: SYSTEM,
    userContent: untrusted('What they have committed to this week', facts),
    schema: SCHEMA,
    studentId,
    inputForAudit: { kind: 'sprint_kickoff' },
  })

  if (!reply) return null

  // The enum in the schema is a hint rather than a guarantee: structured
  // outputs does not enforce enum, so client.ts folds it into the description
  // where the model reads it as an instruction. Checked here because the
  // board's fallback for an unrecognised verdict is "this looks about right",
  // and telling somebody their over-stuffed week is fine is the one direction
  // this must not fail in.
  const known: ScopeCheck['verdict'][] = ['looks_right', 'tight', 'too_much']
  if (!known.includes(reply.verdict)) {
    console.error(`[agents] kickoff returned an unknown verdict: ${String(reply.verdict)}`)
    return { ...reply, verdict: 'tight' }
  }

  return reply
}
