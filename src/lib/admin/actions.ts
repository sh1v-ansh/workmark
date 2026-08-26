// What a staff member can actually do to a queue item.
//
// Every function here is called only from the admin API route, which checks
// the role first and records the action afterwards. They take a service-role
// client because most of these write tables that deliberately have no user
// insert policy — evidence, aliases, artifacts.
//
// The review-request logic is ported from scripts/review-queue.mjs rather
// than rewritten. That script already gets the important part right: an
// approval writes an artifact with verification_method 'human_review' and
// does NOT write skill evidence, because a reviewer confirms the work is
// real and the student's — not which skills it demonstrates at what level.
// Skill attribution stays with the scanner.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ActionResult {
  ok: boolean
  message: string
}

// ─── Work submitted for review ───────────────────────────────────────────────

export async function resolveReviewRequest(
  admin: SupabaseClient,
  args: { id: string; approve: boolean; note: string | null },
): Promise<ActionResult> {
  const { data: req } = await admin
    .from('review_requests')
    .select('id, student_id, url, status')
    .eq('id', args.id)
    .maybeSingle()

  if (!req) return { ok: false, message: 'That request no longer exists.' }
  // Two reviewers opening the queue at once is normal; the second one
  // should be told, not silently overwrite the first.
  if (req.status !== 'pending') return { ok: false, message: `Already ${req.status}.` }

  let artifactId: string | null = null
  if (args.approve) {
    const { data: artifact, error } = await admin
      .from('artifacts')
      .insert({
        student_id: req.student_id,
        type: 'url',
        source: 'human_review',
        tier: 'tier_0',
        verification_method: 'human_review',
        deployment_url: req.url,
        verified_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) return { ok: false, message: 'Could not record the artifact.' }
    artifactId = artifact.id
  }

  const { error } = await admin
    .from('review_requests')
    .update({
      status: args.approve ? 'approved' : 'rejected',
      artifact_id: artifactId,
      reviewed_at: new Date().toISOString(),
      review_note: args.note,
    })
    .eq('id', args.id)
    .eq('status', 'pending') // lost race → zero rows, and the read above already reported it

  if (error) return { ok: false, message: 'Could not save the decision.' }
  return {
    ok: true,
    message: args.approve ? 'Approved — the work is on their record.' : 'Rejected.',
  }
}

// ─── Disputes ────────────────────────────────────────────────────────────────

export type DisputeResolution = 'resolved_corrected' | 'resolved_verified' | 'resolved_retracted'

/**
 * Close a dispute a person had to look at.
 *
 * Retracting marks the evidence retracted rather than deleting it — evidence
 * is append-only, and a file disclosure is supposed to show what the record
 * used to say. Deleting the row would erase the very history the student
 * disputed.
 *
 * Correcting deliberately does NOT write a new level here. Recomputing a
 * level is the reinvestigation path's job and it has to run the same
 * arithmetic the scan does; letting a reviewer type a number would put a
 * hand-entered figure into a record that's meant to be derived.
 */
export async function resolveDispute(
  admin: SupabaseClient,
  args: { id: string; resolution: DisputeResolution; note: string },
): Promise<ActionResult> {
  const { data: dispute } = await admin
    .from('disputes')
    .select('id, evidence_id, status')
    .eq('id', args.id)
    .maybeSingle()

  if (!dispute) return { ok: false, message: 'That dispute no longer exists.' }
  if (dispute.status.startsWith('resolved')) {
    return { ok: false, message: 'Already resolved.' }
  }

  if (args.resolution === 'resolved_retracted' && dispute.evidence_id) {
    const { error } = await admin
      .from('skill_evidence')
      .update({ retracted_at: new Date().toISOString() })
      .eq('id', dispute.evidence_id)
    if (error) return { ok: false, message: 'Could not retract the evidence.' }
  }

  const { error } = await admin
    .from('disputes')
    .update({
      status: args.resolution,
      resolution_note: args.note,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', args.id)

  if (error) return { ok: false, message: 'Could not save the resolution.' }
  return { ok: true, message: 'Dispute closed. The student can see the outcome in their file.' }
}

// ─── Skills that didn't match ────────────────────────────────────────────────

/**
 * Map an unmatched name to a taxonomy skill, or rule it out.
 *
 * Mapping writes a permanent alias, so the next scan that sees this string
 * resolves it instantly and never asks again. That's the compounding part:
 * every resolution makes the matcher better for everyone afterwards.
 *
 * It deliberately does not backfill evidence for students already scanned.
 * Their next scan picks it up through the ordinary path, and rewriting
 * historical evidence from an admin action is exactly the kind of silent
 * change to someone's record that the dispute process exists to prevent.
 */
export async function resolveUnresolvedSkill(
  admin: SupabaseClient,
  args: { id: string; adminId: string; mapToSkillId: string | null },
): Promise<ActionResult> {
  const { data: row } = await admin
    .from('unresolved_skills')
    .select('id, raw_string, status')
    .eq('id', args.id)
    .maybeSingle()

  if (!row) return { ok: false, message: 'That entry no longer exists.' }
  if (row.status !== 'pending') return { ok: false, message: 'Already handled.' }

  if (args.mapToSkillId) {
    const { error: aliasErr } = await admin
      .from('skill_aliases')
      .upsert(
        { raw_string: row.raw_string, skill_id: args.mapToSkillId },
        { onConflict: 'raw_string', ignoreDuplicates: true },
      )
    if (aliasErr) return { ok: false, message: 'Could not save the mapping.' }
  }

  const { error } = await admin
    .from('unresolved_skills')
    .update({
      status: args.mapToSkillId ? 'mapped' : 'not_a_skill',
      mapped_skill_id: args.mapToSkillId,
      resolved_by: args.adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', args.id)

  if (error) return { ok: false, message: 'Could not save.' }
  return {
    ok: true,
    message: args.mapToSkillId
      ? `Mapped. Future scans will resolve "${row.raw_string}" without asking.`
      : 'Marked as not a skill.',
  }
}

// ─── Failed scans ────────────────────────────────────────────────────────────

/**
 * Put a failed job back in the queue.
 *
 * Steps that already succeeded stay done — the runner skips anything not
 * pending — so a retry resumes rather than rescanning from scratch. attempts
 * is reset because the cap exists to stop a wedged job spinning forever, and
 * a person deciding to retry is a different situation from a loop.
 */
export async function retryJob(
  admin: SupabaseClient,
  args: { id: string },
): Promise<ActionResult> {
  const { data: job } = await admin
    .from('jobs')
    .select('id, status')
    .eq('id', args.id)
    .maybeSingle()

  if (!job) return { ok: false, message: 'That job no longer exists.' }
  if (job.status !== 'failed') return { ok: false, message: `Job is ${job.status}, not failed.` }

  const { error } = await admin
    .from('jobs')
    .update({
      status: 'queued',
      error: null,
      attempts: 0,
      locked_at: null,
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.id)

  if (error) return { ok: false, message: 'Could not requeue.' }
  return { ok: true, message: 'Requeued — it picks up where it stopped.' }
}

// ─── Faculty ─────────────────────────────────────────────────────────────────

/**
 * Confirm someone really is faculty.
 *
 * Verification gates the *weight* their attestations will carry, not access
 * to the account — an unverified faculty account already works. That's what
 * makes claiming it falsely pointless, and it's why nobody is blocked while
 * this sits in the queue.
 */
export async function verifyFaculty(
  admin: SupabaseClient,
  args: { accountId: string; adminId: string; approve: boolean },
): Promise<ActionResult> {
  if (!args.approve) {
    // Not faculty: drop the role rather than leaving it unverified forever,
    // so the queue doesn't accumulate items nobody will ever action.
    const { error } = await admin
      .from('accounts')
      .update({ roles: ['student'], updated_at: new Date().toISOString() })
      .eq('id', args.accountId)
    if (error) return { ok: false, message: 'Could not update the account.' }
    return { ok: true, message: 'Faculty claim declined — account is a student account.' }
  }

  const { error } = await admin
    .from('accounts')
    .update({
      faculty_verified_at: new Date().toISOString(),
      faculty_verified_by: args.adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.accountId)

  if (error) return { ok: false, message: 'Could not verify.' }
  return { ok: true, message: 'Verified. Their attestations now carry faculty weight.' }
}
