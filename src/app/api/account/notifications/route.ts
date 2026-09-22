import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'
import { setConsent } from '@/lib/notify/marketing'

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

  let body: { prefs?: Record<string, unknown>; unsubscribeAll?: boolean; marketingOptIn?: unknown }
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

  // Written separately, and only when the request actually carries a
  // decision. Marketing consent is not a notification preference: the map
  // above treats an absent key as yes, which is the right default for "we
  // told you somebody applied to your project" and would be an invented
  // consent here. It also has to record the wording and the moment, which
  // notification_prefs has nowhere to put.
  //
  // Withdrawal has to be as easy as the giving (GDPR Art. 7(3)) — which is
  // why it is the same toggle in the same place, and not an email to
  // support.
  if (typeof body.marketingOptIn === 'boolean') {
    try {
      await setConsent(admin, user.id, body.marketingOptIn, 'settings')
    } catch (err) {
      console.error('[api/account/notifications] consent write failed:', err)
      return NextResponse.json({ error: 'Could not save your settings.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
