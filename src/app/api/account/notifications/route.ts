import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'

/**
 * POST /api/account/notifications  { prefs, unsubscribeAll }
 *
 * Saves email preferences. Service role because `accounts` has no
 * user-facing update policy — a row that says what someone is allowed to be
 * must not be writable from the browser, so the narrow, checked write lives
 * here instead.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { prefs?: Record<string, unknown>; unsubscribeAll?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  // Rebuilt from the known kinds rather than stored as sent. Otherwise the
  // column becomes a place a client can write arbitrary json, and an
  // essential notification could be switched off by posting straight here.
  const prefs: Record<string, boolean> = {}
  for (const kind of Object.keys(EMAIL_KINDS) as EmailKind[]) {
    if (EMAIL_KINDS[kind].essential) continue
    if (body.prefs?.[kind] === false) prefs[kind] = false
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await admin
    .from('accounts')
    .update({
      notification_prefs: prefs,
      email_unsubscribed_at: body.unsubscribeAll ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('[api/account/notifications] save failed:', error)
    return NextResponse.json({ error: 'Could not save your settings.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
