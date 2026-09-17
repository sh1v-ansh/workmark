import {
  loadBoard, loadVerdicts, loadCloseSummary, loadDependencies, loadSprints,
  loadMessages, loadCheckpoints, loadDecisions,
} from '@/lib/workspace/queries'
import { getWorkspace } from './load'
import Board from './Board'
import DraftSetup from './DraftSetup'
import CloseSummaryCard from './CloseSummaryCard'

export const metadata = { title: 'Board' }

/**
 * The board, and nothing else.
 *
 * This used to be the whole project: board, calendar, progress, the repo
 * picker, the team list, the invite box, the removal votes and the close-out,
 * all in one component, with everything below the board mounted whichever
 * view was showing. The daily screen paid for the monthly ones on every
 * visit, and the kanban started a long way down the page.
 */
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, userId, workspace } = await getWorkspace(id)

  // A project still being set up has no tasks, so every one of these would be
  // a round trip for an empty array on every visit during setup.
  if (workspace.status === 'draft') {
    return <DraftSetup workspace={workspace} />
  }

  const [tasks, verdicts, dependencies, decisions, sprints, messages, checkpoints] = await Promise.all([
    loadBoard(supabase, id),
    loadVerdicts(supabase, id),
    loadDependencies(supabase, id),
    loadDecisions(supabase, id),
    loadSprints(supabase, id),
    loadMessages(supabase, id),
    loadCheckpoints(supabase, id),
  ])

  // Only for a finished project. On every other visit this is a query for a
  // panel that will not render.
  const closeSummary = workspace.status === 'closed'
    ? await loadCloseSummary(supabase, id, userId)
    : null

  return (
    <>
      {/* A finished project opens on what it produced, not on the board it
          was worked from. This is the one screen the whole feature exists to
          be able to show. */}
      {closeSummary && (
        <CloseSummaryCard summary={closeSummary} evidenceMintedAt={workspace.evidenceMintedAt} />
      )}

      <Board
        view="board"
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
    </>
  )
}
