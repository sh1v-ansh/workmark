import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { parseBody, readFields, requireString, requireUuid, ValidationError } from '@/lib/http/validate'

async function routeId(params: Promise<{ id: string }>): Promise<string> {
  return requireUuid((await params).id, 'Project')
}

/**
 * POST /api/workspaces/[id]/repo — link the project's repository.
 *
 * The repo belongs to the workspace, not to a person. github_repo_grants is
 * per student, which is right for a personal record and wrong for a team:
 * one repository with several contributors, where only one of them installed
 * the App on it. So one member links it, and everybody's commits are read
 * through that single installation and attributed back by author.
 *
 * It has to be a repo the caller has already granted. Otherwise this would
 * happily record a link to something Workmark can never read, and the
 * project would sit in draft with nothing to scan.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let id: string
  try { id = await routeId(params) } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response

  const fields = readFields(() => ({
    repoFullName: requireString(parsed.body.repoFullName, 'A repository', { max: 200 }),
  }))
  if (!fields.ok) return fields.response
  const { repoFullName } = fields.values

  if (!/^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(repoFullName)) {
    return NextResponse.json({ error: 'That does not look like a repository name.' }, { status: 400 })
  }

  const { data: grant } = await supabase
    .from('github_repo_grants')
    .select('repo_full_name, installation_id')
    .eq('student_id', user.id)
    .eq('repo_full_name', repoFullName)
    .is('revoked_at', null)
    .maybeSingle()

  if (!grant) {
    return NextResponse.json(
      { error: 'Workmark cannot see that repository. Connect it on your GitHub page first.' },
      { status: 400 },
    )
  }

  // One repo per project for now. Replacing rather than adding, because a
  // project with two repositories raises questions about attribution that
  // nothing downstream is ready to answer.
  await supabase
    .from('workspace_repos')
    .update({ unlinked_at: new Date().toISOString() })
    .eq('workspace_id', id)
    .is('unlinked_at', null)

  const { error } = await supabase
    .from('workspace_repos')
    .upsert({
      workspace_id: id,
      repo_full_name: repoFullName,
      installation_id: grant.installation_id,
      granted_by: user.id,
      linked_at: new Date().toISOString(),
      unlinked_at: null,
    }, { onConflict: 'workspace_id,repo_full_name' })

  if (error) {
    // 42501 is RLS declining: the insert policy is owners only.
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Only an owner can link the repository.' }, { status: 403 })
    }
    console.error('[api/workspaces/:id/repo] link failed:', error)
    return NextResponse.json({ error: 'Could not link that repository.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, repoFullName })
}

/** DELETE — unlink. Kept as a row with a timestamp: which repo a project used
 *  and when is part of the record, not something to erase. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let id: string
  try { id = await routeId(params) } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const { data: updated, error } = await supabase
    .from('workspace_repos')
    .update({ unlinked_at: new Date().toISOString() })
    .eq('workspace_id', id)
    .is('unlinked_at', null)
    .select('id')

  if (error) {
    console.error('[api/workspaces/:id/repo] unlink failed:', error)
    return NextResponse.json({ error: 'Could not unlink that.' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Only an owner can unlink the repository.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
