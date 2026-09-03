import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue } from '@/lib/admin/queue'
import AdminShell from '../AdminShell'
import { Panel } from '../widgets'
import { tableStyles as ts } from '../table-styles'
import { C, state } from '@/lib/theme/dark-tokens'

export const dynamic = 'force-dynamic'

interface ErrorRow {
  id: string
  source: string
  context: string
  message: string
  stack: string | null
  page_url: string | null
  seen_count: number
  first_seen: string
  last_seen: string
}

function when(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * /admin/errors — what broke, and how often.
 *
 * Before this, a production 500 was invisible unless a user mentioned it.
 * Rows are grouped by (source, context, message) with a count, so one broken
 * page produces one row that climbs rather than ten thousand rows that bury
 * everything else — which is the failure mode that makes error dashboards
 * get ignored.
 *
 * Sorted by most recent rather than most frequent on purpose: an error that
 * happened four hundred times last week and stopped is history, and an error
 * that started twenty minutes ago is the one you want to see first.
 */
export default async function AdminErrorsPage() {
  const { admin } = await requireAdmin()

  const [{ data: errors }, { items }] = await Promise.all([
    admin
      .from('error_log')
      .select('id, source, context, message, stack, page_url, seen_count, first_seen, last_seen')
      .is('resolved_at', null)
      .order('last_seen', { ascending: false })
      .limit(100),
    loadQueue(admin),
  ])

  const rows = (errors ?? []) as ErrorRow[]
  const dayAgo = Date.now() - 86_400_000
  const recent = rows.filter((r) => Date.parse(r.last_seen) > dayAgo)

  return (
    <AdminShell
      title="Errors"
      lede="What broke in production. Repeats are collapsed into a count."
      queueCount={items.length}
      overdueCount={items.filter((i) => i.severity === 'overdue').length}
    >
      {rows.length === 0 ? (
        <Panel title="Nothing broken">
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
            No unresolved errors. Either everything is fine, or nothing has been deployed since
            this table was created — worth checking which.
          </p>
        </Panel>
      ) : (
        <Panel title={`${rows.length} open · ${recent.length} in the last 24 hours`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={ts.table}>
              <thead>
                <tr>
                  <th style={ts.th}>Where</th>
                  <th style={ts.th}>What</th>
                  <th style={{ ...ts.th, textAlign: 'right' }}>Count</th>
                  <th style={ts.th}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ ...ts.td, fontSize: 13 }}>
                      <div style={{ color: C.text, fontWeight: 600 }}>{row.context}</div>
                      <div style={{ color: C.textGhost, fontSize: 12, marginTop: 2 }}>
                        {row.source}
                        {row.page_url ? ` · ${row.page_url.replace(/^https?:\/\/[^/]+/, '')}` : ''}
                      </div>
                    </td>
                    <td style={{ ...ts.td, fontSize: 13, maxWidth: 420 }}>
                      <div style={{ color: C.textSub }}>{row.message}</div>
                      {row.stack && (
                        <details style={{ marginTop: 6 }}>
                          <summary style={{ fontSize: 12, color: C.textGhost, cursor: 'pointer' }}>Stack</summary>
                          <pre style={{ fontSize: 11, color: C.textFaint, whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.45 }}>
                            {row.stack}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td style={{ ...ts.td, ...ts.num, textAlign: 'right', fontSize: 13, color: row.seen_count > 20 ? state.caution : C.textSub }}>
                      {row.seen_count}
                    </td>
                    <td style={{ ...ts.td, fontSize: 13, whiteSpace: 'nowrap' }}>{when(row.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </AdminShell>
  )
}
