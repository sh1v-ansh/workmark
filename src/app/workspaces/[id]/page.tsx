import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadWorkspace, loadBoard } from '@/lib/workspace/queries'
import WorkspaceClient from './WorkspaceClient'

export const metadata = { title: 'Project' }

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const workspace = await loadWorkspace(supabase, id, user.id)
  // RLS returns nothing for a project they are not on, so "not found" and
  // "not yours" are the same answer — which is the right one. They cannot be
  // told it exists.
  if (!workspace) notFound()

  // The board is only worth loading once the project has actually started —
  // a draft has no tasks and the query would be a round trip for an empty
  // array on every visit during setup.
  const tasks = workspace.status === 'draft' ? [] : await loadBoard(supabase, id)

  // The repo picker only ever offers repositories Workmark can already read.
  // Anything else would record a link to something that can never be scanned.
  const { data: grants } = await supabase
    .from('github_repo_grants')
    .select('repo_full_name, is_private')
    .eq('student_id', user.id)
    .is('revoked_at', null)
    .order('repo_full_name')

  return (
    <WorkspaceClient
      workspace={workspace}
      tasks={tasks}
      userId={user.id}
      repoOptions={(grants ?? []).map((g) => ({
        fullName: g.repo_full_name as string,
        isPrivate: g.is_private as boolean,
      }))}
    />
  )
}
