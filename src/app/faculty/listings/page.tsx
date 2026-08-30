import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccount, hasRole } from '@/lib/auth/roles'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { LAYOUT } from '@/lib/theme/layout'

/** Every project this person posted, with what's happened to each. */
export default async function FacultyListingsPage() {
  const supabase = await createClient()
  const account = await getAccount(supabase)
  if (!account) redirect('/login')
  if (!hasRole(account, 'faculty')) redirect('/student/dashboard')

  const [{ data: profile }, { data: listings }] = await Promise.all([
    // Faculty have no student profile; the name is on the account row.
    supabase.from('accounts').select('display_name').eq('id', account.id).maybeSingle(),
    supabase
      .from('listings')
      .select('id, title, status, created_at, est_hours, duration')
      .eq('poster_id', account.id)
      .order('created_at', { ascending: false }),
  ])

  const ids = (listings ?? []).map((l) => l.id)
  const [{ data: applications }, { data: engagements }] = ids.length
    ? await Promise.all([
        supabase.from('applications').select('listing_id, status').in('listing_id', ids),
        supabase.from('engagements').select('listing_id, stage').in('listing_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const stats = new Map<string, { waiting: number; total: number; building: number }>()
  for (const id of ids) stats.set(id, { waiting: 0, total: 0, building: 0 })
  for (const a of applications ?? []) {
    const s = stats.get(a.listing_id)
    if (!s || a.status === 'withdrawn') continue
    s.total++
    if (a.status === 'submitted') s.waiting++
  }
  for (const e of engagements ?? []) {
    const s = stats.get(e.listing_id)
    if (s && ['accepted', 'in_progress', 'submitted'].includes(e.stage)) s.building++
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <Kicker style={{ marginBottom: 7 }}>Faculty</Kicker>
            <h1 style={{ fontSize: T.h1, fontWeight: 800, letterSpacing: '-0.03em', color: C.text }}>
              My projects
            </h1>
          </div>
          <Button href="/listings/new" variant="accent">New project</Button>
        </div>

        {(listings ?? []).length === 0 ? (
          <Card hoverable={false} padding={34}>
            <p style={{ fontSize: 15, color: C.textFaint, textAlign: 'center', lineHeight: 1.6 }}>
              Nothing posted yet. A project can be a piece of course work or a slice of research.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(listings ?? []).map((l) => {
              const s = stats.get(l.id)!
              return (
                <Card key={l.id} hoverable={false} padding={19}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.015em' }}>
                      {l.title ?? 'Untitled project'}
                    </span>
                    <Badge tone={l.status === 'open' ? 'positive' : 'neutral'}>{l.status}</Badge>
                  </div>

                  <p style={{ fontSize: 13.5, color: C.textFaint, marginBottom: 13 }}>
                    {[
                      s.total === 0 ? 'No applicants' : `${s.total} applicant${s.total === 1 ? '' : 's'}`,
                      s.waiting > 0 ? `${s.waiting} waiting on you` : null,
                      s.building > 0 ? `${s.building} building` : null,
                      l.duration,
                      l.est_hours ? `~${l.est_hours}h` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>

                  <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <Button href={`/listings/${l.id}/applicants`} variant={s.waiting > 0 ? 'accent' : 'outline'} size="sm">
                      {s.waiting > 0 ? `Review ${s.waiting} applicant${s.waiting === 1 ? '' : 's'}` : 'Applicants'}
                    </Button>
                    <Link href={`/listings/${l.id}`} className="nb-btn nb-btn-quiet nb-btn-sm" style={{ textDecoration: 'none' }}>
                      View as students see it
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
