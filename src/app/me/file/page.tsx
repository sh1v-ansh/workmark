import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import MyFileClient, { type FileData } from './MyFileClient'
import type { DisputeCategory, DisputeStatus } from '@/lib/fcra/disputes'

/**
 * /me/file — the consumer's file disclosure (§609).
 *
 * Everything we hold about this student and everything we've said about
 * them to anyone else: every evidence row INCLUDING superseded and
 * retracted ones (the point of a file is the history, not the current
 * summary), where each came from, every disclosure with the values
 * actually furnished, every consent, and every dispute.
 *
 * Read under the student's own session throughout — RLS is what
 * guarantees this is their file and nobody else's. The one service-role
 * read is recipient names: disclosure recipients are posters, and a
 * student has no RLS grant to read an arbitrary other student's row,
 * but "who did you tell" is exactly what §609 entitles them to know.
 */
export default async function MyFilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  const [
    { data: evidenceRows },
    { data: disclosures },
    { data: consents },
    { data: disputes },
  ] = await Promise.all([
    supabase
      .from('skill_evidence')
      .select('id, skill_id, artifact_id, base, tier_weight, difficulty_cleared, verification_method, corrects_evidence_id, retracted_at, created_at')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('disclosure_log')
      .select('id, recipient_id, fields_disclosed, payload_snapshot, furnished_at')
      .eq('student_id', user.id)
      .order('furnished_at', { ascending: false }),
    supabase
      .from('consents')
      .select('id, scope, text_version, granted_at, revoked_at')
      .eq('student_id', user.id)
      .order('granted_at', { ascending: false }),
    supabase
      .from('disputes')
      .select('id, evidence_id, category, detail, status, filed_at, due_at, resolved_at, resolution_note')
      .eq('student_id', user.id)
      .order('filed_at', { ascending: false }),
  ])

  const rows = evidenceRows ?? []

  // A row is superseded if some other row corrects it. Shown as history
  // rather than hidden — "what did my record say in March" is precisely
  // what a file disclosure is for.
  const correctedIds = new Set(rows.map((r) => r.corrects_evidence_id).filter(Boolean) as string[])

  const skillIds = Array.from(new Set(rows.map((r) => r.skill_id)))
  const artifactIds = Array.from(new Set(rows.map((r) => r.artifact_id).filter((id): id is string => !!id)))
  const evidenceIds = rows.map((r) => r.id)

  const [{ data: skillRows }, { data: artifactRows }, { data: auditRows }] = await Promise.all([
    skillIds.length ? supabase.from('skills').select('id, canonical_name').in('id', skillIds) : Promise.resolve({ data: [] }),
    artifactIds.length ? supabase.from('artifacts').select('id, repo_full_name, tier').in('id', artifactIds) : Promise.resolve({ data: [] }),
    evidenceIds.length ? supabase.from('evidence_audit').select('evidence_id, source, raw_input, extracted_at').in('evidence_id', evidenceIds) : Promise.resolve({ data: [] }),
  ])

  const nameById = new Map(((skillRows ?? []) as { id: string; canonical_name: string }[]).map((s) => [s.id, s.canonical_name]))
  const artifactById = new Map(((artifactRows ?? []) as { id: string; repo_full_name: string | null; tier: string }[]).map((a) => [a.id, a]))
  const auditByEvidence = new Map<string, { source: string | null; extracted_at: string }>()
  for (const a of (auditRows ?? []) as { evidence_id: string; source: string | null; extracted_at: string }[]) {
    if (!auditByEvidence.has(a.evidence_id)) auditByEvidence.set(a.evidence_id, { source: a.source, extracted_at: a.extracted_at })
  }

  // Recipient names — see the note above on why this one read is elevated.
  const recipientIds = Array.from(new Set((disclosures ?? []).map((d) => d.recipient_id)))
  const recipientNames = new Map<string, string>()
  if (recipientIds.length > 0) {
    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: recipients } = await admin.from('students').select('id, full_name').in('id', recipientIds)
    for (const r of recipients ?? []) recipientNames.set(r.id, r.full_name ?? 'A poster')
  }

  const data: FileData = {
    studentName: student.full_name,
    evidence: rows.map((r) => {
      const artifact = r.artifact_id ? artifactById.get(r.artifact_id) : null
      const audit = auditByEvidence.get(r.id)
      return {
        id: r.id,
        skillId: r.skill_id,
        skillName: nameById.get(r.skill_id) ?? r.skill_id,
        level: r.difficulty_cleared,
        base: r.base,
        tierWeight: r.tier_weight,
        verificationMethod: r.verification_method,
        repoFullName: artifact?.repo_full_name ?? null,
        tier: artifact?.tier ?? null,
        source: audit?.source ?? null,
        createdAt: r.created_at,
        supersededByCorrection: correctedIds.has(r.id),
        isCorrection: !!r.corrects_evidence_id,
        retracted: !!r.retracted_at,
      }
    }),
    disclosures: (disclosures ?? []).map((d) => ({
      id: d.id,
      recipientName: recipientNames.get(d.recipient_id) ?? 'A poster',
      fieldsDisclosed: d.fields_disclosed ?? [],
      payloadSnapshot: d.payload_snapshot,
      disclosedAt: d.furnished_at,
    })),
    consents: (consents ?? []).map((c) => ({
      id: c.id,
      scope: c.scope,
      textVersion: c.text_version,
      grantedAt: c.granted_at,
      revokedAt: c.revoked_at,
    })),
    disputes: (disputes ?? []).map((d) => ({
      id: d.id,
      evidenceId: d.evidence_id,
      category: d.category as DisputeCategory,
      detail: d.detail,
      status: d.status as DisputeStatus,
      filedAt: d.filed_at,
      dueAt: d.due_at,
      resolvedAt: d.resolved_at,
      resolutionNote: d.resolution_note,
    })),
  }

  return <MyFileClient data={data} />
}
