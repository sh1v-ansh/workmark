// The project every page under /workspaces/[id] needs, loaded once.
//
// The layout draws the name, the status and the tabs; each page underneath
// needs the same row for its own reasons — the board for the member list, the
// settings page for the whole thing. Without this that is two round trips per
// visit for identical data.
//
// React's cache() dedupes within a single render pass, which is exactly the
// scope that matters: layout and page render together for one request, and
// nothing is held between requests or between users.
//
// Lives in its own file rather than in page.tsx because a Next route file may
// only export route handlers and the framework's own names — exporting a
// helper from one is a build error, not a style preference.

import { cache } from 'react'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadWorkspace, type WorkspaceDetail } from '@/lib/workspace/queries'

/**
 * The signed-in user and the project, or a redirect/404.
 *
 * RLS returns nothing for a project somebody is not on, so "not found" and
 * "not yours" come back as the same answer — which is the right one. They
 * cannot be told it exists.
 */
export const getWorkspace = cache(async (id: string): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspace: WorkspaceDetail
}> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await loadWorkspace(supabase, id, user.id)
  if (!workspace) notFound()

  return { supabase, userId: user.id, workspace }
})
