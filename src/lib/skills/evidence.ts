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
import { applyImplications } from '@/lib/skills/implications'
import { computeDifficultyLevel } from '@/lib/skills/levels'

export interface ProcessRepoResult {
  repoFullName: string
  skipped: boolean
  skipReason?: string
  priorsWritten: string[]
  evidenceWritten: { skillId: string; difficultyCleared: number; changed: boolean }[]
}

/**
 * options.engagementId promotes the scan from self-evidenced work to
 * listing-driven work: base 0.5 instead of 0.4/0.5-by-contributor-count,
 * tier 'listing_driven', and both the artifact and the evidence rows tied
 * to the engagement. The artifact is looked up scoped to the engagement
 * too, so a repo that already produced Tier 0 evidence on its own gets a
 * SECOND artifact for the engagement rather than having its solo-work
 * record overwritten — the two are different claims about different work.
 */
export async function processRepo(
  supabase: SupabaseClient,
  studentId: string,
  installationId: string,
  githubLogin: string,
  repoFullName: string,
  grantId: string,
  options: { engagementId?: string } = {},
): Promise<ProcessRepoResult> {
  const scanResult = await scanRepo(installationId, githubLogin, repoFullName)
  if (scanResult.skip) {
    return { repoFullName, skipped: true, skipReason: scanResult.skipReason, priorsWritten: [], evidenceWritten: [] }
  }

  // Detections carry where they came from; canonicalization only deals in
  // strings. Resolve the distinct raw strings once, then map each resolved
  // skill back to every place it was seen, so the student can be shown why
  // their record says what it says.
  const rawSkillStrings = Array.from(new Set(scanResult.detections.map((d) => d.raw)))
  const canonicalized = await canonicalizeSkills(supabase, rawSkillStrings)

  const provenance = new Map<string, string[]>()
  for (const d of scanResult.detections) {
    const resolved = canonicalized.get(d.raw)
    if (!resolved?.resolved || !resolved.skillId) continue
    const places = provenance.get(resolved.skillId) ?? []
    if (!places.includes(d.where)) places.push(d.where)
    provenance.set(resolved.skillId, places)
  }

  // "Using X means you used Y" — Supabase is Postgres, Postgres is SQL.
  // Applied after canonicalization so it works off taxonomy ids rather than
  // whichever alias happened to appear in the manifest.
  const { all: expandedIds, causedBy } = applyImplications(provenance.keys())
  for (const [impliedId, sourceId] of Array.from(causedBy.entries())) {
    const cause = provenance.get(sourceId)?.[0]
    provenance.set(impliedId, [cause ? `implied by ${sourceId} (${cause})` : `implied by ${sourceId}`])
  }

  const resolvedSkillIds = Array.from(expandedIds)

  if (resolvedSkillIds.length === 0) {
    return { repoFullName, skipped: false, priorsWritten: [], evidenceWritten: [] }
  }

  // Priors: unconditional, one per resolved skill this scan touched.
  await writePriors(supabase, studentId, resolvedSkillIds)

  const willBeEvidence = scanResult.studentCommitCount > 0
  if (!willBeEvidence) {
    return { repoFullName, skipped: false, priorsWritten: resolvedSkillIds, evidenceWritten: [] }
  }

  const engagementId = options.engagementId ?? null
  // Listing-driven work carries base 0.5 regardless of contributor count:
  // the weight comes from it having been real work someone asked for and
  // accepted, not from how many people happened to commit to the repo.
  const tier: ArtifactTier = engagementId
    ? 'listing_driven'
    : (scanResult.distinctContributors ?? 1) > 1 ? 'tier_0_5' : 'tier_0'
  const base = tier === 'tier_0' ? 0.4 : 0.5

  const deployment = await verifyDeployment(installationId, repoFullName, scanResult.defaultBranch)
  const verificationMethod = deployment.verified ? deployment.method! : 'repo_link'

  const artifactId = await getOrCreateArtifact(
    supabase, studentId, repoFullName, grantId, tier, verificationMethod, deployment.url, engagementId,
  )

  const { rawComposite } = extractComplexity(scanResult, resolvedSkillIds.length)

  // Where each skill came from, stored so /me/file can answer "why does my
  // record say this" without re-running a scan. artifact_signals is already
  // the generic "a fact about this artifact" table, so this needs no new
  // schema. Best-effort: failing to record provenance must not cost the
  // student the evidence itself.
  await recordProvenance(supabase, artifactId, provenance)

  const evidenceWritten: ProcessRepoResult['evidenceWritten'] = []
  for (const skillId of resolvedSkillIds) {
    const { difficultyCleared } = await computeDifficultyLevel(supabase, skillId, rawComposite)
    const changed = await writeOrCorrectEvidence(supabase, {
      studentId, skillId, artifactId, base, rawComposite, difficultyCleared, verificationMethod, engagementId,
    })
    evidenceWritten.push({ skillId, difficultyCleared, changed })
  }

  return { repoFullName, skipped: false, priorsWritten: resolvedSkillIds, evidenceWritten }
}

/**
 * Save "PostgreSQL was found in docker-compose.yml" for each skill.
 *
 * Rewritten rather than appended on each scan: this describes the repo as
 * it is now, so a dependency the student removed should stop being cited.
 * That's the opposite of skill_evidence, which is append-only because it's
 * a claim about a moment in time — this is a lookup table for the current
 * state, not a record of what was once true.
 */
async function recordProvenance(
  supabase: SupabaseClient,
  artifactId: string,
  provenance: Map<string, string[]>,
): Promise<void> {
  if (provenance.size === 0) return
  try {
    const rows = Array.from(provenance.entries()).map(([skillId, places]) => ({
      artifact_id: artifactId,
      signal_name: `skill_source:${skillId}`,
      value: places.slice(0, 6).join(', ').slice(0, 500),
    }))
    await supabase
      .from('artifact_signals')
      .delete()
      .eq('artifact_id', artifactId)
      .like('signal_name', 'skill_source:%')
    await supabase.from('artifact_signals').insert(rows)
  } catch (err) {
    console.error('[skills/evidence] could not record skill provenance:', err)
  }
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

type ArtifactTier = 'tier_0' | 'tier_0_5' | 'listing_driven'

async function getOrCreateArtifact(
  supabase: SupabaseClient,
  studentId: string,
  repoFullName: string,
  grantId: string,
  tier: ArtifactTier,
  verificationMethod: string,
  deploymentUrl: string | null,
  engagementId: string | null,
): Promise<string> {
  // Scoped to the engagement (or explicitly to no engagement) — `.is`
  // rather than `.eq` for the null case, since PostgREST renders
  // `eq.null` as a comparison against the literal string, which never
  // matches and would create a duplicate artifact on every scan.
  let query = supabase
    .from('artifacts')
    .select('id')
    .eq('student_id', studentId)
    .eq('repo_full_name', repoFullName)
  query = engagementId ? query.eq('engagement_id', engagementId) : query.is('engagement_id', null)
  const { data: existing } = await query.maybeSingle()

  const patch = {
    student_id: studentId,
    type: 'repo' as const,
    source: 'github',
    repo_full_name: repoFullName,
    access_grant_id: grantId,
    engagement_id: engagementId,
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
  args: { studentId: string; skillId: string; artifactId: string; base: number; rawComposite: number; difficultyCleared: number; verificationMethod: string; engagementId: string | null },
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
    engagement_id: args.engagementId,
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
