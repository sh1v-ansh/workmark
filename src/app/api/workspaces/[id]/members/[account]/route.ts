import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { WORK_ROLES, type WorkRole } from '@/lib/workspace/membership'
import {
  parseBody, readFields, requireUuid, requireOneOf, optionalString, ValidationError,
} from '@/lib/http/validate'

interface Params { params: Promise<{ id: string; account: string }> }

async function ids(params: Params['params']): Promise<{ id: string; account: string }> {
  const raw = await params
  return {
    id: requireUuid(raw.id, 'Project'),
    account: requireUuid(raw.account, 'Person'),
  }
}

function badId(err: unknown): Response | null {
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
  return null
}

/**
 * PATCH — answer your own invitation, or set your work role.
 *
 * Both are things you do to your own row, which is why one route covers
 * them. The column grant in v05_0026 is what makes this safe: `authenticated`
 * may only write accepted_at, removed_at, scan_consent_at and work_role, so
 * accepting an invitation cannot also promote you to owner.
 */
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let id: string, account: string
  try { ({ id, account } = await ids(params)) } catch (err) {
    const bad = badId(err); if (bad) return bad; throw err
  }

  if (account !== user.id) {
    return NextResponse.json({ error: 'You can only change your own membership.' }, { status: 403 })
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const patch: Record<string, unknown> = {}
  const check = readFields(() => {
    if (body.action !== undefined) {
      const action = requireOneOf(body.action, 'Action', ['accept', 'decline'] as const)
      if (action === 'accept') {
        patch.accepted_at = new Date().toISOString()
      } else {
        patch.removed_at = new Date().toISOString()
      }
    }
    if (body.workRole !== undefined) {
      const value = optionalString(body.workRole, 'Role', { max: 20 })
      patch.work_role = value === null ? null : requireOneOf(value, 'Role', WORK_ROLES as readonly WorkRole[])
    }
    return null
  })
  if (!check.ok) return check.response

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('workspace_members')
    .update(patch)
    .eq('workspace_id', id)
    .eq('account_id', user.id)

  if (error) {
    // Raised by require_github_before_accepting. Its wording is written for
    // the person reading it, so it goes through unchanged.
    if (error.message.includes('GitHub')) {
      return NextResponse.json(
        { error: 'Connect your GitHub account before joining a project.', needsGithub: true },
        { status: 400 },
      )
    }
    console.error('[api/workspaces/:id/members/:account] update failed:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE — leave, or remove someone who never contributed.
 *
 * Goes through remove_workspace_member rather than an update, because the
 * rules are not expressible as a policy: leaving is always allowed, removing
 * a non-contributor needs a reason, and removing somebody who HAS contributed
 * is refused here entirely — that path is a request the team votes on.
 *
 * These are peers, not employees. An owner being able to drop a teammate the
 * day before a project closes and keep the work is the thing this prevents.
 */
export async function DELETE(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let id: string, account: string
  try { ({ id, account } = await ids(params)) } catch (err) {
    const bad = badId(err); if (bad) return bad; throw err
  }

  // A body is optional: leaving needs no reason.
  let reason: string | null = null
  const parsed = await parseBody(request).catch(() => null)
  if (parsed && parsed.ok) {
    const fields = readFields(() => optionalString(parsed.body.reason, 'Reason', { max: 2000 }))
    if (!fields.ok) return fields.response
    reason = fields.values
  }

  const { error } = await supabase.rpc('remove_workspace_member', {
    p_workspace: id,
    p_account: account,
    p_reason: reason,
  })

  if (error) {
    // Every one of these is raised deliberately with a message meant for the
    // person reading it: needs a reason, needs the team to agree, needs
    // another owner first.
    const message = error.message ?? ''
    if (message.includes('reason') || message.includes('contributed')
        || message.includes('owner') || message.includes('not on this project')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[api/workspaces/:id/members/:account] remove failed:', error)
    return NextResponse.json({ error: 'Could not do that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
