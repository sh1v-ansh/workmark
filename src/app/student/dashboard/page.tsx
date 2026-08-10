import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentDashboardClient, { type DashboardData } from './StudentDashboardClient'

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, university, major, degree_type, graduation_year, github_username, active_application_count')
    .eq('id', user.id)
    .maybeSingle()
  if (!student) redirect('/onboarding')

  const [
    { data: myApplications },
    { data: myListings },
    { data: myEngagements },
    { data: evidenceRows },
    { data: connection },
  ] = await Promise.all([
    supabase
      .from('applications')
      .select('id, listing_id, status, fit_tier_at_apply, created_at, listings(title, poster_display_name)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, title, status, created_at')
      .eq('poster_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('engagements')
      .select('id, listing_id, stage, student_id, poster_id, opened_at, listings(title)')
      .or(`student_id.eq.${user.id},poster_id.eq.${user.id}`)
      .order('opened_at', { ascending: false }),
    supabase
      .from('current_skill_evidence')
      .select('skill_id, difficulty_cleared')
      .eq('student_id', user.id),
    supabase.from('github_connections').select('student_id').eq('student_id', user.id).maybeSingle(),
  ])

  // Applicant counts for the listings this student posted — a poster's
  // most useful number on landing here.
  const listingIds = (myListings ?? []).map((l) => l.id)
  const applicantCountByListing = new Map<string, number>()
  if (listingIds.length > 0) {
    const { data: counts } = await supabase
      .from('applications')
      .select('listing_id')
      .in('listing_id', listingIds)
      .neq('status', 'withdrawn')
    for (const row of counts ?? []) {
      applicantCountByListing.set(row.listing_id, (applicantCountByListing.get(row.listing_id) ?? 0) + 1)
    }
  }

  // Best level per skill — the dashboard summary, not the full record
  // (that lives on /student/github).
  const bestBySkill = new Map<string, number>()
  for (const row of evidenceRows ?? []) {
    const current = bestBySkill.get(row.skill_id) ?? 0
    if (row.difficulty_cleared > current) bestBySkill.set(row.skill_id, row.difficulty_cleared)
  }
  const skillIds = Array.from(bestBySkill.keys())
  const { data: skillRows } = skillIds.length
    ? await supabase.from('skills').select('id, canonical_name').in('id', skillIds)
    : { data: [] as { id: string; canonical_name: string }[] }
  const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))

  const data: DashboardData = {
    student: {
      fullName: student.full_name,
      university: student.university,
      major: student.major,
      degreeType: student.degree_type,
      graduationYear: student.graduation_year,
      githubUsername: student.github_username,
      activeApplicationCount: student.active_application_count ?? 0,
    },
    githubConnected: !!connection,
    skills: skillIds
      .map((id) => ({ skillId: id, name: nameById.get(id) ?? id, bestLevel: bestBySkill.get(id) ?? 0 }))
      .sort((a, b) => b.bestLevel - a.bestLevel || a.name.localeCompare(b.name)),
    applications: (myApplications ?? []).map((a) => {
      const l = a.listings as unknown as { title: string | null; poster_display_name: string | null } | null
      return {
        id: a.id,
        listingId: a.listing_id,
        title: l?.title ?? 'Untitled project',
        posterName: l?.poster_display_name ?? null,
        status: a.status,
        fitTier: a.fit_tier_at_apply,
        createdAt: a.created_at,
      }
    }),
    listings: (myListings ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      status: l.status,
      createdAt: l.created_at,
      applicantCount: applicantCountByListing.get(l.id) ?? 0,
    })),
    engagements: (myEngagements ?? []).map((e) => {
      const l = e.listings as unknown as { title: string | null } | null
      return {
        id: e.id,
        listingId: e.listing_id,
        title: l?.title ?? 'Untitled project',
        stage: e.stage,
        asPoster: e.poster_id === user.id,
        openedAt: e.opened_at,
      }
    }),
  }

  return <StudentDashboardClient data={data} />
}
