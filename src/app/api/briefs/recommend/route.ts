import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enforce } from '@/lib/rate-limit'
import { agentsAvailable } from '@/lib/agents/client'
import { recommendForStudent } from '@/lib/briefs/recommend'

export const dynamic = 'force-dynamic'
// Up to three model calls, one after another.
export const maxDuration = 120

/**
 * POST /api/briefs/recommend — top the signed-in student up to three
 * project ideas now, rather than at 04:41 tomorrow.
 *
 * Without this a new account opened Find work to nothing at all: the
 * nightly run is the only other thing that writes recommendations. Find work
 * calls this once when it has none to show.
 *
 * Cheap to call twice. recommendForStudent tops up and never exceeds three
 * unstarted ideas, so a repeat is a single count query, and the agent rate
 * limit caps what a loop could spend.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!agentsAvailable()) return NextResponse.json({ ok: true, generated: 0 })

  // Faculty have no students row and no use for project ideas.
  const { data: student } = await supabase.from('students').select('id').eq('id', user.id).maybeSingle()
  if (!student) return NextResponse.json({ ok: true, generated: 0 })

  const limited = await enforce('agent', user.id)
  if (limited) return limited

  // Service role, so this goes through exactly the code path the nightly
  // run uses — one writer for recommendations, not two that can drift.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  try {
    const { generated } = await recommendForStudent(admin, user.id)
    return NextResponse.json({ ok: true, generated })
  } catch (err) {
    console.error('[api/briefs/recommend] failed:', err)
    return NextResponse.json({ error: 'Could not write project ideas.' }, { status: 500 })
  }
}
