import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cleanProps, isEventName } from '@/lib/analytics/events'
import { enforce } from '@/lib/rate-limit'
import { clientIp } from '@/lib/http/request-ip'

/**
 * POST /api/events  { name, sessionId?, props? }
 *
 * ── Why this route exists rather than an insert policy ────────────────────
 * The events table has RLS on and no policies, so nothing writes to it from
 * a browser. This is the only door, and it checks three things a policy
 * cannot: that the name is one we defined, that the props are small and
 * flat, and that whoever is asking has not sent four hundred of them this
 * minute.
 *
 * ── Why it never fails loudly ─────────────────────────────────────────────
 * Analytics must not be able to break a page. Every outcome here is 204,
 * including a rejected name — the caller has nothing useful to do with the
 * failure, and a client that retries a rejected event is worse than one that
 * drops it. What goes wrong is logged, not returned.
 *
 * ── Why the student id is not taken from the body ─────────────────────────
 * It is read from the session. An id a client supplies is an id a client can
 * change, and an events table somebody can write into another person's name
 * is worse than no events table.
 */
export async function POST(request: Request) {
  // Sent with keepalive on pages that are unloading, so the body is small
  // and the answer is discarded. 204 throughout.
  const ok = () => new NextResponse(null, { status: 204 })

  try {
    const body = await request.json().catch(() => null)
    if (!body || !isEventName(body.name)) {
      if (body?.name) console.warn('[events] unknown event name:', String(body.name).slice(0, 40))
      return ok()
    }

    // Per IP, not per student — most of the events worth having happen
    // before anybody is signed in. Generous, because a busy page legitimately
    // sends a handful and the point is to stop a loop, not to ration.
    const limited = await enforce('events', clientIp(request))
    if (limited) return ok()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await admin.from('events').insert({
      student_id: user?.id ?? null,
      session_id: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : null,
      name: body.name,
      props: cleanProps(body.props),
    })
    if (error) console.error('[events] insert failed:', error.message)
  } catch (err) {
    console.error('[events] failed:', err instanceof Error ? err.message : err)
  }

  return ok()
}
