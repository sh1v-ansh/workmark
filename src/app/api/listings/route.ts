import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createListing } from '@/lib/listings/create'
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
  // Read from the account rather than hardcoded, so faculty post as
  // faculty (course and research projects) and students as students.
  const result = await createListing(
    supabase,
    { id: user.id, name: posterName, isFaculty: hasRole(account, 'faculty') },
    fields.values,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, id: result.id })
}
