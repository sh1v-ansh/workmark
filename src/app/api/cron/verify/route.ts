import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sweepVerification } from '@/lib/workspace/run-verification'

export const dynamic = 'force-dynamic'

/**
 * 60 is the value that is safe on every Vercel plan: a deployment whose
 * maxDuration exceeds the plan limit fails to build rather than being
 * clamped. This route shipped at 300, which is fine on Pro and breaks a
 * Hobby deploy — and nothing in the repo settles which one this is.
 *
 * 60 with a bounded sweep is the choice that cannot fail either way. If the
 * project is on Pro, raising this and MAX_RUNS_PER_SWEEP together clears a
 * backlog faster; the durable fix is a background job, not a bigger number.
 */
export const maxDuration = 60

/**
 * POST /api/cron/verify — run the verification sweep on its own.
 *
 * The scheduled path is /api/cron/nightly, which runs this and then the two
 * jobs that read its verdicts. This endpoint stays for running the sweep now
 * rather than waiting for the evening, and because a job you can only trigger
 * by reading the source is one nobody triggers.
 *
 * The work itself lives in sweepVerification so the manual and scheduled
 * paths cannot drift into two different definitions of "sweep".
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const result = await sweepVerification(admin)
  return NextResponse.json({ ok: true, ...result })
}
