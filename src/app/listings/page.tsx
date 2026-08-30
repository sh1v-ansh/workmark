import { createClient } from '@/lib/supabase/server'
import { getFitForListings } from '@/lib/matching/listing'
import type { FitTier } from '@/lib/matching/fit'
import ListingsClient, { type ListingCardData } from './ListingsClient'
import { verifiedFacultyPosterIds } from '@/lib/listings/verified-faculty'

/**
 * Open listings. Visible to everyone including logged-out visitors —
 * presence gates applying, never seeing (§7). Signed-in students
 * additionally get a fit badge per listing, computed from their own
 * evidence.
 */
export default async function ListingsPage() {
  const supabase = await createClient()

  // getUser() and the listings query are independent — the listings query
  // doesn't need to know who's asking — so they go out together instead of
  // one after the other. Each is its own network round trip, and the
  // second one waiting on the first was pure added latency on every visit
  // to this page, signed in or not.
  const [{ data: { user } }, { data: listings }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('listings')
      .select('id, poster_id, poster_display_name, title, brief, est_hours, hours_per_week, duration, work_mode, team_size, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ])

  const rows = listings ?? []
  const listingIds = rows.map((l) => l.id)

  // Which posters are faculty we've actually confirmed. Unconfirmed claims
  // aren't in this set and get no badge — see lib/listings/verified-faculty.
  const verifiedFaculty = await verifiedFacultyPosterIds(supabase, rows.map((l) => l.poster_id))

  let student: { full_name: string | null } | null = null
  let fitByListing = new Map<string, { missingSkillIds: string[] }>()
  let tierByListing = new Map<string, FitTier>()
  let requirementsByListing = new Map<string, { skillId: string; canonicalName?: string }[]>()

  if (user) {
    const { data: s } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
    student = s
  }

  if (listingIds.length > 0) {
    if (user && student) {
      const result = await getFitForListings(supabase, user.id, listingIds)
      fitByListing = result.fitByListing
      tierByListing = result.tierByListing
      requirementsByListing = result.requirementsByListing
    } else {
      const { getListingRequirements } = await import('@/lib/matching/listing')
      requirementsByListing = await getListingRequirements(supabase, listingIds)
    }
  }

  const cards: ListingCardData[] = rows.map((l) => {
    const fit = fitByListing.get(l.id)
    const reqs = requirementsByListing.get(l.id) ?? []
    return {
      id: l.id,
      title: l.title,
      brief: l.brief,
      posterDisplayName: l.poster_display_name,
      posterIsVerifiedFaculty: verifiedFaculty.has(l.poster_id),
      isOwn: !!user && l.poster_id === user.id,
      estHours: l.est_hours,
      hoursPerWeek: l.hours_per_week,
      duration: l.duration,
      workMode: l.work_mode,
      teamSize: l.team_size,
      createdAt: l.created_at,
      skills: reqs.map((r) => r.canonicalName ?? r.skillId),
      fitTier: tierByListing.get(l.id) ?? null,
      missingCount: fit?.missingSkillIds.length ?? 0,
    }
  })

  return <ListingsClient listings={cards} signedIn={!!user} studentName={student?.full_name ?? null} />
}
