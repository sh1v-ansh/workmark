import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rollupAll } from '@/lib/workspace/rollup'

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
 * POST /api/cron/rollups — recompute plan versus reality, by hand.
 *
 * Nothing here costs money: no model call, no GitHub request, just arithmetic
 * over rows that already exist. It is a job rather than a page-load
 * computation because the figures come from every task, board move, revision
 * and submission a person has on a project — which would make the page
 * slowest for exactly the students who have done the most work.
 *
 * The scheduled path is /api/cron/nightly, which runs this *after* the
 * verification sweep so the day's verdicts are in the figures. This endpoint
 * is for running it now.
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

  try {
    const result = await rollupAll(admin)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/rollups] failed:', err)
    return NextResponse.json({ error: 'Rollup failed.' }, { status: 500 })
  }
}
