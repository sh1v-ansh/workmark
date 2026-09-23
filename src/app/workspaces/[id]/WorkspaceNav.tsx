'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The four views of a project, as links rather than as state.
 *
 * They were a useState on one enormous page — board, calendar, progress and
 * every setting rendered into the same component, with the settings always
 * mounted underneath whichever view was showing. That is what buried the
 * kanban: a daily screen carrying four screens' worth of markup, and no way
 * to link anybody to any of it.
 *
 * As routes, each one loads only its own data, a browser back button does
 * what it looks like it does, and "send me the calendar" is a URL.
 */
const TABS: readonly { href: string; label: string }[] = [
  { href: '', label: 'Board' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/progress', label: 'Progress' },
  { href: '/settings', label: 'Settings' },
]

export default function WorkspaceNav({
  workspaceId,
  isDraft,
}: {
  workspaceId: string
  /** A project still being set up has no board, calendar or progress yet. */
  isDraft?: boolean
}) {
  const pathname = usePathname()
  const base = `/workspaces/${workspaceId}`
  // Offering four tabs to a project with no tasks would be four ways to look
  // at nothing. Setup is where a draft is going, so setup stays.
  const tabs = isDraft ? TABS.filter((t) => t.href === '' || t.href === '/settings') : TABS

  return (
    <div className="wm-tabs" style={{ marginBottom: 20 }}>
      {tabs.map(({ href, label }) => {
        const to = `${base}${href}`
        // Exact match, not startsWith: the board's href is the base, so a
        // prefix test would light it up on every tab.
        const on = pathname === to
        return (
          <Link
            key={label}
            href={to}
            aria-current={on ? 'page' : undefined}
            className={`wm-tab${on ? ' wm-tab-on' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
