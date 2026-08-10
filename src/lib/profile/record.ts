// Loads a student's verified record — the thing /me shows in full and
// /p/[handle] shows a redacted view of.
//
// Takes whichever Supabase client the caller hands it, which is the
// whole design: /me passes the student's own RLS-scoped session (they
// can read their own everything), /p/[handle] passes a service-role
// client because a public viewer has no RLS grant on evidence and we do
// the visibility filtering in code instead.
//
// Why not broaden RLS so anon can read evidence for handled students?
// Because visibility is per-ENGAGEMENT and partly field-level (redacted
// hides the poster and description but keeps the row), and RLS can't
// express field-level rules. Splitting the logic across policies and
// code would mean two places to get it wrong. One code path, one place
// to audit.

import type { SupabaseClient } from '@supabase/supabase-js'
import { depthFromEvidenceRows } from '@/lib/matching/depth'
import { computeTrackRecord, type Stage } from '@/lib/engagements/lifecycle'
import type { EngagementForDisplay, Visibility } from './visibility'

export interface RecordSkill {
  skillId: string
  name: string
  bestLevel: number
  artifactCount: number
  depth: number
}

export interface StudentRecord {
  student: {
    id: string
    fullName: string | null
    university: string | null
    major: string | null
    degreeType: string | null
    graduationYear: number | null
    handle: string | null
    githubUsername: string | null
    linkedinUrl: string | null
    selfReportedSkills: string[]
  }
  skills: RecordSkill[]
  engagements: EngagementForDisplay[]
  trackRecord: ReturnType<typeof computeTrackRecord>
}

export async function loadStudentRecord(
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentRecord | null> {
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, university, major, degree_type, graduation_year, handle, github_username, linkedin_url, skills')
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return null

  const [{ data: evidenceRows }, { data: engagementRows }] = await Promise.all([
    supabase
      .from('current_skill_evidence')
      .select('skill_id, base, tier_weight, difficulty_cleared, artifact_id, verification_method, created_at')
      .eq('student_id', studentId),
    supabase
      .from('engagements')
      .select('id, visibility, stage, description, closed_at, listing_id, listings(title, poster_display_name)')
      .eq('student_id', studentId)
      .order('closed_at', { ascending: false, nullsFirst: false }),
  ])

  const depth = depthFromEvidenceRows(evidenceRows ?? [])
  const skillIds = Array.from(depth.keys())
  const { data: skillRows } = skillIds.length
    ? await supabase.from('skills').select('id, canonical_name').in('id', skillIds)
    : { data: [] as { id: string; canonical_name: string }[] }
  const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))

  const skills: RecordSkill[] = skillIds
    .map((id) => {
      const d = depth.get(id)!
      return {
        skillId: id,
        name: nameById.get(id) ?? id,
        bestLevel: d.bestLevel,
        artifactCount: d.artifactCount,
        depth: d.depth,
      }
    })
    .sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name))

  const engagements: EngagementForDisplay[] = (engagementRows ?? []).map((e) => {
    const listing = e.listings as unknown as { title: string | null; poster_display_name: string | null } | null
    return {
      id: e.id,
      visibility: (e.visibility ?? 'full') as Visibility,
      stage: e.stage,
      listingTitle: listing?.title ?? null,
      posterDisplayName: listing?.poster_display_name ?? null,
      description: e.description,
      closedAt: e.closed_at,
    }
  })

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      university: student.university,
      major: student.major,
      degreeType: student.degree_type,
      graduationYear: student.graduation_year,
      handle: student.handle,
      githubUsername: student.github_username,
      linkedinUrl: student.linkedin_url,
      selfReportedSkills: student.skills ?? [],
    },
    skills,
    // Includes hidden engagements by design — see visibility.ts on why
    // aggregates over an undisclosed denominator leak nothing.
    trackRecord: computeTrackRecord(engagements.map((e) => e.stage as Stage)),
    engagements,
  }
}
