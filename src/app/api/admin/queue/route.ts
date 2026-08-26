import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAccount, hasRole, recordAdminAction, type AdminSubject } from '@/lib/auth/roles'
import {
  resolveReviewRequest, resolveDispute, resolveUnresolvedSkill, retryJob, verifyFaculty,
  type DisputeResolution,
} from '@/lib/admin/actions'
import type { QueueKind } from '@/lib/admin/queue'

/**
 * POST /api/admin/queue — act on one queue item.
 *
 * The role is checked against the database on every request rather than
 * against the login token. A token claim would be faster, but it goes stale:
 * revoking someone's admin wouldn't take effect until their session
 * refreshed, and admin is precisely the role where that gap matters.
 *
 * Every action is recorded to admin_actions afterwards, including which
 * student it concerned — so "everything staff did touching this person" is
 * one query. That question is unanswerable retroactively, which is why the
 * logging isn't optional.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const account = await getAccount(supabase)

  // Same 403 whether they're signed out, not an admin, or suspended — an
  // admin surface shouldn't confirm to a stranger that it exists.
  if (!hasRole(account, 'admin')) {
    return NextResponse.json({ error: 'Not found.' }, { status: 403 })
  }
  const adminId = account!.id

  let body: {
    kind?: QueueKind
    id?: string
    action?: string
    note?: string
    skillId?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const { kind, id, action } = body
  if (!kind || !id || !action) {
    return NextResponse.json({ error: 'kind, id and action are required.' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Captured for the audit row: which student this touched, so the trail can
  // be read from their side as well as from the staff member's.
  let studentId: string | null = null
  let result

  switch (kind) {
    case 'review_request': {
      if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
      }
      const { data } = await admin.from('review_requests').select('student_id').eq('id', id).maybeSingle()
      studentId = data?.student_id ?? null
      result = await resolveReviewRequest(admin, {
        id, approve: action === 'approve', note: body.note?.trim() || null,
      })
      break
    }

    case 'dispute': {
      const allowed: DisputeResolution[] = ['resolved_corrected', 'resolved_verified', 'resolved_retracted']
      if (!allowed.includes(action as DisputeResolution)) {
        return NextResponse.json({ error: 'Unknown resolution.' }, { status: 400 })
      }
      // A resolution the student will read, so it has to say something.
      const note = body.note?.trim()
      if (!note) {
        return NextResponse.json(
          { error: 'A note is required — the student sees this as the outcome of their dispute.' },
          { status: 400 },
        )
      }
      const { data } = await admin.from('disputes').select('student_id').eq('id', id).maybeSingle()
      studentId = data?.student_id ?? null
      result = await resolveDispute(admin, { id, resolution: action as DisputeResolution, note })
      break
    }

    case 'unresolved_skill': {
      if (action !== 'map' && action !== 'not_a_skill') {
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
      }
      if (action === 'map' && !body.skillId) {
        return NextResponse.json({ error: 'Pick a skill to map it to.' }, { status: 400 })
      }
      result = await resolveUnresolvedSkill(admin, {
        id, adminId, mapToSkillId: action === 'map' ? body.skillId! : null,
      })
      break
    }

    case 'failed_job': {
      if (action !== 'retry') {
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
      }
      const { data } = await admin.from('jobs').select('student_id').eq('id', id).maybeSingle()
      studentId = data?.student_id ?? null
      result = await retryJob(admin, { id })
      break
    }

    case 'faculty_verification': {
      if (action !== 'approve' && action !== 'decline') {
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
      }
      studentId = id
      result = await verifyFaculty(admin, { accountId: id, adminId, approve: action === 'approve' })
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown item kind.' }, { status: 400 })
  }

  // Recorded whether or not it succeeded: an attempted action on someone's
  // record is worth knowing about even when it didn't land.
  await recordAdminAction(admin, {
    adminId,
    action: `${kind}.${action}`,
    subjectType: kind as AdminSubject,
    subjectId: id,
    studentId,
    detail: { ok: result.ok, note: body.note?.trim() || null, skillId: body.skillId ?? null },
  })

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 })
  return NextResponse.json({ ok: true, message: result.message })
}
