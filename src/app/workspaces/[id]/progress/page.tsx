import { redirect } from 'next/navigation'
import { loadMetrics } from '@/lib/workspace/queries'
import { getWorkspace } from '../load'
import PlanVsReality from '../PlanVsReality'

export const metadata = { title: 'Progress' }

/**
 * Planned against delivered.
 *
 * One query, and only on the route that shows it. It used to be loaded on
 * every visit to the project and rendered under the board — the least-read
 * thing on the page, in the way of the most-read one.
 */
export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, userId, workspace } = await getWorkspace(id)

  if (workspace.status === 'draft') redirect(`/workspaces/${id}`)

  const measured = await loadMetrics(supabase, id, userId)

  return <PlanVsReality metrics={measured?.metrics ?? null} computedAt={measured?.computedAt ?? null} />
}
