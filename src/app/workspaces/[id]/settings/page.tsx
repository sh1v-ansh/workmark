import { getWorkspace } from '../load'
import SettingsClient from './SettingsClient'

export const metadata = { title: 'Settings' }

/**
 * The repository, who is on the team, what everybody works on, and closing
 * the project out.
 *
 * Its own route because none of it is daily. All four used to sit underneath
 * the board on the same page, mounted whichever view was showing — so the
 * screen somebody opens every morning carried the screen they open twice a
 * term, and the kanban started below an invite box.
 */
export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, userId, workspace } = await getWorkspace(id)

  // The repo picker only ever offers repositories Workmark can already read.
  // Anything else would record a link to something that can never be scanned.
  const { data: grants } = await supabase
    .from('github_repo_grants')
    .select('repo_full_name, is_private')
    .eq('student_id', userId)
    .is('revoked_at', null)
    .order('repo_full_name')

  // Only to tell an owner whether they are closing too early, so it is a
  // count rather than the board.
  const { count: finishedCount } = workspace.status === 'active'
    ? await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', id)
        .in('status', ['verified', 'accepted'])
    : { count: 0 }

  return (
    <SettingsClient
      workspace={workspace}
      userId={userId}
      finishedCount={finishedCount ?? 0}
      repoOptions={(grants ?? []).map((g) => ({
        fullName: g.repo_full_name as string,
        isPrivate: g.is_private as boolean,
      }))}
    />
  )
}
