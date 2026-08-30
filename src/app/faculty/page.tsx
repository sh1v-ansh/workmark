import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccount, hasRole } from '@/lib/auth/roles'
import FacultyHomeClient, { type FacultyData } from './FacultyHomeClient'

/**
 * /faculty — a professor's home.
 *
 * They were landing on the student dashboard, which asks about their skills,
 * their record and their GitHub. A professor has none of those. What they
 * actually arrive with is three questions: who applied, what's in progress,
 * and is anything stuck.
 */
export default async function FacultyHomePage() {
  const supabase = await createClient()
  const account = await getAccount(supabase)
  if (!account) redirect('/login')
  // A student who wanders here belongs on their own dashboard rather than
  // an empty page about projects they never posted.
  if (!hasRole(account, 'faculty')) redirect('/student/dashboard')

  // A professor's name lives on their account row, not in `students` —
  // they don't have a student profile, and reading one here is what used to
  // leave the faculty dashboard greeting nobody.
  const { data: profileRow } = await supabase
    .from('accounts')
    .select('display_name, institution')
    .eq('id', account.id)
    .maybeSingle()

  const profile = profileRow
    ? { full_name: profileRow.display_name, university: profileRow.institution }
    : null

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, status, created_at')
    .eq('poster_id', account.id)
    .order('created_at', { ascending: false })

  const listingIds = (listings ?? []).map((l) => l.id)

  const [{ data: applications }, { data: engagements }] = listingIds.length
    ? await Promise.all([
        supabase
          .from('applications')
          .select('id, listing_id, student_id, status, fit_tier_at_apply, created_at, students(full_name)')
          .in('listing_id', listingIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('engagements')
          .select('id, listing_id, student_id, stage, opened_at, students(full_name)')
          .in('listing_id', listingIds)
          .order('opened_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  const titleById = new Map((listings ?? []).map((l) => [l.id, l.title]))

  const data: FacultyData = {
    name: profile?.full_name ?? null,
    university: profile?.university ?? null,
    verified: !!account.facultyVerifiedAt,
    listings: (listings ?? []).map((l) => ({
      id: l.id,
      title: l.title ?? 'Untitled project',
      status: l.status,
      createdAt: l.created_at,
      // The number that decides whether they need to do anything today.
      newApplicants: (applications ?? []).filter((a) => a.listing_id === l.id && a.status === 'submitted').length,
      totalApplicants: (applications ?? []).filter((a) => a.listing_id === l.id && a.status !== 'withdrawn').length,
    })),
    waiting: (applications ?? [])
      .filter((a) => a.status === 'submitted')
      .map((a) => ({
        id: a.id,
        listingId: a.listing_id,
        listingTitle: titleById.get(a.listing_id) ?? 'A project',
        studentName: (a.students as unknown as { full_name: string | null } | null)?.full_name ?? 'A student',
        fitTier: a.fit_tier_at_apply,
        appliedAt: a.created_at,
      })),
    active: (engagements ?? [])
      .filter((e) => ['accepted', 'in_progress', 'submitted'].includes(e.stage))
      .map((e) => ({
        id: e.id,
        listingTitle: titleById.get(e.listing_id) ?? 'A project',
        studentName: (e.students as unknown as { full_name: string | null } | null)?.full_name ?? 'A student',
        stage: e.stage,
        openedAt: e.opened_at,
      })),
  }

  return <FacultyHomeClient data={data} />
}
