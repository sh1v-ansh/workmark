// Ties scan.ts + complexity.ts + verify-deployment.ts + canonicalize.ts +
// levels.ts together into actual writes: artifacts, skill_priors,
// skill_evidence, evidence_audit. This is the one place that decides what
// counts as evidence vs. a mere prior, and the one place that has to get
// the append-only/dedup semantics right.
//
// PRIOR vs EVIDENCE, the actual rule: every canonicalized skill detected
// in a scanned (non-skipped) repo gets a skill_priors row — that's the
// "we saw this" record, unconditional. The same skill gets promoted to
// skill_evidence only if the student has actual attributed commits in the
// repo (studentCommitCount > 0). A repo the student was granted access to
// but never personally committed to (an org repo swept in by a blanket
// "all repositories" install, say) stays a prior — real, but not proof
// THEY demonstrated anything.
//
// Requires a service-role client — writes to skill_evidence/skill_priors/
// evidence_audit/artifacts, none of which have insert policies for
// regular users by design (§10: these are system-computed, not user input).

import type { SupabaseClient } from '@supabase/supabase-js'
import { scanRepo, type RepoScanResult } from '@/lib/github/scan'
import { extractComplexity } from '@/lib/github/complexity'
import { verifyDeployment } from '@/lib/github/verify-deployment'
import { canonicalizeSkills } from '@/lib/skills/canonicalize'
import { computeDifficultyLevel } from '@/lib/skills/levels'

export interface ProcessRepoResult {
  repoFullName: string
  skipped: boolean
  skipReason?: string
  priorsWritten: string[]
  evidenceWritten: { skillId: string; difficultyCleared: number; changed: boolean }[]
}

export async function processRepo(
  supabase: SupabaseClient,
  studentId: string,
  installationId: string,
  githubLogin: string,
  repoFullName: string,
  grantId: string,
): Promise<ProcessRepoResult> {
  const scanResult = await scanRepo(installationId, githubLogin, repoFullName)
  if (scanResult.skip) {
    return { repoFullName, skipped: true, skipReason: scanResult.skipReason, priorsWritten: [], evidenceWritten: [] }
  }

  const rawSkillStrings = Array.from(new Set([
    ...Object.keys(scanResult.languages),
    ...scanResult.manifestSkills,
  ]))
  const canonicalized = await canonicalizeSkills(supabase, rawSkillStrings)
  const resolvedSkillIds = Array.from(new Set(
    Array.from(canonicalized.values()).filter((r) => r.resolved).map((r) => r.skillId as string),
  ))

  if (resolvedSkillIds.length === 0) {
    return { repoFullName, skipped: false, priorsWritten: [], evidenceWritten: [] }
  }

  // Priors: unconditional, one per resolved skill this scan touched.
  await writePriors(supabase, studentId, resolvedSkillIds)

  const willBeEvidence = scanResult.studentCommitCount > 0
  if (!willBeEvidence) {
    return { repoFullName, skipped: false, priorsWritten: resolvedSkillIds, evidenceWritten: [] }
  }

  const tier: 'tier_0' | 'tier_0_5' = (scanResult.distinctContributors ?? 1) > 1 ? 'tier_0_5' : 'tier_0'
  const base = tier === 'tier_0_5' ? 0.5 : 0.4

  const deployment = await verifyDeployment(installationId, repoFullName, scanResult.defaultBranch)
  const verificationMethod = deployment.verified ? deployment.method! : 'repo_link'

  const artifactId = await getOrCreateArtifact(
    supabase, studentId, repoFullName, grantId, tier, verificationMethod, deployment.url,
  )

  const { rawComposite } = await extractComplexity(installationId, repoFullName, scanResult, resolvedSkillIds.length)

  const evidenceWritten: ProcessRepoResult['evidenceWritten'] = []
  for (const skillId of resolvedSkillIds) {
    const { difficultyCleared } = await computeDifficultyLevel(supabase, skillId, rawComposite)
    const changed = await writeOrCorrectEvidence(supabase, {
      studentId, skillId, artifactId, base, rawComposite, difficultyCleared, verificationMethod,
    })
    evidenceWritten.push({ skillId, difficultyCleared, changed })
  }

  return { repoFullName, skipped: false, priorsWritten: resolvedSkillIds, evidenceWritten }
}

async function writePriors(supabase: SupabaseClient, studentId: string, skillIds: string[]): Promise<void> {
  const rows = skillIds.map((skillId) => ({
    student_id: studentId,
    skill_id: skillId,
    raw_scan_score: 1,
    source: 'github_scan',
    extracted_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('skill_priors').upsert(rows, { onConflict: 'student_id,skill_id' })
  if (error) throw error
}

async function getOrCreateArtifact(
  supabase: SupabaseClient,
  studentId: string,
  repoFullName: string,
  grantId: string,
  tier: 'tier_0' | 'tier_0_5',
  verificationMethod: string,
  deploymentUrl: string | null,
): Promise<string> {
  const { data: existing } = await supabase
    .from('artifacts')
    .select('id')
    .eq('student_id', studentId)
    .eq('repo_full_name', repoFullName)
    .maybeSingle()

  const patch = {
    student_id: studentId,
    type: 'repo' as const,
    source: 'github',
    repo_full_name: repoFullName,
    access_grant_id: grantId,
    tier,
    verification_method: verificationMethod,
    deployment_url: deploymentUrl,
    verified_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase.from('artifacts').update(patch).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }

  const { data: created, error } = await supabase.from('artifacts').insert(patch).select('id').single()
  if (error) throw error
  return created.id
}

/**
 * Dedup rule, applied per (student, skill, artifact): if a current
 * (non-superseded) evidence row already exists for this exact triple with
 * the SAME difficulty_cleared, do nothing — a rescan of unchanged work
 * must not inflate depth by writing a duplicate. If one exists with a
 * DIFFERENT level (the repo genuinely got more complex, or calibration
 * recomputed it independently), insert a correction row. If none exists,
 * insert fresh — this repo demonstrating this skill for the first time.
 */
async function writeOrCorrectEvidence(
  supabase: SupabaseClient,
  args: { studentId: string; skillId: string; artifactId: string; base: number; rawComposite: number; difficultyCleared: number; verificationMethod: string },
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('current_skill_evidence')
    .select('id, difficulty_cleared')
    .eq('student_id', args.studentId)
    .eq('skill_id', args.skillId)
    .eq('artifact_id', args.artifactId)
    .maybeSingle()

  if (existing && existing.difficulty_cleared === args.difficultyCleared) {
    return false // unchanged — no-op
  }

  const row = {
    student_id: args.studentId,
    skill_id: args.skillId,
    artifact_id: args.artifactId,
    base: args.base,
    raw_composite: args.rawComposite,
    difficulty_cleared: args.difficultyCleared,
    verification_method: args.verificationMethod,
    source_agreement: 1, // MVP: the scan is the only source — see levels.ts / §5
    corrects_evidence_id: existing?.id ?? null,
  }
  const { data: inserted, error } = await supabase.from('skill_evidence').insert(row).select('id').single()
  if (error) throw error

  const { error: auditErr } = await supabase.from('evidence_audit').insert({
    evidence_id: inserted.id,
    source: 'github_scan',
    raw_input: { artifact_id: args.artifactId, raw_composite: args.rawComposite },
  })
  if (auditErr) throw auditErr

  return true
}
