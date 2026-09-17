'use client'

import { usePathname } from 'next/navigation'

/**
 * How wide the page is, which depends on what is on it.
 *
 * 760 is a reading measure, and it is why the board felt cramped: six columns
 * and a 288px card do not fit in it. The work gets the room it needs; the
 * pages that are read rather than worked — progress, settings — stay at a
 * width somebody can actually read a sentence in.
 *
 * A client component only so it can see which route is showing. The children
 * are passed in as a prop, so everything inside stays server-rendered.
 */
export default function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const base = `/workspaces/${workspaceId}`
  const wide = pathname === base || pathname === `${base}/calendar`

  return (
    <div style={{ maxWidth: wide ? 1360 : 760, margin: '0 auto' }}>
      {children}
    </div>
  )
}
