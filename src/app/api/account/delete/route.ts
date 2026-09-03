import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requestDeletion, restoreAccount } from '@/lib/account/deletion'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/account/delete   { confirm: 'DELETE' }
 *
 * Starts the seven-day deletion. Requires the typed confirmation as well as
 * a signed-in session — this is the one action on the platform that can't
 * be walked back after the week, so a stray click shouldn't reach it.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { confirm?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  if (body.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  }

  const result = await requestDeletion(serviceClient(), user.id)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 })

  return NextResponse.json({ ok: true, purgesAt: result.state.purgesAt })
}

/**
 * DELETE /api/account/delete
 *
 * Cancel the deletion, inside the week. Named as the reverse of the POST
 * rather than getting its own route, since the two are the same decision.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const result = await restoreAccount(serviceClient(), user.id)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
