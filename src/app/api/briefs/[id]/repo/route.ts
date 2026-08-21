import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/briefs/[id]/repo  { repoFullName }
 *
 * Links a repo to a project brief and turns scanning on for it, which is
 * what "start this project" actually means in terms of state.
 *
 * The repo must already be one of the student's granted repos. This route
 * deliberately does NOT create a repo on GitHub: an App installation token
 * is scoped to the repos it was granted and cannot create new ones under a
 * user account — that needs a user-to-server OAuth token we don't hold and
 * shouldn't start holding just for this. So the UI sends people to GitHub
 * to create it, and this links what comes back.
 *
 * DELETE unlinks, for when a repo was linked by mistake.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let repoFullName: string | undefined
  try {
    repoFullName = (await request.json())?.repoFullName
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }
  if (!repoFullName) return NextResponse.json({ error: 'Pick a repo.' }, { status: 400 })

  // RLS restricts this to the student's own briefs, so a bad id is a 404
  // rather than someone else's row.
  const { data: brief } = await supabase
    .from('project_briefs')
    .select('id, started_at')
    .eq('id', id)
    .maybeSingle()
  if (!brief) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  // The repo has to be one they've actually granted — otherwise this would
  // happily record a link to a repo we can never read, and the brief would
  // sit in "building" forever with nothing to scan.
  const { data: grant } = await supabase
    .from('github_repo_grants')
    .select('id, repo_full_name, scan_enabled')
    .eq('student_id', user.id)
    .eq('repo_full_name', repoFullName)
    .is('revoked_at', null)
    .maybeSingle()
  if (!grant) {
    return NextResponse.json(
      { error: "That repo isn't connected yet. Add it to the Workmark GitHub App first, then link it here." },
      { status: 400 },
    )
  }

  // Linking a repo to a brief is an explicit statement that this repo is
  // the work — turning scanning on is the point, not a side effect to be
  // surprised by. Private repos still had to be granted first, so this
  // isn't reaching past anything the student already decided.
  if (!grant.scan_enabled) {
    const { error: grantErr } = await supabase
      .from('github_repo_grants')
      .update({ scan_enabled: true })
      .eq('id', grant.id)
    if (grantErr) {
      return NextResponse.json({ error: 'Could not enable scanning for that repo.' }, { status: 500 })
    }
  }

  const { error } = await supabase
    .from('project_briefs')
    .update({
      repo_full_name: repoFullName,
      // Preserved if already set — re-linking a different repo shouldn't
      // reset when the student started.
      started_at: brief.started_at ?? new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not link the repo.' }, { status: 500 })

  return NextResponse.json({ ok: true, repoFullName })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Only the link is cleared. The grant stays enabled and any evidence the
  // repo already produced stays exactly where it is — evidence is
  // append-only and unlinking a brief is not a claim that the work didn't
  // happen.
  const { error } = await supabase
    .from('project_briefs')
    .update({ repo_full_name: null, started_at: null })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not unlink.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
