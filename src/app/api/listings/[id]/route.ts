import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { parseBody, requireUuid, ValidationError } from '@/lib/http/validate'
import { parseListingFields } from '@/lib/listings/fields'

/**
 * PATCH  /api/listings/[id] — edit a posted project.
 * DELETE /api/listings/[id] — take it down.
 *
 * Both run as the poster's own session, so RLS ("Posters: update/delete own
 * listings", "manage requirements for own listings") is what actually
 * decides. The ownership read below exists to give a sentence instead of a
 * silent zero-row no-op.
 */

async function ownListing(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) } as const

  const limited = await enforce('listingEdit', user.id)
  if (limited) return { error: limited } as const

  const { data: listing } = await supabase
    .from('listings')
    .select('id, poster_id, title, brief, status')
    .eq('id', id)
    .maybeSingle()
  if (!listing || listing.poster_id !== user.id) {
    return { error: NextResponse.json({ error: 'That project is not yours to change.' }, { status: 404 }) } as const
  }
  return { supabase, user, listing } as const
}

function listingId(raw: string): string | NextResponse {
  try {
    return requireUuid(raw, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = listingId((await params).id)
  if (typeof id !== 'string') return id

  const found = await ownListing(id)
  if ('error' in found) return found.error
  const { supabase, user, listing } = found

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const fields = parseListingFields(parsed.body)
  if (!fields.ok) return fields.response
  const { requirements, ...columns } = fields.values

  const { data: before } = await supabase
    .from('listing_requirements')
    .select('skill_id, required_level')
    .eq('listing_id', id)

  // New set first, stale rows second. Deleting first would leave a moment —
  // or, if the insert then failed, a permanent state — with no requirements,
  // and a listing with no requirements matches everybody.
  const { error: upsertErr } = await supabase
    .from('listing_requirements')
    .upsert(
      requirements.map((r) => ({ listing_id: id, skill_id: r.skillId, required_level: r.requiredLevel })),
      { onConflict: 'listing_id,skill_id' },
    )
  if (upsertErr) {
    console.error('[api/listings/id] requirements upsert failed:', upsertErr)
    return NextResponse.json({ error: 'Could not save the required skills. Nothing was changed.' }, { status: 500 })
  }
  const keep = new Set(requirements.map((r) => r.skillId))
  const stale = (before ?? []).map((r) => r.skill_id as string).filter((s) => !keep.has(s))
  if (stale.length > 0) {
    const { error } = await supabase.from('listing_requirements').delete().eq('listing_id', id).in('skill_id', stale)
    if (error) console.error('[api/listings/id] stale requirement delete failed:', error)
  }

  // Questions are the poster's own (or null for the standard pair) and
  // come in with the other columns; nothing is rewritten behind their back.
  const update: Record<string, unknown> = { ...columns }

  const { error } = await supabase.from('listings').update(update).eq('id', id)
  if (error) {
    console.error('[api/listings/id] update failed:', error)
    return NextResponse.json({ error: 'Could not save your changes.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Nobody applied → the listing is deleted outright.
 * Somebody applied → it is closed instead.
 *
 * Deleting cascades through applications and engagements. An applicant's
 * application — their answers, and the record that they applied — would
 * vanish without a word, and an engagement already under way would lose
 * its listing. Closing takes it out of search and stops new applications,
 * which is everything the poster actually wants, without erasing anybody
 * else's history.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = listingId((await params).id)
  if (typeof id !== 'string') return id

  const found = await ownListing(id)
  if ('error' in found) return found.error
  const { supabase } = found

  const { count, error: countErr } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id)
  if (countErr) {
    // Unknown is treated as "somebody applied": the safe mistake is closing
    // a listing that could have been deleted, never the reverse.
    console.error('[api/listings/id] application count failed:', countErr)
  }

  if (!countErr && (count ?? 0) === 0) {
    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (error) {
      console.error('[api/listings/id] delete failed:', error)
      return NextResponse.json({ error: 'Could not delete the project.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, outcome: 'deleted' })
  }

  const { error } = await supabase.from('listings').update({ status: 'closed' }).eq('id', id)
  if (error) {
    console.error('[api/listings/id] close failed:', error)
    return NextResponse.json({ error: 'Could not close the project.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, outcome: 'closed' })
}
