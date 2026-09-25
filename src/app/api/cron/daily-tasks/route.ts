import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { BATCH_HOUR, localNow, releaseDailyBatch } from '@/lib/workspace/daily'
import { notifyDailyBatch } from '@/lib/workspace/notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/daily-tasks — the morning batch. Called hourly by pg_cron
 * (v05_0061). For every active project on a daily pace where it is past
 * 8:00 locally and today's batch has not gone out, release it and email.
 * Running twice in an hour does nothing the second time.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: workspaces, error } = await admin
    .from('workspaces')
    .select('id, timezone, last_batch_on')
    .eq('pace', 'daily')
    .eq('status', 'active')
  if (error) {
    console.error('[cron/daily-tasks] read failed:', error)
    return NextResponse.json({ error: 'Could not read projects.' }, { status: 500 })
  }

  let batches = 0
  for (const w of workspaces ?? []) {
    const { date, hour } = localNow(w.timezone as string | null)
    if (hour < BATCH_HOUR || (w.last_batch_on && w.last_batch_on >= date)) continue
    try {
      const released = await releaseDailyBatch(admin, w.id as string, date)
      if (released.length > 0) {
        batches++
        const { count } = await admin.from('tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', w.id).eq('status', 'backlog').is('parent_task_id', null)
        await notifyDailyBatch(admin, { workspaceId: w.id as string, released, remaining: count ?? 0 })
      }
    } catch (err) {
      console.error('[cron/daily-tasks] batch failed for', w.id, err)
    }
  }
  return NextResponse.json({ ok: true, checked: (workspaces ?? []).length, batches })
}
