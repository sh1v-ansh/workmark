import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sweepVerification } from '@/lib/workspace/run-verification'
import { rollupAll } from '@/lib/workspace/rollup'
import { sweepWorkspaceEvidence } from '@/lib/workspace/evidence'

export const dynamic = 'force-dynamic'

/**
 * 60 is the value that is safe on every Vercel plan: a deployment whose
 * maxDuration exceeds the plan limit fails to build rather than being
 * clamped, and nothing in the repo settles which plan this project is on.
 *
 * 60 with a bounded sweep is the choice that cannot fail either way. If the
 * project is on Pro, raising this and MAX_RUNS_PER_SWEEP together clears a
 * backlog faster; the durable fix is a background job, not a bigger number.
 */
export const maxDuration = 60

/**
 * POST /api/cron/nightly — the evening pass over every project.
 *
 * Driven by pg_cron, like every other scheduled job here. v05_0016 moved
 * scheduling into the database on purpose — Vercel's Hobby plan allows one
 * run per day, which is useless as a recovery mechanism — and pg_net issues
 * POST, which is why every /api/cron route in this codebase is a POST
 * handler. `request_nightly_workspace_pass()` in v05_0036 is what calls this.
 *
 * One endpoint rather than three schedules because the order is a real
 * dependency, not a preference:
 *
 *   verify, then mint evidence, then rollups
 *
 * Verification first because the other two read its verdicts. Minting second
 * because a project that closed while GitHub was slow has a record owed to
 * somebody and nothing else will notice. Rollups last: they turn a day of
 * board moves into plan-versus-reality figures, and run before the verdicts
 * land they would describe a day in which nothing was ever verified — every
 * student's technical figures a day stale, for as long as the schedule stayed
 * wrong. Cheap to get right once; very hard to notice afterwards.
 *
 * Staggering three separate pg_cron entries by a few minutes would express
 * that ordering as a hope about clock time. One call expresses it as
 * sequence.
 *
 * Every part is bounded and resumable. Whatever a night does not reach stays
 * claimable and goes the next night, so a slow evening delays work rather
 * than losing it.
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

  // Each half reports its own failure rather than taking the other down with
  // it. Rollups are pure arithmetic over rows that already exist; there is no
  // reason a failed model call should also cost the night's figures.
  let verification: unknown = null
  let verifyError: string | null = null
  try {
    verification = await sweepVerification(admin)
  } catch (err) {
    verifyError = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/nightly] verification sweep failed:', err)
  }

  let evidence: unknown = null
  let evidenceError: string | null = null
  try {
    evidence = await sweepWorkspaceEvidence(admin)
  } catch (err) {
    evidenceError = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/nightly] evidence sweep failed:', err)
  }

  let rollups: unknown = null
  let rollupError: string | null = null
  try {
    rollups = await rollupAll(admin)
  } catch (err) {
    rollupError = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/nightly] rollups failed:', err)
  }

  // 200 even when a part failed. pg_net is fire-and-forget and reads nothing
  // back, so a status code here reaches nobody — the body is for a person
  // running it by hand, and the console is where a failure is actually found.
  return NextResponse.json({
    ok: !verifyError && !evidenceError && !rollupError,
    verification: verification ?? { error: verifyError },
    evidence: evidence ?? { error: evidenceError },
    rollups: rollups ?? { error: rollupError },
  })
}
