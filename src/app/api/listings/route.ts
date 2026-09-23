import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeApplicationQuestions } from '@/lib/agents/application-questions'
import { getAccount, hasRole } from '@/lib/auth/roles'
import { parseBody } from '@/lib/http/validate'
import { parseListingFields } from '@/lib/listings/fields'

/**
 * POST /api/listings
 *
 * Creates a listing + its requirements. Runs as the student's own session
 * (not service-role) — listings and listing_requirements both have
 * poster-scoped insert policies, so RLS is the authorization check here
 * rather than something this route has to re-implement.
 *
 * The two inserts aren't in a transaction (PostgREST has no cross-request
 * transaction), so a requirements failure would otherwise leave a listing
 * with no requirements — one that matches everybody. It's created as
 * 'draft' and only flipped to 'open' once requirements land, which makes
 * the failure mode an invisible draft rather than a live broken listing.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const account = await getAccount(supabase)
  if (!account) return NextResponse.json({ error: 'Complete your profile before posting.' }, { status: 400 })

  // Faculty have no students row by design, so the name has to come from
  // wherever the poster's name actually lives. Requiring a students row
  // here meant no professor could post at all.
  const [{ data: student }, { data: accountRow }] = await Promise.all([
    supabase.from('students').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('accounts').select('display_name').eq('id', user.id).maybeSingle(),
  ])
  const posterName = student?.full_name ?? accountRow?.display_name ?? null

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const fields = parseListingFields(parsed.body)
  if (!fields.ok) return fields.response
  const { title, brief, requirements, ...details } = fields.values

  // Read from the account rather than hardcoded. A faculty account could
  // previously log in and post nothing, because this said 'student' and the
  // database rejected anything else — so the account type existed and meant
  // nothing.
  const isFaculty = hasRole(account, 'faculty')

  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .insert({
      poster_id: user.id,
      poster_type: isFaculty ? 'faculty' : 'student',
      // A course or research project is a different kind of work from one
      // student hiring another, and is weighted differently once
      // attestation exists.
      tier: isFaculty ? 'faculty_project' : 'listing_driven',
      poster_display_name: posterName,
      title,
      brief,
      ...details,
      status: 'draft',
    })
    .select('id')
    .single()
  if (listingErr) {
    console.error('[api/listings] listing insert failed:', listingErr)
    return NextResponse.json({ error: 'Could not create the listing.' }, { status: 500 })
  }

  const { error: reqErr } = await supabase.from('listing_requirements').insert(
    requirements.map((r) => ({ listing_id: listing.id, skill_id: r.skillId, required_level: r.requiredLevel })),
  )
  if (reqErr) {
    console.error('[api/listings] requirements insert failed:', reqErr)
    // Leave the draft behind rather than deleting — the poster can see and
    // retry it, and a failed cleanup would be worse than a stale draft.
    return NextResponse.json({ error: 'Could not save the required skills. The listing was saved as a draft.' }, { status: 500 })
  }

  // The two questions applicants answer, written against this listing.
  //
  // Once per listing rather than once per applicant, which is the difference
  // between a few hundred calls a year and one every time somebody clicks
  // Apply. Best-effort and deliberately not awaited into the failure path: a
  // listing must never be unpostable because a model call was slow or
  // refused, and questionsFor() serves a good standard pair when this is
  // null rather than a placeholder.
  let applicationQuestions = null
  try {
    applicationQuestions = await writeApplicationQuestions(supabase, user.id, {
      title,
      description: brief,
      requirements: requirements.map((r) => String(r.skillId)),
    })
  } catch (err) {
    console.error('[api/listings] could not write application questions:', err)
  }

  const { error: openErr } = await supabase
    .from('listings')
    .update({ status: 'open', application_questions: applicationQuestions })
    .eq('id', listing.id)
  if (openErr) {
    console.error('[api/listings] publish failed:', openErr)
    return NextResponse.json({ error: 'The listing was saved as a draft but could not be published.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: listing.id })
}
