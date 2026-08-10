// Shared loaders for listing requirements + a student's fit against them.
// Kept out of the page files so the browse page, the detail page, and the
// apply route all compute fit the exact same way — a fit tier shown on a
// card and the fit tier frozen into the application must never disagree.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getStudentDepth, type SkillDepth } from './depth'
import { computeFit, type FitResult, type ListingRequirement } from './fit'

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
 * Fit for one student against many listings — one depth query total, not
 * one per listing.
 */
export async function getFitForListings(
  supabase: SupabaseClient,
  studentId: string,
  listingIds: string[],
): Promise<{ fitByListing: Map<string, FitResult>; requirementsByListing: Map<string, ListingRequirement[]>; depth: Map<string, SkillDepth> }> {
  const [depth, requirementsByListing] = await Promise.all([
    getStudentDepth(supabase, studentId),
    getListingRequirements(supabase, listingIds),
  ])
  const fitByListing = new Map<string, FitResult>()
  for (const listingId of listingIds) {
    fitByListing.set(listingId, computeFit(requirementsByListing.get(listingId) ?? [], depth))
  }
  return { fitByListing, requirementsByListing, depth }
}
