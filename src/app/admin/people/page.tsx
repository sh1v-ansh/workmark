import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue } from '@/lib/admin/queue'
import AdminShell from '../AdminShell'
import { EmptyState, tableStyles as ts } from '../widgets'
import Badge from '@/components/ui/Badge'
import { C } from '@/lib/theme/dark-tokens'

/**
 * /admin/people — everyone, and what state they're in.
 *
 * This is the page an admin actually needs on a normal day: someone emails
 * you, and you need their whole picture in one place. Search is server-side
 * on a query param rather than client-side filtering, so it still works once
 * there are more people than fit in one response.
 */
export default async function AdminPeoplePage({ searchParams }: {
  searchParams: Promise<{ q?: string }>
}) {
  const { admin } = await requireAdmin()
  const { q } = await searchParams
  const query = (q ?? '').trim()

  let people = admin
    .from('students')
    .select('id, full_name, university, major, graduation_year, handle, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (query) {
    people = people.or(`full_name.ilike.%${query}%,university.ilike.%${query}%,handle.ilike.%${query}%`)
  }

  const [{ data: rows }, { data: accounts }, { items }] = await Promise.all([
    people,
    admin.from('accounts').select('id, roles, status, faculty_verified_at'),
    loadQueue(admin),
  ])

  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]))

  // Evidence and engagement counts, in two queries rather than two per row.
  const ids = (rows ?? []).map((r) => r.id)
  const [{ data: evidence }, { data: engagements }] = ids.length
    ? await Promise.all([
        admin.from('current_skill_evidence').select('student_id').in('student_id', ids),
        admin.from('engagements').select('student_id, stage').in('student_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const evidenceCount = new Map<string, number>()
  for (const e of evidence ?? []) evidenceCount.set(e.student_id, (evidenceCount.get(e.student_id) ?? 0) + 1)
  const engagementCount = new Map<string, number>()
  for (const e of engagements ?? []) engagementCount.set(e.student_id, (engagementCount.get(e.student_id) ?? 0) + 1)

  return (
    <AdminShell
      title="People"
      lede="Everyone with an account. Search by name, university or handle."
      queueCount={items.length}
      overdueCount={items.filter((i) => i.severity === 'overdue').length}
    >
      <form method="get" style={{ marginBottom: 20, display: 'flex', gap: 9, maxWidth: 460 }}>
        <input
          name="q"
          defaultValue={query}
          className="dk-input"
          placeholder="Search people…"
          aria-label="Search people"
        />
        <button type="submit" className="nb-btn nb-btn-ink">Search</button>
      </form>

      {(rows ?? []).length === 0 ? (
        <EmptyState>
          {query ? `Nobody matches "${query}".` : 'No accounts yet.'}
        </EmptyState>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={ts.table}>
            <thead>
              <tr>
                <th style={ts.th}>Name</th>
                <th style={ts.th}>Role</th>
                <th style={ts.th}>University</th>
                <th style={ts.th}>Skills</th>
                <th style={ts.th}>Projects</th>
                <th style={ts.th}>Profile</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((p) => {
                const account = accountById.get(p.id)
                const roles = (account?.roles ?? ['student']) as string[]
                const facultyUnverified = roles.includes('faculty') && !account?.faculty_verified_at
                return (
                  <tr key={p.id}>
                    <td style={{ ...ts.td, fontWeight: 600, color: C.text }}>
                      {p.full_name ?? '(no name)'}
                      {account?.status === 'suspended' && (
                        <span style={{ marginLeft: 8 }}><Badge tone="caution">Suspended</Badge></span>
                      )}
                    </td>
                    <td style={ts.td}>
                      <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                        {roles.map((r) => (
                          <Badge key={r} tone={r === 'admin' ? 'info' : facultyUnverified && r === 'faculty' ? 'caution' : 'neutral'}>
                            {r === 'faculty' && facultyUnverified ? 'faculty · unverified' : r}
                          </Badge>
                        ))}
                      </span>
                    </td>
                    <td style={ts.td}>
                      {p.university ?? '—'}
                      {p.major && <span style={{ color: C.textGhost }}> · {p.major}</span>}
                    </td>
                    <td style={{ ...ts.td, ...ts.num }}>{evidenceCount.get(p.id) ?? 0}</td>
                    <td style={{ ...ts.td, ...ts.num }}>{engagementCount.get(p.id) ?? 0}</td>
                    <td style={ts.td}>
                      {p.handle ? (
                        <Link href={`/p/${p.handle}`} style={{ color: C.accentInk, textDecoration: 'none' }}>
                          /p/{p.handle}
                        </Link>
                      ) : (
                        <span style={{ color: C.textGhost }}>none</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: C.textGhost, marginTop: 18, lineHeight: 1.6, maxWidth: '62ch' }}>
        Showing the 100 most recent. This list is names and counts only — opening someone&apos;s
        full record is a separate, logged action, because reading a person&apos;s file is reading a
        consumer record about them.
      </p>
    </AdminShell>
  )
}
