import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listWorkspaces, pendingInvitations } from '@/lib/workspace/queries'
import WorkspacesClient from './WorkspacesClient'

export const metadata = { title: 'Projects' }

/**
 * /workspaces — every project this student is on.
 *
 * Top level rather than under /me, because a project is shared with other
 * people and "my record" is the one part of Workmark that is entirely
 * yours. It is also the thing a student opens most days.
 */
export default async function WorkspacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('id').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  const [workspaces, invitations, { data: connection }] = await Promise.all([
    listWorkspaces(supabase, user.id),
    pendingInvitations(supabase, user.id),
    supabase.from('github_connections').select('student_id').eq('student_id', user.id).maybeSingle(),
  ])

  return (
    <WorkspacesClient
      workspaces={workspaces}
      invitations={invitations}
      githubConnected={!!connection}
      userId={user.id}
    />
  )
}
