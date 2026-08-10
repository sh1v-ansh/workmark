import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApplicantsClient, { type ApplicantRow } from './ApplicantsClient'
import type { FitTier } from '@/lib/matching/fit'

/**
 * Poster's applicant inbox, ranked.
 *
 * Ranking uses rank_score_at_apply — the value frozen when the student
 * applied — rather than recomputing live. Two reasons, both load-bearing:
 * that frozen score is what the student consented to disclose and what
 * disclosure_log recorded, so recomputing would be a fresh, unlogged
 * disclosure on every page view; and it's the value any later dispute
 * about this decision would be reinvestigated against.
 */
export default async function ApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, poster_id, title, status')
    .eq('id', id)
    .maybeSingle()
  if (!listing) notFound()
  if (listing.poster_id !== user.id) redirect(`/listings/${id}`)

  const { data: student } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()

  const { data: applications } = await supabase
    .from('applications')
    .select('id, student_id, status, response_text, fit_tier_at_apply, rank_score_at_apply, computed_snapshot, created_at')
    .eq('listing_id', id)
    .order('rank_score_at_apply', { ascending: false, nullsFirst: false })

  const apps = applications ?? []
  const studentIds = Array.from(new Set(apps.map((a) => a.student_id)))

  // Self-reported profile basics only — the comparative/evidence detail a
  // poster is entitled to is what the applicant consented to disclose,
  // which is already frozen in computed_snapshot.
  const { data: profiles } = studentIds.length
    ? await supabase.from('students').select('id, full_name, university, major, graduation_year, github_username').in('id', studentIds)
    : { data: [] as { id: string; full_name: string | null; university: string | null; major: string | null; graduation_year: number | null; github_username: string | null }[] }
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  const { data: shares } = apps.length
    ? await supabase.from('contact_shares').select('application_id, student_email').in('application_id', apps.map((a) => a.id))
    : { data: [] as { application_id: string; student_email: string | null }[] }
  const emailByApplication = new Map((shares ?? []).map((s) => [s.application_id, s.student_email]))

  const rows: ApplicantRow[] = apps.map((a) => {
    const snapshot = (a.computed_snapshot ?? {}) as {
      per_skill?: { skillId: string; requiredLevel: number; depth: number; present: boolean }[]
      missing_skill_ids?: string[]
    }
    const profile = profileById.get(a.student_id)
    return {
      id: a.id,
      studentId: a.student_id,
      fullName: profile?.full_name ?? 'Applicant',
      university: profile?.university ?? null,
      major: profile?.major ?? null,
      graduationYear: profile?.graduation_year ?? null,
      githubUsername: profile?.github_username ?? null,
      status: a.status,
      responseText: a.response_text,
      fitTier: (a.fit_tier_at_apply as FitTier | null) ?? null,
      rankScore: a.rank_score_at_apply,
      perSkill: snapshot.per_skill ?? [],
      missingCount: snapshot.missing_skill_ids?.length ?? 0,
      createdAt: a.created_at,
      studentEmail: emailByApplication.get(a.id) ?? null,
    }
  })

  return (
    <ApplicantsClient
      listing={{ id: listing.id, title: listing.title, status: listing.status }}
      applicants={rows}
      currentUserId={user.id}
      posterName={student?.full_name ?? null}
    />
  )
}
