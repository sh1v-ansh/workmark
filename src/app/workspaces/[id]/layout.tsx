import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { C, F, T } from '@/lib/theme/dark-tokens'
import { getWorkspace } from './load'
import WorkspaceNav from './WorkspaceNav'
import WorkspaceShell from './WorkspaceShell'

/**
 * Everything the four project views have in common: which project this is,
 * and how to get between them.
 *
 * In a layout rather than repeated in each page because Next keeps a layout
 * mounted across navigations between its children — so moving from the board
 * to the calendar does not redraw the name, the status or the tabs, and the
 * tab you clicked is already highlighted before the new page's data lands.
 */
export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>
  children: React.ReactNode
}) {
  const { id } = await params
  const { workspace } = await getWorkspace(id)

  const isDraft = workspace.status === 'draft'
  const isClosed = workspace.status === 'closed'

  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px 72px' }}>
      <WorkspaceShell workspaceId={workspace.id}>
        <Link href="/workspaces" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.meta, color: C.textFaint, textDecoration: 'none', marginBottom: 18 }}>
          ← All projects
        </Link>

        {/* A project you recognise, rather than a title on a generic page.
            What it is, whether it is running, which repository it reads and
            who is on it — one line, from the row we have already loaded.
            The week used to be in here too; it is on the board, where the
            week's controls are, and putting it in the header as well meant
            two queries on every page to repeat something. */}
        <header style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontFamily: F.display, fontSize: T.display, fontWeight: 600, letterSpacing: '-0.022em', color: C.text }}>
              {workspace.title}
            </h1>
            <span className="wm-chip" style={{
              color: isClosed ? C.textGhost : isDraft ? '#94500F' : '#0F7B4F',
              border: `1px solid ${isClosed ? C.border : isDraft ? '#E4B9A6' : '#B7E0CC'}`,
            }}>
              {isClosed ? 'Finished' : isDraft ? 'Being set up' : 'In progress'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: T.meta, color: C.textFaint }}>
            {workspace.repoFullName && (
              <a
                href={`https://github.com/${workspace.repoFullName}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.textFaint, textDecoration: 'none' }}
              >
                <Icon name="github" size={12} />{workspace.repoFullName}
              </a>
            )}
            {workspace.deadline && <span>Due {workspace.deadline}</span>}
            <span>
              {workspace.members.length === 1 ? 'On your own' : `${workspace.members.length} people`}
            </span>
          </div>

          {workspace.summary && (
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, maxWidth: '62ch', marginTop: 10 }}>
              {workspace.summary}
            </p>
          )}
        </header>

        <WorkspaceNav workspaceId={workspace.id} isDraft={isDraft} />

        {children}
      </WorkspaceShell>
    </main>
  )
}
