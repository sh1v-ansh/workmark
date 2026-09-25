// Rate limiting for agent calls.
//
// Counts rows in agent_calls rather than keeping a counter. Two reasons:
// an in-memory limiter is useless on serverless (every cold start gets a
// fresh empty map, so the limit is per-instance rather than per-user),
// and the audit table is already the durable record of exactly the thing
// being limited — a separate counter would be a second source of truth
// that could disagree with it.
//
// The cost being protected is real money on an external API, so the
// failure mode matters: an unavailable check FAILS CLOSED. A rate
// limiter that silently stops limiting when the database hiccups is a
// rate limiter that isn't one.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType } from './client'
import { checkBudget, isUnlimited } from './budget'

export interface RateLimit {
  /** Calls allowed in the window. */
  max: number
  windowHours: number
}

// Unvalidated starting points, like every other constant in this
// codebase. Sized so a student iterating on a listing or briefs never
// notices them, while a script hammering the endpoint does within a
// minute.
export const AGENT_LIMITS: Record<AgentType, RateLimit> = {
  // Sized with the monthly budgets in budget.ts: $10 a month across the app
  // and $0.50 a person. These stop a burst; the budgets stop a bill.
  posting: { max: 10, windowHours: 24 },
  // Project ideas: three a day.
  brief: { max: 3, windowHours: 24 },
  goals: { max: 5, windowHours: 24 },
  // Staff-only and batched — twenty names per call, and the queue rarely
  // holds more than a few dozen. Generous because the person hitting it is
  // an admin clearing a backlog, not a user in a loop.
  taxonomy: { max: 40, windowHours: 1 },
  // Closing out an engagement is rare and the notes are short, but people
  // do regenerate a couple of times to get the wording right.
  work_summary: { max: 5, windowHours: 24 },
  // One per sprint per project, and a sprint is a week. Four a day is a
  // student closing out several projects on the same evening, which happens
  // at the end of a term; anything beyond that is a loop.
  retro: { max: 3, windowHours: 24 },
  // Once at the start of a week, and people do re-check after moving cards
  // around. Six a day covers somebody planning three projects and changing
  // their mind twice.
  kickoff: { max: 3, windowHours: 24 },
  // The only conversational call here, and the only one somebody can hold a
  // back-and-forth with. Thirty a day is a student stuck on three different
  // things and working through each; beyond that they are using it as a
  // compiler, which the prompt refuses to be anyway.
  helper: { max: 15, windowHours: 24 },
  // A project gets planned once, then topped up occasionally as it grows.
  // Six a day covers a student with three projects who redrafts one of them,
  // and stops a loop that would draft eight tasks a second.
  planner: { max: 3, windowHours: 24 },
  // A batch, not a task — one run covers everything submitted since the last
  // one. Twelve a day is a student checking their work after each sitting
  // and still leaves the nightly sweep room.
  verification: { max: 8, windowHours: 24 },
}

export interface RateLimitResult {
  allowed: boolean
  used: number
  max: number
  /** Human-readable reason, ready to return to the caller. */
  message?: string
}

export async function checkAgentRateLimit(
  supabase: SupabaseClient,
  agentType: AgentType,
  userId: string,
  /** Which column identifies this user for this agent type. */
  userColumn: 'student_id' | 'poster_id',
): Promise<RateLimitResult> {
  const limit = AGENT_LIMITS[agentType]
  if (await isUnlimited(supabase, userId)) return { allowed: true, used: 0, max: limit.max }
  const since = new Date(Date.now() - limit.windowHours * 60 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('agent_calls')
    .select('id', { count: 'exact', head: true })
    .eq('agent_type', agentType)
    .eq(userColumn, userId)
    .gte('created_at', since)

  if (error) {
    // Fail closed — see the note at the top of this file.
    console.error('[rate-limit] check failed, denying:', error)
    return {
      allowed: false,
      used: 0,
      max: limit.max,
      message: 'Could not verify your usage limit right now. Try again in a moment.',
    }
  }

  const used = count ?? 0
  if (used >= limit.max) {
    return {
      allowed: false,
      used,
      max: limit.max,
      message: limit.windowHours === 1
        ? `You've used all ${limit.max} of these this hour. Try again shortly.`
        : `You've used all ${limit.max} of these today. Try again tomorrow.`,
    }
  }

  // The monthly allowance, checked here too so the route can say so in
  // words instead of failing later with a generic error.
  const budget = await checkBudget(supabase, {
    agentType,
    studentId: userColumn === 'student_id' ? userId : null,
    posterId: userColumn === 'poster_id' ? userId : null,
  })
  if (!budget.allowed) return { allowed: false, used, max: limit.max, message: budget.message }

  return { allowed: true, used, max: limit.max }
}
