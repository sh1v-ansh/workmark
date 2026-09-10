import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { canCloseWorkspace, type MemberRow } from '@/lib/workspace/membership'
import { mintWorkspaceEvidence, FINISHED_STATUSES } from '@/lib/workspace/evidence'
import { notifyClosed } from '@/lib/workspace/notify'
import { requireUuid, ValidationError } from '@/lib/http/validate'

/**
 * Closing scans the repository once per member. 60 seconds is the ceiling
 * that holds on every Vercel plan, and a four-person team can outlast it —
 * which is why the close and the minting are separate writes and an
 * unfinished mint is retried by the nightly pass rather than lost.
 */
export const maxDuration = 60

/**
 * POST /api/workspaces/[id]/close — end the project and write the record.
 *
 * The most consequential write in the workspace feature: it is the moment
 * verified project work becomes something an employer can see. So it is
 * guarded the way engagement close-out is.
 *
 *  - **Only an owner may close.** Ending the project ends everyone's chance
 *    to finish outstanding work on it.
 *  - **Something must actually have been verified.** A project where nothing
 *    passed has nothing to attest to, and closing it should not read as an
 *    achievement.
 *  - **Nobody's evidence comes from their own say-so.** Every Verified card
 *    behind this was either settled by the checker or confirmed by somebody
 *    who did not do the work. That rule lives in canReview and the verifier;
 *    this route relies on it rather than re-deciding it.
 *
 * The close is committed BEFORE the minting starts. A scan that times out
 * then leaves a properly closed project with `evidence_minted_at` null, which
 * the nightly pass retries — rather than a project that refuses to close
 * because GitHub was slow.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string
  try {
    workspaceId = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  // Read through the caller's own session: a project they are not on has
  // nothing to find, which is the right answer rather than a refusal that
  // confirms it exists.
  const [{ data: workspace }, { data: memberRows }] = await Promise.all([
    supabase.from('workspaces').select('id, status, title').eq('id', workspaceId).maybeSingle(),
    supabase
      .from('workspace_members')
      .select('account_id, role, work_role, accepted_at, removed_at')
      .eq('workspace_id', workspaceId),
  ])

  if (!workspace) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

  const refusal = canCloseWorkspace((memberRows ?? []) as unknown as MemberRow[], user.id)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })

  if (workspace.status === 'closed') {
    return NextResponse.json({ error: 'This project is already closed.' }, { status: 400 })
  }
  if (workspace.status === 'draft') {
    return NextResponse.json(
      { error: 'This project has not started yet. Delete it instead of closing it.' },
      { status: 400 },
    )
  }

  const { count: finished } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', FINISHED_STATUSES as unknown as string[])

  if ((finished ?? 0) === 0) {
    return NextResponse.json(
      {
        error: 'Nothing on this project has been verified yet, so there is nothing to record. '
          + 'Submit your finished work and run a check first.',
      },
      { status: 400 },
    )
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: closeError } = await admin
    .from('workspaces')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', workspaceId)
    .neq('status', 'closed') // two owners clicking at once: the second changes nothing

  if (closeError) {
    console.error('[api/workspaces/:id/close] could not close:', closeError)
    return NextResponse.json({ error: 'Could not close the project.' }, { status: 500 })
  }

  // From here the project IS closed. Everything below is the record, and a
  // failure in it is reported without reopening anything — the close was a
  // decision somebody made, not a side effect of a scan succeeding.
  try {
    const evidence = await mintWorkspaceEvidence(admin, workspaceId)

    await admin
      .from('workspaces')
      .update({
        evidence_minted_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)

    await notifyClosed(admin, {
      workspaceId,
      projectTitle: workspace.title as string,
      finishedTasks: finished ?? 0,
      pending: false,
      skillsByMember: new Map(
        evidence.members.map((m) => [m.accountId, m.result?.evidenceWritten.length ?? 0]),
      ),
    })

    return NextResponse.json({
      ok: true,
      closed: true,
      finishedTasks: finished ?? 0,
      skillsWritten: evidence.skillsWritten,
      members: evidence.members.map((m) => ({
        accountId: m.accountId,
        skipped: m.skipped,
        skills: m.result?.evidenceWritten.length ?? 0,
      })),
    })
  } catch (err) {
    console.error('[api/workspaces/:id/close] closed, but minting failed:', err)
    await notifyClosed(admin, {
      workspaceId,
      projectTitle: workspace.title as string,
      finishedTasks: finished ?? 0,
      pending: true,
      skillsByMember: new Map(),
    })
    // evidence_minted_at stays null, so the nightly pass picks this up. Said
    // plainly rather than dressed up as success: the student should know the
    // record is coming and not go looking for it tonight.
    return NextResponse.json({
      ok: true,
      closed: true,
      finishedTasks: finished ?? 0,
      skillsWritten: 0,
      pendingEvidence: true,
      message: 'Project closed. Reading the repository took too long, so your record will '
        + 'finish updating overnight.',
    })
  }
}
