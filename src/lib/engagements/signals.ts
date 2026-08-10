// Platform-observed signals (§5, §14) — the free data source.
//
// Nobody fills in a form for any of this. It's what the system already
// saw: how long the work took, how much back-and-forth there was, whether
// it finished, whether the same poster came back for the same student.
//
// The urgency isn't that anything consumes it today. It's that NONE OF IT
// IS RECONSTRUCTIBLE LATER. An engagement that closes before this is
// wired up is permanently unmeasured, and this is the input to the §17
// falsification test — the one that tells you whether accumulated
// evidence actually predicts satisfaction better than a resume.
//
// repeat_hire is deliberately absent here: a database trigger
// (sync_repeat_hire) already sets it when the engagement row is created,
// which is the only moment the "has this pair worked together before"
// question has a clean answer. Writing it again from here would race
// with the trigger and could only make it wrong.
//
// Requires a service-role client — platform_signals has no user write
// policy, and shouldn't: these are observations about a student, not
// statements by one.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface EngagementForSignals {
  id: string
  application_id: string
  listing_id: string
  opened_at: string | null
  submitted_at: string | null
  closed_at: string | null
  abandoned_at: string | null
  description_agreed_by_student_at: string | null
  description_agreed_by_poster_at: string | null
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Parses a free-text duration into days. Deliberately conservative: it
 * recognizes the shapes posters actually type and returns null for
 * anything else rather than guessing. A wrong on_time is worse than a
 * null one — null is honestly "we don't know", whereas a bad guess ends
 * up on a student's record as a fact.
 */
export function parseDurationDays(duration: string | null): number | null {
  if (!duration) return null
  const m = duration.trim().toLowerCase().match(/^(?:about |~|approx\.? )?(\d+)\s*(day|week|month)s?$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return m[2] === 'day' ? n : m[2] === 'week' ? n * 7 : n * 30
}

/**
 * Writes (or refreshes) the platform_signals row for one engagement.
 * Idempotent — safe to call on submit, on close, and on abandon, since
 * each pass simply recomputes from current state.
 */
export async function recordPlatformSignals(
  supabase: SupabaseClient,
  engagement: EngagementForSignals,
): Promise<void> {
  const [{ data: listing }, { count: messageCount }, { data: evidenceRows }] = await Promise.all([
    supabase.from('listings').select('est_hours, duration').eq('id', engagement.listing_id).maybeSingle(),
    supabase
      .from('application_messages')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', engagement.application_id),
    // disputes link to evidence, not to engagements — so "was this
    // engagement disputed" means "was any evidence it produced disputed".
    supabase.from('skill_evidence').select('id').eq('engagement_id', engagement.id),
  ])

  let disputeCount = 0
  const evidenceIds = (evidenceRows ?? []).map((r) => r.id)
  if (evidenceIds.length > 0) {
    const { count } = await supabase
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .in('evidence_id', evidenceIds)
    disputeCount = count ?? 0
  }

  // Submitted, or abandoned without ever submitting — either way, how long
  // the work was actually open.
  const endpoint = engagement.submitted_at ?? engagement.abandoned_at
  const daysToSubmit = daysBetween(engagement.opened_at, endpoint)

  // on_time only when there's a stated duration to be on time against.
  // Most listings won't have a parseable one, and null is the honest
  // answer there.
  const expectedDays = parseDurationDays(listing?.duration ?? null)
  const onTime =
    daysToSubmit != null && expectedDays != null && engagement.submitted_at
      ? daysToSubmit <= expectedDays
      : null

  // Each cleared agreement is a round of renegotiation on what the work
  // actually was — the closest observable proxy for scope drift, since
  // editing the description resets both sides' agreement.
  const scopeChanges = [
    engagement.description_agreed_by_student_at,
    engagement.description_agreed_by_poster_at,
  ].filter((v) => v === null).length

  const { error } = await supabase.from('platform_signals').upsert(
    {
      engagement_id: engagement.id,
      days_to_submit: daysToSubmit,
      est_hours: listing?.est_hours ?? null,
      on_time: onTime,
      scope_changes: scopeChanges,
      message_volume: messageCount ?? 0,
      dispute_flag: disputeCount > 0,
      computed_at: new Date().toISOString(),
    },
    // repeat_hire is intentionally omitted so the trigger's value survives.
    { onConflict: 'engagement_id' },
  )
  if (error) throw error
}
