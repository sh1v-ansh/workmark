import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  const { data: student } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
  if (!student) return NextResponse.json({ error: 'Complete your profile before posting.' }, { status: 400 })

  let body: {
    title?: string
    brief?: string
    est_hours?: number | null
    hours_per_week?: number | null
    duration?: string | null
    work_mode?: string | null
    team_size?: number | null
    declared_difficulty?: number | null
    requirements?: { skillId: string; requiredLevel: number }[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const title = body.title?.trim()
  const brief = body.brief?.trim()
  if (!title) return NextResponse.json({ error: 'A title is required.' }, { status: 400 })
  if (!brief) return NextResponse.json({ error: 'A brief is required.' }, { status: 400 })

  const requirements = (body.requirements ?? []).filter((r) => r.skillId && r.requiredLevel >= 1 && r.requiredLevel <= 5)
  if (requirements.length === 0) {
    return NextResponse.json({ error: 'Add at least one required skill so applicants can be matched.' }, { status: 400 })
  }

  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .insert({
      poster_id: user.id,
      poster_type: 'student',
      poster_display_name: student.full_name,
      title,
      brief,
      est_hours: body.est_hours ?? null,
      hours_per_week: body.hours_per_week ?? null,
      duration: body.duration ?? null,
      work_mode: body.work_mode ?? null,
      team_size: body.team_size ?? null,
      declared_difficulty: body.declared_difficulty ?? null,
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

  const { error: openErr } = await supabase.from('listings').update({ status: 'open' }).eq('id', listing.id)
  if (openErr) {
    console.error('[api/listings] publish failed:', openErr)
    return NextResponse.json({ error: 'The listing was saved as a draft but could not be published.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: listing.id })
}
