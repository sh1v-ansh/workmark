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
import { baseFor, type ArtifactTier } from './tiers'
import { scanRepo, type RepoScanResult } from '@/lib/github/scan'
import { extractComplexity } from '@/lib/github/complexity'
import { verifyDeployment } from '@/lib/github/verify-deployment'
import type { Detection } from '@/lib/github/detectors'
import { canonicalizeSkills } from '@/lib/skills/canonicalize'
import { applyImplications } from '@/lib/skills/implications'
import {
  computeLanguageShare, computeSkillRelevance, scaleComposite,
  EVIDENCE_THRESHOLD, evidenceCeiling, type SkillRelevance,
} from '@/lib/skills/relevance'
import { computeDifficultyLevel } from '@/lib/skills/levels'
import { retractionsFor, mayRetract } from '@/lib/skills/retraction'
import { corroborationCeiling, capSkillsPerRepo } from '@/lib/skills/corroboration'
import { knownCommitEmails, recordUnclaimedEmails } from '@/lib/github/emails'
import { recordOnce } from '@/lib/analytics/record'

export interface ProcessRepoResult {
  repoFullName: string
  skipped: boolean
  skipReason?: string
  priorsWritten: string[]
  evidenceWritten: { skillId: string; difficultyCleared: number; changed: boolean }[]
  /** Skills this repo used to support and no longer does. */
  retracted: string[]
  /**
   * What the scan actually saw, for the line the student reads.
   *
   * These were all computed and discarded, so "the rescan changed nothing"
   * was a sentence nobody could check — not the student, and not us. Every
   * one of them distinguishes a real outcome from a broken scan.
   */
  diagnostics?: {
    /** Commits attributed to this student. Zero is the interesting case. */
    commits: number
    /** True when something failed that the scan carried on past. */
    partial: boolean
    /** Whether retraction was allowed to run at all. */
    couldRetract: boolean
  }
}

/**
 * options.engagementId promotes the scan from self-evidenced work to
 * listing-driven work: base 0.5 instead of 0.4/0.5-by-contributor-count,
 * tier 'listing_driven', and both the artifact and the evidence rows tied
 * to the engagement. The artifact is looked up scoped to the engagement
 * too, so a repo that already produced Tier 0 evidence on its own gets a
 * SECOND artifact for the engagement rather than having its solo-work
 * record overwritten — the two are different claims about different work.
 *
 * options.workspaceId does the same for a project workspace, one tier
 * higher. What earns it is not that the work is harder but that the
 * acceptance criteria were written down BEFORE the work started: every
 * other tier judges a finished repository against itself, and this one has
 * a claim made in advance and a check against it. That also makes the
 * verified-task history a second independent reading of the same work, which
 * is what source_agreement counts.
 *
 * grantId is nullable because a workspace holds its repository at workspace
 * level (workspace_repos, one installation for the whole team) rather than
 * through a per-student grant. artifacts.access_grant_id has always allowed
 * null; nothing had reason to pass it before.
 */
export async function processRepo(
  supabase: SupabaseClient,
  studentId: string,
  installationId: string,
  githubLogin: string,
  repoFullName: string,
  grantId: string | null,
  options: { engagementId?: string; workspaceId?: string } = {},
): Promise<ProcessRepoResult> {
  // Addresses the student has confirmed are theirs, so a commit from a lab
  // machine or a university account counts as work they did. Without this
  // the scan falls back to GitHub's own matching, which is what produced
  // empty records for students who wrote every line — see attribution.ts.
  const knownEmails = await knownCommitEmails(supabase, studentId)

  const scanResult = await scanRepo(installationId, githubLogin, repoFullName, knownEmails)

  // Asked about whether or not anything else worked. This is the signal that
  // a record is empty for a fixable reason rather than a true one, and it is
  // most valuable in exactly the case where the rest of the scan found
  // nothing to write.
  await recordUnclaimedEmails(supabase, studentId, repoFullName, scanResult.unclaimedEmails)

  if (scanResult.skip) {
    return { repoFullName, skipped: true, skipReason: scanResult.skipReason, priorsWritten: [], evidenceWritten: [], retracted: [] }
  }

  // Detections carry where they came from; canonicalization only deals in
  // strings. Resolve the distinct raw strings once, then map each resolved
  // skill back to every place it was seen, so the student can be shown why
  // their record says what it says.
  const rawSkillStrings = Array.from(new Set(scanResult.detections.map((d) => d.raw)))
  // GitHub's own language statistics are not a guess that needs filtering,
  // so they skip the noise check. Without this the filter's one-character
  // rule deleted real R and C before either could match anything.
  const trusted = new Set(
    scanResult.detections
      .filter((d) => d.source === 'language')
      .map((d) => d.raw.trim().toLowerCase()),
  )
  const canonicalized = await canonicalizeSkills(supabase, rawSkillStrings, {
    studentId, repoFullName, trusted,
  })

  const provenance = new Map<string, string[]>()
  // Kept alongside provenance because relevance needs the detection's source
  // and path, not just the human-readable place string.
  const detectionsBySkill = new Map<string, Detection[]>()
  for (const d of scanResult.detections) {
    const resolved = canonicalized.get(d.raw)
    if (!resolved?.resolved || !resolved.skillId) continue
    const places = provenance.get(resolved.skillId) ?? []
    if (!places.includes(d.where)) places.push(d.where)
    provenance.set(resolved.skillId, places)
    detectionsBySkill.set(resolved.skillId, [...(detectionsBySkill.get(resolved.skillId) ?? []), d])
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
    return { repoFullName, skipped: false, priorsWritten: [], evidenceWritten: [], retracted: [] }
  }

  // Priors: unconditional, one per resolved skill this scan touched.
  await writePriors(supabase, studentId, resolvedSkillIds)

  const willBeEvidence = scanResult.studentCommitCount > 0
  if (!willBeEvidence) {
    return { repoFullName, skipped: false, priorsWritten: resolvedSkillIds, evidenceWritten: [], retracted: [] }
  }

  const engagementId = options.engagementId ?? null
  const workspaceId = options.workspaceId ?? null
  // Listing-driven work carries the same weight regardless of contributor
  // count: it comes from having been real work someone asked for and
  // accepted, not from how many people happened to commit to the repo.
  const tier: ArtifactTier = workspaceId
    ? 'workspace_verified'
    : engagementId
      ? 'listing_driven'
      : (scanResult.distinctContributors ?? 1) > 1 ? 'tier_0_5' : 'tier_0'
  // The weights and the argument for them are in tiers.ts. They were four
  // inline numbers here, which made it impossible to see that the ordering is
  // the claim and the magnitudes are an unvalidated first guess.
  const base = baseFor(tier)

  const deployment = await verifyDeployment(installationId, repoFullName, scanResult.defaultBranch)
  const verificationMethod = deployment.verified ? deployment.method! : 'repo_link'

  const artifactId = await getOrCreateArtifact(
    supabase, studentId, repoFullName, grantId, tier, verificationMethod, deployment.url,
    engagementId, workspaceId,
  )

  // ── What counts as an "external system" ────────────────────────────────
  // This used to be resolvedSkillIds.length — every skill the repo resolved,
  // including every dependency declared in a manifest nobody touched. So
  // adding sixty unused libraries to a package.json raised the difficulty
  // score of the repository, and therefore the level of every *other* skill
  // in it. The one input a student could inflate for free was wired to the
  // number that decides how hard their work was.
  //
  // Counted from what they actually integrated instead: distinct things they
  // imported in their own code. A service wired into the app is an external
  // system; a line in a lockfile is not.
  const integrated = new Set(
    scanResult.detections.filter((d) => d.source === 'import').map((d) => d.raw.toLowerCase()),
  )
  const { rawComposite } = extractComplexity(scanResult, integrated.size)

  // How much of this repo's difficulty each skill actually has a claim on.
  // Without this, every skill in the repo got the same number — so a hard
  // Rust project containing an unused package.json claimed the student was
  // as good at React as at Rust.
  const filesTouched = new Set(scanResult.filesTouchedByStudent)
  const languageShare = computeLanguageShare(scanResult.filesTouchedByStudent)
  const relevanceBySkill = new Map<string, SkillRelevance>()
  // Two explicit passes, because an implied skill inherits from whatever
  // implied it and so must be computed second. Relying on Set iteration
  // order to get that right would work today and break silently the first
  // time the implication table grows a chain.
  for (const skillId of resolvedSkillIds) {
    if (causedBy.has(skillId)) continue
    relevanceBySkill.set(skillId, computeSkillRelevance({
      detections: detectionsBySkill.get(skillId) ?? [],
      filesTouched,
      languageShare,
    }))
  }
  for (const skillId of resolvedSkillIds) {
    const impliedSource = causedBy.get(skillId)
    if (!impliedSource) continue
    relevanceBySkill.set(skillId, computeSkillRelevance({
      detections: detectionsBySkill.get(skillId) ?? [],
      filesTouched,
      languageShare,
      // A chain (Supabase -> Postgres -> SQL) resolves its middle link in
      // the pass above; a link whose source is itself implied falls back to
      // a neutral value rather than reading a half-built map.
      impliedFrom: { skillId: impliedSource, relevance: relevanceBySkill.get(impliedSource)?.relevance ?? 0.6 },
    }))
  }

  // Where each skill came from, stored so /me/file can answer "why does my
  // record say this" without re-running a scan. artifact_signals is already
  // the generic "a fact about this artifact" table, so this needs no new
  // schema. Best-effort: failing to record provenance must not cost the
  // student the evidence itself.
  await recordProvenance(supabase, artifactId, provenance, relevanceBySkill)

  const evidenceWritten: ProcessRepoResult['evidenceWritten'] = []
  // What this scan is prepared to stand behind for this repository. Anything
  // the record claims on this repo's strength that is not in here is no
  // longer supported — see the retraction block below.
  const supported = new Set<string>()
  // Scored first, written second. The per-repository cap needs to see every
  // skill's level before it can decide which ones keep theirs, and deciding
  // that while writing would mean the answer depended on iteration order.
  const scoredSkills: { skillId: string; strength: number; level: 1 | 2 | 3; composite: number }[] = []
  for (const skillId of resolvedSkillIds) {
    const relevance = relevanceBySkill.get(skillId)?.relevance ?? 0.5

    // Below the bar this stays a prior — "we saw this in your repo" — and
    // never becomes evidence. A React dependency in a repo where the student
    // never touched a line of frontend is a true fact about the repo and a
    // false claim about them; the record should only make the first.
    if (relevance < EVIDENCE_THRESHOLD) continue

    const skillComposite = scaleComposite(rawComposite, relevance)
    const { difficultyCleared: scored } = await computeDifficultyLevel(supabase, skillId, skillComposite)

    const level = Math.min(
      scored,
      // Capped by what was actually observed about this person, not by how
      // hard the repository was. The composite is mostly a property of the
      // repo — tests, CI, how long it ran — and without this it dragged
      // every skill in a serious project to the top band.
      evidenceCeiling(relevance),
      // And capped again by how much of the repository supports it. One
      // file of sixty imports is one piece of evidence however many names
      // are in it; without this, one commit minted sixty skills above the
      // floor with no code behind any of them.
      corroborationCeiling(detectionsBySkill.get(skillId) ?? []),
    ) as 1 | 2 | 3

    scoredSkills.push({ skillId, strength: relevance, level, composite: skillComposite })
  }

  // The backstop, for somebody who spreads the same trick across three files
  // rather than one. An honest project lands under the cap and is untouched.
  const capped = capSkillsPerRepo(scoredSkills)

  for (const s of scoredSkills) {
    const difficultyCleared = capped.get(s.skillId) ?? s.level
    const changed = await writeOrCorrectEvidence(supabase, {
      studentId, skillId: s.skillId, artifactId, base,
      rawComposite: s.composite, difficultyCleared,
      verificationMethod, engagementId, workspaceId,
    })
    evidenceWritten.push({ skillId: s.skillId, difficultyCleared, changed })
    supported.add(s.skillId)
  }

  // The moment the product first works for somebody: code they wrote became
  // a skill on a record. Once per student, not once per scan — this loop
  // runs per repository and again on every rescan, so without the guard the
  // "students who got a first skill" count would include the same person
  // forty times.
  if (evidenceWritten.length > 0) {
    void recordOnce(supabase, 'first_evidence', studentId, { skills: evidenceWritten.length })
  }

  // ── Taking things off ──────────────────────────────────────────────────
  // This loop only ever added. A skill that fell below the bar was skipped
  // and the row already on the record stayed there, so every mistake the
  // scanner ever made was permanent and fixing the rule helped nobody
  // already affected.
  //
  // Guarded by mayRetract, which is the part that matters: a scan that hit a
  // rate limit produces exactly what a scan of an empty repo produces, and
  // without the guard a bad afternoon at GitHub would empty people's
  // records. Scoped to this artifact, so a scan of a toy repo can never
  // strip a skill proved by a real one.
  const retracted: string[] = []
  if (mayRetract({
    scanned: true,
    partial: scanResult.partial,
    studentCommitCount: scanResult.studentCommitCount,
    resolvedCount: resolvedSkillIds.length,
  })) {
    const { data: current, error: readErr } = await supabase
      .from('current_skill_evidence')
      .select('id, skill_id')
      .eq('student_id', studentId)
      .eq('artifact_id', artifactId)

    // Same reasoning as the dedup read in writeOrCorrectEvidence: a failed
    // read must not be treated as "there is nothing on the record".
    if (readErr) {
      console.error(`[evidence] could not read current claims for ${repoFullName}:`, readErr.message)
    } else {
      const toRetract = retractionsFor(
        (current ?? []).map((r) => ({ evidenceId: r.id as string, skillId: r.skill_id as string })),
        { supported },
      )
      for (const r of toRetract) {
        const { error } = await supabase
          .from('skill_evidence')
          .update({ retracted_at: new Date().toISOString() })
          .eq('id', r.evidenceId)
        // Retraction is append-safe and idempotent, so one failure is worth
        // logging and carrying past rather than aborting the whole scan.
        if (error) {
          console.error(`[evidence] retraction failed for ${r.skillId}:`, error.message)
          continue
        }
        retracted.push(r.skillId)
      }
    }
  } else if (scanResult.partial) {
    console.warn(
      `[evidence] ${repoFullName} scanned only partially, leaving the record alone:`,
      scanResult.problems.slice(0, 5).join('; '),
    )
  }

  return {
    repoFullName,
    skipped: false,
    priorsWritten: resolvedSkillIds,
    evidenceWritten,
    retracted,
    diagnostics: {
      commits: scanResult.studentCommitCount,
      partial: scanResult.partial,
      couldRetract: mayRetract({
        scanned: true,
        partial: scanResult.partial,
        studentCommitCount: scanResult.studentCommitCount,
        resolvedCount: resolvedSkillIds.length,
      }),
    },
  }
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
  relevanceBySkill: Map<string, SkillRelevance>,
): Promise<void> {
  if (provenance.size === 0) return
  try {
    const rows = Array.from(provenance.entries()).map(([skillId, places]) => {
      // The relevance reason goes in the same string as the file list, so
      // the student sees both where it was found and why it counted for as
      // much as it did — "docker-compose.yml — you set this up there".
      const reason = relevanceBySkill.get(skillId)?.reason
      const found = places.slice(0, 6).join(', ')
      return {
        artifact_id: artifactId,
        signal_name: `skill_source:${skillId}`,
        value: (reason ? `${found} — ${reason}` : found).slice(0, 500),
      }
    })
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

// Moved to tiers.ts, with the weights and the reasoning for each.
export type { ArtifactTier } from './tiers'

async function getOrCreateArtifact(
  supabase: SupabaseClient,
  studentId: string,
  repoFullName: string,
  grantId: string | null,
  tier: ArtifactTier,
  verificationMethod: string,
  deploymentUrl: string | null,
  engagementId: string | null,
  workspaceId: string | null,
): Promise<string> {
  // Scoped to the engagement or the workspace — or explicitly to neither.
  // `.is` rather than `.eq` for each null case, since PostgREST renders
  // `eq.null` as a comparison against the literal string, which never
  // matches and would create a duplicate artifact on every scan.
  //
  // Both are pinned, not just the one that is set. A repo scanned solo, then
  // used on a project, is two claims about two pieces of work and wants two
  // artifacts; leaving the other column unconstrained would let the second
  // scan find the first row and overwrite the student's own record of it.
  let query = supabase
    .from('artifacts')
    .select('id')
    .eq('student_id', studentId)
    .eq('repo_full_name', repoFullName)
  query = engagementId ? query.eq('engagement_id', engagementId) : query.is('engagement_id', null)
  query = workspaceId ? query.eq('workspace_id', workspaceId) : query.is('workspace_id', null)
  const { data: existing } = await query.maybeSingle()

  const patch = {
    student_id: studentId,
    type: 'repo' as const,
    source: 'github',
    repo_full_name: repoFullName,
    access_grant_id: grantId,
    engagement_id: engagementId,
    workspace_id: workspaceId,
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
  args: { studentId: string; skillId: string; artifactId: string; base: number; rawComposite: number; difficultyCleared: number; verificationMethod: string; engagementId: string | null; workspaceId: string | null },
): Promise<boolean> {
  const { data: existing, error: readErr } = await supabase
    .from('current_skill_evidence')
    .select('id, difficulty_cleared')
    .eq('student_id', args.studentId)
    .eq('skill_id', args.skillId)
    .eq('artifact_id', args.artifactId)
    .maybeSingle()

  // The error used to be discarded, and that made this function
  // self-destructive in one specific case. current_skill_evidence has no
  // uniqueness on (student, skill, artifact), so if two current rows ever
  // exist — two scans of the same repo racing, or a correction chain that
  // broke — maybeSingle returns PGRST116 and null data. Reading that as "no
  // existing evidence" inserted a third row, which guaranteed the same
  // error next time. The student's depth in that skill doubled, then
  // tripled, with nothing in the UI to show why.
  //
  // Refusing to write is the safe direction: a scan that recorded nothing
  // is fixed by the next scan, and a duplicate is not fixed by anything.
  if (readErr) {
    console.error(
      `[evidence] refusing to write ${args.skillId} for ${args.studentId}:`,
      readErr.message,
    )
    return false
  }

  if (existing && existing.difficulty_cleared === args.difficultyCleared) {
    return false // unchanged — no-op
  }

  const row = {
    student_id: args.studentId,
    skill_id: args.skillId,
    artifact_id: args.artifactId,
    engagement_id: args.engagementId,
    workspace_id: args.workspaceId,
    base: args.base,
    raw_composite: args.rawComposite,
    difficulty_cleared: args.difficultyCleared,
    verification_method: args.verificationMethod,
    // Elsewhere the scan is the only source, so this is 1. Workspace work has
    // a second, genuinely independent one: acceptance criteria written before
    // the code existed, and a check against them. Two readings of the same
    // work, which is exactly what this column counts.
    source_agreement: args.workspaceId ? 2 : 1,
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

/**
 * Drop priors the latest full scan did not see again.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * writePriors only ever upserts, and priors are keyed per student rather than
 * per repository — so a skill detected once in August stayed in "Detected but
 * unverified" forever, whatever happened afterwards. Deleting the alias that
 * produced R, and fixing the rules that produced cryptography, changed
 * nothing on that list, because nothing ever took anything off it.
 *
 * ── Why at the end of the job, and only a clean one ───────────────────────
 * One repository cannot say a prior is stale: the same skill may come from
 * another. Only after every repository has been read does "not seen this
 * time" mean anything, so this runs once per job, and only when no step
 * failed — a repository that could not be read is one whose priors we would
 * be deleting on no evidence at all.
 *
 * Every prior seen this scan had extracted_at bumped by writePriors, so the
 * stale ones are exactly those older than the moment the job started.
 */
export async function pruneStalePriors(
  supabase: SupabaseClient,
  studentId: string,
  scanStartedAt: string,
): Promise<number> {
  // A minute of slack. extracted_at is stamped by the app server's clock and
  // started_at by Postgres', and a prior written in the job's first seconds
  // on a server running slightly behind would otherwise look older than the
  // scan that wrote it. Anything genuinely stale is days old, not seconds.
  const cutoff = new Date(new Date(scanStartedAt).getTime() - 60_000).toISOString()

  const { data, error } = await supabase
    .from('skill_priors')
    .delete()
    .eq('student_id', studentId)
    .lt('extracted_at', cutoff)
    .select('id')
  if (error) {
    console.error('[evidence] could not prune stale priors:', error.message)
    return 0
  }
  return data?.length ?? 0
}
