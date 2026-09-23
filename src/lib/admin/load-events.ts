import type { SupabaseClient } from '@supabase/supabase-js'
import { FUNNEL, type FirstSeen } from './funnel'
import type { EventName } from '@/lib/analytics/events'

/**
 * Every funnel event, oldest occurrence per person.
 *
 * ── Why it reads rows rather than aggregating in SQL ──────────────────────
 * The arithmetic lives in funnel.ts where it is tested, and a funnel is the
 * number a decision to change the product gets made on. "Trust me, the GROUP
 * BY is right" is not good enough for that — particularly the cohort
 * bucketing, which is the part everyone gets wrong by a week.
 *
 * ── Why that is fine, and when it stops being fine ────────────────────────
 * One row per person per step, capped, over a window. At a few hundred
 * students that is a few thousand rows and the page is instant. It stops
 * being fine somewhere in the tens of thousands, at which point this becomes
 * a materialised view refreshed nightly and funnel.ts does not change — the
 * shape of FirstSeen is the seam.
 */
export async function loadFunnelEvents(
  admin: SupabaseClient,
  days = 90,
): Promise<FirstSeen[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data, error } = await admin
    .from('events')
    .select('student_id, session_id, name, occurred_at')
    .in('name', FUNNEL.map((f) => f.event))
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true })
    // PostgREST caps an unbounded select at 1000 rows silently, which would
    // quietly truncate a funnel rather than fail it — the most dangerous
    // shape of bug on a page whose whole job is being an accurate count. So
    // the cap is explicit and the caller is told when it was hit.
    .limit(20_000)

  if (error) {
    console.error('[admin] could not read funnel events:', error.message)
    return []
  }

  return (data ?? []).map((r) => ({
    studentId: (r.student_id as string | null) ?? null,
    sessionId: (r.session_id as string | null) ?? null,
    name: r.name as EventName,
    at: r.occurred_at as string,
  }))
}

/** True when the row cap was reached and the numbers below it are therefore short. */
export const FUNNEL_ROW_CAP = 20_000
