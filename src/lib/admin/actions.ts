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
import { embedText } from '@/lib/embeddings/voyage'

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
      .upsert({
        raw_string: row.raw_string,
        skill_id: args.mapToSkillId,
      }, { onConflict: 'raw_string', ignoreDuplicates: true })
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
 * Decide whether someone really is faculty.
 *
 * The account already works — this doesn't open it. What it changes is what
 * everyone sees: until it runs, the claim is displayed as pending, to the
 * professor and to any student looking at their projects. Confirming it is
 * what turns "says they teach" into "we checked".
 *
 * Declining does not convert them into a student. They asked to be faculty
 * and were told no; quietly making them something else would give them an
 * account they never asked for, with a student record and a place in the
 * matching pool. They keep the login and nothing else.
 */
export async function verifyFaculty(
  admin: SupabaseClient,
  args: { accountId: string; adminId: string; approve: boolean },
): Promise<ActionResult> {
  const now = new Date().toISOString()

  if (!args.approve) {
    const { error } = await admin
      .from('accounts')
      .update({ status: 'declined', updated_at: now })
      .eq('id', args.accountId)
    if (error) return { ok: false, message: 'Could not update the account.' }
    return { ok: true, message: 'Declined. The account is closed and they are not made a student.' }
  }

  const { error } = await admin
    .from('accounts')
    .update({
      faculty_verified_at: now,
      faculty_verified_by: args.adminId,
      updated_at: now,
    })
    .eq('id', args.accountId)

  if (error) return { ok: false, message: 'Could not confirm.' }
  return { ok: true, message: 'Confirmed. Their projects now show as verified faculty.' }
}

// ─── Creating a taxonomy node ────────────────────────────────────────────────

/**
 * Add a skill the taxonomy doesn't have, and alias the name onto it.
 *
 * The embedding matters more than it looks: without one the node is invisible
 * to similarity matching forever, so every future spelling of it would come
 * back to this queue. Generating it here is what makes the fix permanent
 * rather than a fix for one exact string.
 *
 * Deliberately gated on a person clicking. Free node creation is how a
 * taxonomy rots — the same skill splits across three near-duplicate nodes and
 * then matches none of them well. Aliasing to something that exists is almost
 * always the better answer, and the UI says so.
 */
export async function createSkillNode(
  admin: SupabaseClient,
  args: {
    unresolvedId: string
    adminId: string
    skillId: string
    canonicalName: string
    parentId: string | null
  },
): Promise<ActionResult> {
  const { data: row } = await admin
    .from('unresolved_skills')
    .select('id, raw_string, status')
    .eq('id', args.unresolvedId)
    .maybeSingle()
  if (!row) return { ok: false, message: 'That entry no longer exists.' }
  if (row.status !== 'pending') return { ok: false, message: 'Already handled.' }

  const { data: existing } = await admin
    .from('skills').select('id').eq('id', args.skillId).maybeSingle()
  if (existing) {
    return { ok: false, message: `A skill with id "${args.skillId}" already exists — map to it instead.` }
  }

  let embedding: number[] | null = null
  try {
    embedding = await embedText(args.canonicalName)
  } catch (err) {
    console.error('[admin/actions] embedding for new skill failed:', err)
    return {
      ok: false,
      message: 'Could not generate the skill\'s embedding, so it would be invisible to matching. Nothing was created — try again.',
    }
  }

  const { error: skillErr } = await admin.from('skills').insert({
    id: args.skillId,
    canonical_name: args.canonicalName,
    parent_id: args.parentId,
    embedding,
  })
  if (skillErr) {
    console.error('[admin/actions] skill insert failed:', skillErr)
    return { ok: false, message: 'Could not create the skill.' }
  }

  await admin.from('skill_aliases').upsert({
    raw_string: row.raw_string,
    skill_id: args.skillId,
  }, { onConflict: 'raw_string', ignoreDuplicates: true })

  const { error } = await admin.from('unresolved_skills').update({
    status: 'mapped',
    mapped_skill_id: args.skillId,
    resolved_by: args.adminId,
    resolved_at: new Date().toISOString(),
  }).eq('id', args.unresolvedId)
  if (error) return { ok: false, message: 'Skill created, but the queue entry could not be closed.' }

  return {
    ok: true,
    message: `Created "${args.canonicalName}". Future scans will match it directly.`,
  }
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export async function resolveFeedback(
  admin: SupabaseClient,
  args: { id: string; adminId: string; status: 'triaged' | 'done' | 'declined'; note: string | null },
): Promise<ActionResult> {
  const { error } = await admin
    .from('feedback')
    .update({
      status: args.status,
      admin_note: args.note,
      // Triage is a staging state, not a resolution — stamping it resolved
      // would make an item look finished the moment someone looked at it.
      resolved_by: args.status === 'triaged' ? null : args.adminId,
      resolved_at: args.status === 'triaged' ? null : new Date().toISOString(),
    })
    .eq('id', args.id)
  if (error) return { ok: false, message: 'Could not update.' }
  return { ok: true, message: `Marked ${args.status}.` }
}
