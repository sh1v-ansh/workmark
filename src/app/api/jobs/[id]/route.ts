import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/jobs/[id]
 *
 * Progress for the polling UI. Runs under the student's own session, so
 * the "Students: read own jobs" RLS policy is what enforces ownership —
 * there is no service-role client here on purpose. A student asking for
 * someone else's job id gets the same 404 as one asking for a job that
 * doesn't exist, which is the correct amount of information to give.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: job } = await supabase
    .from('jobs')
    .select('id, kind, status, steps, total_steps, completed_steps, result, error, created_at, finished_at')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  return NextResponse.json({ job })
}
