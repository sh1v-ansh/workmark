import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeComplexity } from '@/lib/complexity'

/**
 * POST /api/records/attest
 *
 * The poster (company or faculty) submits the six-question structured
 * attestation from spec §3.2 Table 2. Also marks the poster's side as
 * approved. If the student has already approved the summary, this call
 * completes mutual lock and stamps the tier.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    id?: string
    technologies_used?: string[]
    deliverables_status?: 'yes' | 'partial' | 'no'
    would_engage_again?: boolean
    independence_level?: 'independent' | 'some_guidance' | 'frequent_checkins'
    communication_level?: 'proactive' | 'responsive' | 'needed_followup'
    problem_solving_level?: 'proposed_solutions' | 'described_problems' | 'got_stuck'
    outcome?: 'completed' | 'partial' | 'terminated'
  } | null

  if (!body?.id) return NextResponse.json({ error: 'Missing record id.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: record, error: readErr } = await supabase
    .from('verified_work_records')
    .select('id, student_id, poster_id, poster_type, project_id, locked_at, student_approved_at, start_date, end_date')
    .eq('id', body.id)
    .maybeSingle()

  if (readErr || !record) return NextResponse.json({ error: 'Record not found.' }, { status: 404 })
  if (record.poster_id !== user.id) return NextResponse.json({ error: 'Only the poster can attest.' }, { status: 403 })
  if (record.locked_at) return NextResponse.json({ error: 'Record is locked.' }, { status: 409 })

  const now = new Date().toISOString()
  const willLock = record.student_approved_at != null // student already approved → this attest completes mutual lock
  const tier = record.poster_type === 'company' ? 1 : 2

  const update: Record<string, unknown> = {
    technologies_used: body.technologies_used ?? null,
    deliverables_status: body.deliverables_status ?? null,
    would_engage_again: body.would_engage_again ?? null,
    independence_level: body.independence_level ?? null,
    communication_level: body.communication_level ?? null,
    problem_solving_level: body.problem_solving_level ?? null,
    outcome: body.outcome ?? null,
    poster_approved_at: now,
    // Legacy verification_status still drives the email-flow badge; mirror it.
    verification_status: body.outcome === 'terminated' || body.deliverables_status === 'no' ? 'incomplete' : 'verified',
    verified_at: now,
  }

  if (willLock) {
    update.locked_at = now
    update.tier = tier
  }

  // Compute complexity from the freshly-attested data + project.
  const { data: project } = await supabase
    .from('projects')
    .select('type, description, required_skills, preferred_skills')
    .eq('id', record.project_id)
    .maybeSingle()

  if (project) {
    update.complexity_score = computeComplexity(project, {
      technologies_used: body.technologies_used ?? null,
      independence_level: body.independence_level ?? null,
      start_date: record.start_date,
      end_date: record.end_date,
    })
  }

  const { error: updateErr } = await supabase
    .from('verified_work_records')
    .update(update)
    .eq('id', record.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ success: true, locked: willLock })
}
