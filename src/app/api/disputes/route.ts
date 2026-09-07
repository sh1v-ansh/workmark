import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { categoryMeta, type DisputeCategory } from '@/lib/fcra/disputes'
import { reinvestigate } from '@/lib/fcra/reinvestigate'
import { parseBody, readFields, requireString, optionalUuid } from '@/lib/http/validate'

// This route does slow third-party work — a machine-checkable dispute re-runs the scan inline. Without an explicit
// maxDuration it inherits the platform default and gets killed mid-flight.
//
// 60s is the value that is safe on every Vercel plan — Hobby without Fluid
// Compute caps here, and a deployment whose maxDuration exceeds the plan
// limit fails to build rather than being clamped. Raise it if the project
// is on Pro; the durable fix is not a bigger number, it is doing this work
// in a background job so no single request has to finish it.
export const maxDuration = 60

/**
 * POST /api/disputes
 *
 * Files a dispute (§611). The row is inserted under the student's own
 * session — disputes has a self-insert policy and filing genuinely is
 * the consumer's act.
 *
 * Machine-checkable categories then reinvestigate immediately, under
 * service-role. That's unusual for a CRA and worth being explicit about:
 * our evidence is derived from code by a deterministic process, so
 * "reinvestigate" means re-run the computation, which takes seconds
 * rather than the 30 days the statute allows. Categories that turn on
 * facts outside the code stay open for a human.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const category = typeof body.category === 'string' ? (body.category as DisputeCategory) : null
  const meta = category ? categoryMeta(category) : null
  if (!meta) return NextResponse.json({ error: 'Pick what the problem is.' }, { status: 400 })

  // Both ids reach a .eq() below. A malformed uuid there is a Postgres
  // 22P02, which surfaces as a 500 — for a row that was never going to be
  // found either way.
  const fields = readFields(() => ({
    detail: requireString(body.detail, 'A description of the problem', { max: 4000 }),
    evidenceId: optionalUuid(body.evidenceId, 'Evidence'),
    disclosureId: optionalUuid(body.disclosureId, 'Disclosure'),
  }))
  if (!fields.ok) return fields.response
  const { detail, evidenceId, disclosureId } = fields.values

  if (meta.needsEvidence && !evidenceId) {
    return NextResponse.json({ error: 'That kind of dispute has to point at a specific skill.' }, { status: 400 })
  }

  // Ownership check runs through the student's own session: RLS on
  // skill_evidence means an id they can't read is one they can't dispute.
  if (evidenceId) {
    const { data: evidence } = await supabase
      .from('skill_evidence')
      .select('id')
      .eq('id', evidenceId)
      .eq('student_id', user.id)
      .maybeSingle()
    if (!evidence) {
      return NextResponse.json({ error: 'That evidence is not on your record.' }, { status: 404 })
    }
  }

  const { data: dispute, error } = await supabase
    .from('disputes')
    .insert({
      student_id: user.id,
      evidence_id: evidenceId,
      disclosure_id: disclosureId,
      category,
      detail,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[api/disputes] insert failed:', error)
    return NextResponse.json({ error: 'Could not file your dispute.' }, { status: 500 })
  }

  if (!meta.machineCheckable) {
    return NextResponse.json({
      ok: true,
      id: dispute.id,
      status: 'open',
      message: 'Filed. A person will review this within 30 days.',
    })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const result = await reinvestigate(admin, dispute.id)
    return NextResponse.json({ ok: true, id: dispute.id, status: result.status, message: result.note })
  } catch (err) {
    // The dispute is filed and stands on its own; only the automatic
    // reinvestigation failed. It stays open for the manual path rather
    // than being lost.
    console.error('[api/disputes] reinvestigation failed:', err)
    return NextResponse.json({
      ok: true,
      id: dispute.id,
      status: 'open',
      message: 'Filed. Automatic reinvestigation could not run, so a person will review this within 30 days.',
    })
  }
}
