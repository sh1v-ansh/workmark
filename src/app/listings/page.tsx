import { createClient } from '@/lib/supabase/server'
import { getFitForListings } from '@/lib/matching/listing'
import type { FitTier } from '@/lib/matching/fit'
import ListingsClient, { type ListingCardData } from './ListingsClient'

/**
 * Open listings. Visible to everyone including logged-out visitors —
 * presence gates applying, never seeing (§7). Signed-in students
 * additionally get a fit badge per listing, computed from their own
 * evidence.
 */
export default async function ListingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, poster_id, poster_display_name, title, brief, est_hours, hours_per_week, duration, work_mode, team_size, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const rows = listings ?? []
  const listingIds = rows.map((l) => l.id)

  let student: { full_name: string | null } | null = null
  let fitByListing = new Map<string, { tier: FitTier; missingSkillIds: string[] }>()
  let requirementsByListing = new Map<string, { skillId: string; canonicalName?: string }[]>()

  if (user) {
    const { data: s } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
    student = s
  }

  if (listingIds.length > 0) {
    if (user && student) {
      const result = await getFitForListings(supabase, user.id, listingIds)
      fitByListing = result.fitByListing
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
      isOwn: !!user && l.poster_id === user.id,
      estHours: l.est_hours,
      hoursPerWeek: l.hours_per_week,
      duration: l.duration,
      workMode: l.work_mode,
      teamSize: l.team_size,
      createdAt: l.created_at,
      skills: reqs.map((r) => r.canonicalName ?? r.skillId),
      fitTier: fit?.tier ?? null,
      missingCount: fit?.missingSkillIds.length ?? 0,
    }
  })

  return <ListingsClient listings={cards} signedIn={!!user} studentName={student?.full_name ?? null} />
}
