// §611 reinvestigation, executed.
//
// Re-runs the exact computation that produced the disputed evidence and
// compares. Because our evidence is derived from code rather than
// reported by a third party, "reinvestigate" has an unusually literal
// meaning here: rescan the repo, recanonicalize, recompute the level,
// see whether it still holds.
//
// Whatever it concludes is written as a NEW row — a correction carrying
// the new level, or a retraction carrying retracted_at — never as an
// edit. The append-only trigger on skill_evidence enforces that at the
// database level, but the reason is the point: a dispute exists to
// produce a record, and a record you can overwrite isn't one.
//
// Requires a service-role client: writes skill_evidence, evidence_audit
// and disputes, none of which accept user writes.

import type { SupabaseClient } from '@supabase/supabase-js'
import { scanRepo } from '@/lib/github/scan'
import { extractComplexity } from '@/lib/github/complexity'
import { canonicalizeSkills } from '@/lib/skills/canonicalize'
import { applyImplications } from '@/lib/skills/implications'
import { computeDifficultyLevel } from '@/lib/skills/levels'
import { reinvestigationOutcome, type DisputeCategory, type DisputeStatus } from './disputes'

export interface ReinvestigationResult {
  status: DisputeStatus
  note: string
  correctionEvidenceId: string | null
}

export async function reinvestigate(
  supabase: SupabaseClient,
  disputeId: string,
): Promise<ReinvestigationResult> {
  const { data: dispute } = await supabase
    .from('disputes')
    .select('id, student_id, evidence_id, category, status')
    .eq('id', disputeId)
    .maybeSingle()
  if (!dispute) throw new Error('Dispute not found.')
  if (!dispute.evidence_id) throw new Error('This dispute is not attached to a specific piece of evidence.')

  await supabase.from('disputes').update({ status: 'reinvestigating' }).eq('id', disputeId)

  const finish = async (result: ReinvestigationResult) => {
    await supabase
      .from('disputes')
      .update({
        status: result.status,
        resolution_note: result.note,
        resolution_evidence_id: result.correctionEvidenceId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', disputeId)
    return result
  }

  const { data: evidence } = await supabase
    .from('skill_evidence')
    .select('id, student_id, skill_id, artifact_id, base, difficulty_cleared, verification_method, engagement_id')
    .eq('id', dispute.evidence_id)
    .maybeSingle()
  if (!evidence) {
    return finish({
      status: 'resolved_manual',
      note: 'The disputed evidence could not be found. A person will review this.',
      correctionEvidenceId: null,
    })
  }

  const { data: artifact } = evidence.artifact_id
    ? await supabase.from('artifacts').select('id, repo_full_name').eq('id', evidence.artifact_id).maybeSingle()
    : { data: null }
  const { data: connection } = await supabase
    .from('github_connections')
    .select('installation_id, github_login')
    .eq('student_id', evidence.student_id)
    .maybeSingle()

  // Can't rescan without a repo and a live connection — route to a human
  // rather than guessing, and never silently leave the dispute open.
  if (!artifact?.repo_full_name || !connection?.github_login) {
    return finish({
      status: 'resolved_manual',
      note: 'This evidence has no re-readable repository on file, so it needs a person to review it.',
      correctionEvidenceId: null,
    })
  }

  let hasAttributedCommits = false
  let skillStillDetected = false
  let recomputedLevel: number | null = null

  try {
    const scan = await scanRepo(connection.installation_id, connection.github_login, artifact.repo_full_name)
    if (!scan.skip) {
      hasAttributedCommits = scan.studentCommitCount > 0

      // Must mirror processRepo exactly, implications included. A skill that
      // reached the record BY implication — PostgreSQL from Supabase, say —
      // would otherwise come back "no longer detected" here and have the
      // student's evidence deleted on a dispute they only filed to ask a
      // question. Any divergence between this and the scan is a bug that
      // costs someone real evidence.
      const rawSkills = Array.from(new Set(scan.detections.map((d) => d.raw)))
      const canonical = await canonicalizeSkills(supabase, rawSkills)
      const detectedIds = Array.from(canonical.values())
        .filter((r) => r.resolved)
        .map((r) => r.skillId as string)
      const { all: resolvedIds } = applyImplications(detectedIds)
      skillStillDetected = resolvedIds.has(evidence.skill_id)

      if (hasAttributedCommits && skillStillDetected) {
        const { rawComposite } = extractComplexity(scan, resolvedIds.size)
        const { difficultyCleared } = await computeDifficultyLevel(supabase, evidence.skill_id, rawComposite)
        recomputedLevel = difficultyCleared
      }
    }
  } catch (err) {
    console.error('[fcra/reinvestigate] rescan failed:', err)
    return finish({
      status: 'resolved_manual',
      note: 'The repository could not be re-read automatically. A person will review this.',
      correctionEvidenceId: null,
    })
  }

  const outcome = reinvestigationOutcome({
    category: dispute.category as DisputeCategory,
    hasAttributedCommits,
    skillStillDetected,
    recomputedLevel,
    originalLevel: evidence.difficulty_cleared,
  })

  // 'resolved_verified' writes nothing: the existing row still stands,
  // and adding a row that says "same as before" would inflate the
  // artifact count depth uses for corroboration.
  if (outcome.status === 'resolved_verified' || outcome.status === 'resolved_manual') {
    return finish({ ...outcome, correctionEvidenceId: null })
  }

  const retracting = outcome.status === 'resolved_retracted'
  const { data: correction, error } = await supabase
    .from('skill_evidence')
    .insert({
      student_id: evidence.student_id,
      skill_id: evidence.skill_id,
      artifact_id: evidence.artifact_id,
      engagement_id: evidence.engagement_id,
      base: evidence.base,
      difficulty_cleared: retracting ? evidence.difficulty_cleared : recomputedLevel,
      verification_method: evidence.verification_method,
      source_agreement: 1,
      corrects_evidence_id: evidence.id,
      retracted_at: retracting ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[fcra/reinvestigate] correction insert failed:', error)
    return finish({
      status: 'resolved_manual',
      note: 'The reinvestigation completed but the correction could not be written. A person will review this.',
      correctionEvidenceId: null,
    })
  }

  const { error: auditErr } = await supabase.from('evidence_audit').insert({
    evidence_id: correction.id,
    source: 'dispute_reinvestigation',
    raw_input: {
      dispute_id: disputeId,
      category: dispute.category,
      original_evidence_id: evidence.id,
      original_level: evidence.difficulty_cleared,
      recomputed_level: recomputedLevel,
      has_attributed_commits: hasAttributedCommits,
      skill_still_detected: skillStillDetected,
    },
  })
  if (auditErr) console.error('[fcra/reinvestigate] audit insert failed:', auditErr)

  return finish({ ...outcome, correctionEvidenceId: correction.id })
}
