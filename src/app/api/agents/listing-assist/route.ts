import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { draftListing } from '@/lib/agents/listing-assist'
import { agentsAvailable } from '@/lib/agents/client'

/**
 * POST /api/agents/listing-assist
 *
 * Returns a DRAFT. It does not create a listing — the poster reviews,
 * edits, and submits through the normal /api/listings path, which is the
 * only thing that writes. An agent proposing a listing and an agent
 * publishing one are different products; this is the first.
 *
 * Service-role only for the agent_calls write (no user insert policy —
 * it's an audit record about the call, not something a user authors).
 * The taxonomy read it also does is public to signed-in users anyway.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Drafting help is not configured on this deployment. Write your listing directly.' },
      { status: 503 },
    )
  }

  let body: { description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const description = body.description?.trim()
  if (!description || description.length < 20) {
    return NextResponse.json(
      { error: 'Describe the project in a sentence or two first — there is nothing to work from yet.' },
      { status: 400 },
    )
  }
  if (description.length > 4000) {
    return NextResponse.json({ error: 'That description is too long — trim it to the essentials.' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const draft = await draftListing(admin, user.id, description)
    if (!draft) {
      return NextResponse.json(
        { error: 'Could not draft a listing from that. Try describing the project differently, or write it yourself.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true, draft })
  } catch (err) {
    console.error('[api/agents/listing-assist] failed:', err)
    return NextResponse.json({ error: 'Drafting failed. Write your listing directly.' }, { status: 500 })
  }
}
