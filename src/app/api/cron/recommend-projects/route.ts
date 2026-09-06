import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runRecommendationSweep } from '@/lib/briefs/recommend'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/cron/recommend-projects
 *
 * Nightly. Tops every eligible student up to three unstarted project
 * recommendations, so Find work has something on it for a student nobody
 * has posted a matching project for yet.
 *
 * Service role, because it writes briefs on behalf of students who are
 * asleep. It is the only thing in the product that spends money without a
 * person having clicked something, which is why the spending decisions —
 * who is eligible, how many, how often — all live in one readable place in
 * lib/briefs/recommend.ts rather than being spread through this handler.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/recommend-projects] CRON_SECRET is not set')
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const summary = await runRecommendationSweep(admin)
    console.log('[cron/recommend-projects]', summary)
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    // A failed night is not an incident. The next run tops up whoever was
    // missed, because the job asks "who is below three" rather than "who
    // did I do yesterday" — there is no cursor to lose.
    console.error('[cron/recommend-projects] sweep failed:', err)
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 })
  }
}
