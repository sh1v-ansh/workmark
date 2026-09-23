// Checking a week is worth a week, before it starts.
//
// ── The question this used to ask, and why it was wrong ───────────────────
// It asked whether the week was achievable — "that is three weeks of work" —
// which assumes throughput this product's users do not have. A student with a
// model open beside them can finish a week's plan in two days. Asking whether
// they can fit it in is a question with a boring answer, and answering "yes"
// to a week of trivial work is worse than useless: it confirms a plan that
// will put nothing on their record.
//
// So the question is whether the week is worth doing. Three things decide it:
// is any of this hard enough to be worth having done, is it aimed at one thing
// or scattered across eight, and have they noticed which part is actually
// difficult. Capacity is now one input rather than the verdict.
//
// ── Why this is worth a call ──────────────────────────────────────────────
// The hard-part question is judgement and nothing else here can do it. The
// estimate bias still goes in — somebody predictably 40% optimistic is worth
// telling, because nobody has ever measured that about them — but as context
// for the answer rather than as the answer.
//
// One call per week per project, and only when asked.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted } from './untrusted'

export interface ScopeCheck {
  /**
   * Whether the week is worth doing, not whether it fits.
   *
   * `light` is the common one and the reason this was rebuilt: a week of
   * small, safe tasks passes every capacity check and produces nothing worth
   * showing anybody.
   */
  verdict: 'worth_it' | 'light' | 'scattered'
  /** Two sentences, addressed to the student. */
  reasoning: string
  /** One concrete change, or what to keep if the week is already good. */
  suggestion: string
}

const SYSTEM = `You are an experienced engineer sitting down with a computer science student at the start of a week, looking at what they have just committed to.

The question is NOT whether they can fit it in. Assume they can build fast — they have a language model open beside them and can produce a week of ordinary code in a couple of days. The question is whether this week is worth a week: whether anything in it is hard enough to be worth having done, whether it is aimed at one thing or scattered across eight, and whether they have noticed which part is actually difficult.

Give three things.

VERDICT — one of:
- worth_it: there is something genuinely hard here and the week is pointed at it.
- light: they will finish this in two days and have little to show. The most common answer, and the one worth saying plainly.
- scattered: enough work, but spread across unrelated things, so the week adds up to less than its parts.

REASONING — two sentences, addressed to them as "you". Name the hard part if there is one, or say plainly that there is not. Where a measured estimate bias is given, use it as context rather than as the point: "your estimates run about a third under" explains why twelve planned hours is not the ceiling it looks like.

SUGGESTION — one concrete change. Usually: what to add, what to make harder, or which thing to cut so the rest connects. If the week is already good, say what makes it good so they do it again.

How to write it:
- Plainly, the way a senior colleague talks. Short sentences.
- Specific to these tasks. Name them.
- Never praise or scold. This is a planning conversation, not a performance review.

Never do these:
- Do not tell them the week is too much because the hours look high. Hours are the weakest signal here.
- Do not invent a bias, a velocity or a history you were not given.
- Do not suggest dropping the hardest task. Difficulty is where the record is earned, and a week of easy work is worth less to them than a hard week that slips.
- Do not pad. Two sentences and one change.`

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['worth_it', 'light', 'scattered'] },
    reasoning: { type: 'string', maxLength: 340 },
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
  // where the model reads it as an instruction.
  const known: ScopeCheck['verdict'][] = ['worth_it', 'light', 'scattered']
  if (!known.includes(reply.verdict)) {
    console.error(`[agents] kickoff returned an unknown verdict: ${String(reply.verdict)}`)
    // Falls to `light` rather than `worth_it`, for the same reason as before:
    // telling somebody an empty week is fine is the direction this must not
    // fail in.
    return { ...reply, verdict: 'light' }
  }

  return reply
}
