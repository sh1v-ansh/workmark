import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rollupAll } from '@/lib/workspace/rollup'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/cron/rollups — recompute plan versus reality.
 *
 * Nightly. Nothing here costs money: no model call, no GitHub request, just
 * arithmetic over rows that already exist. It is a cron job rather than a
 * page-load computation because the figures come from every task, board move,
 * revision and submission a person has on a project — which would make the
 * page slowest for exactly the students who have done the most work.
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
