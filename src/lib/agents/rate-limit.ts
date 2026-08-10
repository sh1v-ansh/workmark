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
  posting: { max: 20, windowHours: 1 },
  brief: { max: 10, windowHours: 24 },
  goals: { max: 20, windowHours: 24 },
  application_scoring: { max: 50, windowHours: 1 },
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

  return { allowed: true, used, max: limit.max }
}
