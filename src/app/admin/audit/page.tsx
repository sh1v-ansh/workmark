import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue } from '@/lib/admin/queue'
import AdminShell from '../AdminShell'
import { EmptyState } from '../widgets'
import Badge from '@/components/ui/Badge'
import { C } from '@/lib/theme/dark-tokens'
import { tableStyles as ts } from '../table-styles'

/**
 * /admin/audit — what staff have done.
 *
 * The log has been written since the role existed and nothing displayed it.
 * A trail nobody can read isn't a trail; it's a table.
 *
 * Deliberately shows staff acting on people, including reads, because that's
 * the question anyone actually asks after a complaint: who looked at this
 * person's record, and when. It cannot be answered retroactively, which is
 * why it's recorded, and it can't be answered at all if it's never shown.
 */
export default async function AdminAuditPage({ searchParams }: {
  searchParams: Promise<{ q?: string }>
}) {
  const { admin } = await requireAdmin()
  const { q } = await searchParams
  const query = (q ?? '').trim()

  let actions = admin
    .from('admin_actions')
    .select('id, admin_id, action, subject_type, subject_id, student_id, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (query) actions = actions.ilike('action', `%${query}%`)

  const { data: rows } = await actions
  const { items } = await loadQueue(admin)

  // Names for both sides: who acted, and who it was about.
  const ids = Array.from(new Set([
    ...(rows ?? []).map((r) => r.admin_id),
    ...(rows ?? []).map((r) => r.student_id).filter(Boolean) as string[],
  ]))
  const { data: names } = ids.length
    ? await admin.from('students').select('id, full_name').in('id', ids)
    : { data: [] }
  const nameById = new Map((names ?? []).map((n) => [n.id, n.full_name]))

  return (
    <AdminShell
      title="Audit log"
      lede="Every staff action, including reads of someone's record."
      queueCount={items.length}
      overdueCount={items.filter((i) => i.severity === 'overdue').length}
    >
      <form method="get" style={{ marginBottom: 20, display: 'flex', gap: 9, maxWidth: 460 }}>
        <input
          name="q"
          defaultValue={query}
          className="dk-input"
          placeholder="Filter by action, e.g. dispute"
          aria-label="Filter actions"
        />
        <button type="submit" className="nb-btn nb-btn-ink">Filter</button>
      </form>

      {(rows ?? []).length === 0 ? (
        <EmptyState>
          {query ? `No actions match "${query}".` : 'No staff actions recorded yet.'}
        </EmptyState>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={ts.table}>
            <thead>
              <tr>
                <th style={ts.th}>When</th>
                <th style={ts.th}>Who</th>
                <th style={ts.th}>Did what</th>
                <th style={ts.th}>To whom</th>
                <th style={ts.th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const detail = (r.detail ?? {}) as { ok?: boolean; note?: string | null }
                return (
                  <tr key={r.id}>
                    <td style={{ ...ts.td, color: C.textGhost, whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ ...ts.td, fontWeight: 600, color: C.text }}>
                      {nameById.get(r.admin_id) ?? r.admin_id.slice(0, 8)}
                    </td>
                    <td style={ts.td}>
                      <code style={{ fontSize: 12.5, background: C.surfaceAlt, padding: '2px 6px', borderRadius: 5 }}>
                        {r.action}
                      </code>
                      {detail.note && (
                        <p style={{ fontSize: 12.5, color: C.textGhost, marginTop: 4, lineHeight: 1.45 }}>
                          {detail.note.slice(0, 120)}
                        </p>
                      )}
                    </td>
                    <td style={ts.td}>
                      {r.student_id
                        ? (nameById.get(r.student_id) ?? r.student_id.slice(0, 8))
                        : <span style={{ color: C.textGhost }}>—</span>}
                    </td>
                    <td style={ts.td}>
                      {detail.ok === false
                        ? <Badge tone="caution">failed</Badge>
                        : <Badge tone="neutral">done</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: C.textGhost, marginTop: 18, lineHeight: 1.6, maxWidth: '62ch' }}>
        Attempted actions are recorded whether or not they succeeded — an attempt on someone&apos;s
        record is worth knowing about even when it didn&apos;t land. Showing the 200 most recent.
      </p>
    </AdminShell>
  )
}
