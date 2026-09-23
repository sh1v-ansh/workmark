import type { SupabaseClient } from '@supabase/supabase-js'
import { writeApplicationQuestions } from '@/lib/agents/application-questions'
import type { ListingFields } from '@/lib/listings/fields'

/**
 * Create and open a posting. Shared by the posting form (/api/listings) and
 * "make this project public" (/api/workspaces/[id]/publish), so both go
 * through exactly the same steps.
 *
 * Runs as the poster's own session: the listing and requirement insert
 * policies are poster-scoped, so RLS is the authorization check.
 *
 * The two inserts are not one transaction (PostgREST has none across
 * requests), so a listing is created as 'draft' and only opened once its
 * requirements land. A failure part-way leaves an invisible draft rather
 * than a live listing that matches everybody.
 */
export async function createListing(
  supabase: SupabaseClient,
  poster: { id: string; name: string | null; isFaculty: boolean },
  fields: ListingFields,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { title, brief, requirements, ...details } = fields

  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .insert({
      poster_id: poster.id,
      poster_type: poster.isFaculty ? 'faculty' : 'student',
      // A course or research project is a different kind of work from one
      // student hiring another, and is weighted differently.
      tier: poster.isFaculty ? 'faculty_project' : 'listing_driven',
      poster_display_name: poster.name,
      title,
      brief,
      ...details,
      status: 'draft',
    })
    .select('id')
    .single()
  if (listingErr || !listing) {
    console.error('[listings/create] listing insert failed:', listingErr)
    return { ok: false, error: 'Could not create the listing.' }
  }

  const { error: reqErr } = await supabase.from('listing_requirements').insert(
    requirements.map((r) => ({ listing_id: listing.id, skill_id: r.skillId, required_level: r.requiredLevel })),
  )
  if (reqErr) {
    console.error('[listings/create] requirements insert failed:', reqErr)
    return { ok: false, error: 'Could not save the required skills. The listing was saved as a draft.' }
  }

  // The two questions applicants answer, written once per listing rather
  // than once per applicant. Best-effort: a listing must never be
  // unpostable because a model call was slow or refused, and the standard
  // pair is served when this is null.
  let applicationQuestions = null
  try {
    applicationQuestions = await writeApplicationQuestions(supabase, poster.id, {
      title,
      description: brief,
      requirements: requirements.map((r) => String(r.skillId)),
    })
  } catch (err) {
    console.error('[listings/create] could not write application questions:', err)
  }

  const { error: openErr } = await supabase
    .from('listings')
    .update({ status: 'open', application_questions: applicationQuestions })
    .eq('id', listing.id)
  if (openErr) {
    console.error('[listings/create] publish failed:', openErr)
    return { ok: false, error: 'The listing was saved as a draft but could not be published.' }
  }

  return { ok: true, id: listing.id }
}
