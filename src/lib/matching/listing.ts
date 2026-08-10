// Shared loaders for listing requirements, applicant pools, and a
// student's fit. Kept out of the page files so the browse page, the
// detail page, and the apply route all compute fit the same way — a fit
// tier shown on a card and the tier frozen into an application must never
// disagree.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getStudentDepth, type SkillDepth } from './depth'
import { computeFit, assignTier, type FitResult, type FitTier, type ListingRequirement } from './fit'

export async function getListingRequirements(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, ListingRequirement[]>> {
  const out = new Map<string, ListingRequirement[]>()
  if (listingIds.length === 0) return out

  const { data, error } = await supabase
    .from('listing_requirements')
    .select('listing_id, skill_id, required_level')
    .in('listing_id', listingIds)
  if (error) throw error

  const rows = data ?? []
  const skillIds = Array.from(new Set(rows.map((r) => r.skill_id)))
  const { data: skillRows } = skillIds.length
    ? await supabase.from('skills').select('id, canonical_name').in('id', skillIds)
    : { data: [] as { id: string; canonical_name: string }[] }
  const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))

  for (const listingId of listingIds) out.set(listingId, [])
  for (const r of rows) {
    if (!out.has(r.listing_id)) out.set(r.listing_id, [])
    out.get(r.listing_id)!.push({
      skillId: r.skill_id,
      requiredLevel: r.required_level,
      canonicalName: nameById.get(r.skill_id) ?? r.skill_id,
    })
  }
  return out
}

/**
 * The live applicant pool per listing — every current applicant's frozen
 * rank_score. Withdrawn and rejected applications are excluded: the tier
 * answers "how do I compare to who I'm competing with", and someone who
 * pulled out or was already declined isn't competition.
 */
export async function getApplicantPools(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  if (listingIds.length === 0) return out
  for (const id of listingIds) out.set(id, [])

  const { data, error } = await supabase
    .from('applications')
    .select('listing_id, rank_score_at_apply')
    .in('listing_id', listingIds)
    .in('status', ['submitted', 'shortlisted', 'accepted'])
  if (error) throw error

  for (const row of data ?? []) {
    if (row.rank_score_at_apply == null) continue
    out.get(row.listing_id)?.push(Number(row.rank_score_at_apply))
  }
  return out
}

/**
 * Fit + tier for one student against many listings — one depth query and
 * one pool query total, not one per listing.
 */
export async function getFitForListings(
  supabase: SupabaseClient,
  studentId: string,
  listingIds: string[],
): Promise<{
  fitByListing: Map<string, FitResult>
  tierByListing: Map<string, FitTier>
  requirementsByListing: Map<string, ListingRequirement[]>
  depth: Map<string, SkillDepth>
}> {
  const [depth, requirementsByListing, pools] = await Promise.all([
    getStudentDepth(supabase, studentId),
    getListingRequirements(supabase, listingIds),
    getApplicantPools(supabase, listingIds),
  ])

  const fitByListing = new Map<string, FitResult>()
  const tierByListing = new Map<string, FitTier>()
  for (const listingId of listingIds) {
    const fit = computeFit(requirementsByListing.get(listingId) ?? [], depth)
    fitByListing.set(listingId, fit)
    tierByListing.set(listingId, assignTier(fit, pools.get(listingId) ?? []))
  }
  return { fitByListing, tierByListing, requirementsByListing, depth }
}
