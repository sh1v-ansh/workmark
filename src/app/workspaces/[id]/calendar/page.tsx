import { redirect } from 'next/navigation'
import {
  loadBoard, loadVerdicts, loadDependencies, loadSprints, loadMessages,
  loadCheckpoints, loadDecisions,
} from '@/lib/workspace/queries'
import { getWorkspace } from '../load'
import Board from '../Board'

export const metadata = { title: 'Calendar' }

/**
 * The same tasks, laid out by when they are due.
 *
 * Rendered through Board rather than through Calendar directly, because
 * clicking a day's task has to open the same editor the board opens — every
 * piece of that (the drawer, the subtask rules, the blocked toggle, the
 * assistant) lives in Board, and a second copy would be a second set of
 * behaviours to keep in step.
 */
export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, userId, workspace } = await getWorkspace(id)

  // Nothing is scheduled before a project starts, and the tabs are hidden for
  // a draft anyway — this is for somebody who typed the URL.
  if (workspace.status === 'draft') redirect(`/workspaces/${id}`)

  const [tasks, verdicts, dependencies, decisions, sprints, messages, checkpoints] = await Promise.all([
    loadBoard(supabase, id),
    loadVerdicts(supabase, id),
    loadDependencies(supabase, id),
    loadDecisions(supabase, id),
    loadSprints(supabase, id),
    loadMessages(supabase, id),
    loadCheckpoints(supabase, id),
  ])

  return (
    <Board
      view="calendar"
      workspaceId={workspace.id}
      tasks={tasks}
      verdicts={Array.from(verdicts.values())}
      members={workspace.members}
      workspaceStatus={workspace.status}
      workspaceDeadline={workspace.deadline}
      sprints={sprints}
      messages={Array.from(messages.entries())}
      checkpoints={Array.from(checkpoints.entries())}
      dependencies={dependencies}
      decisions={Array.from(decisions.values()).flat()}
      userId={userId}
      readOnly={workspace.status === 'closed'}
    />
  )
}
