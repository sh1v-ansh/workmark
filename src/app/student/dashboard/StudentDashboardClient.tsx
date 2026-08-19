'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import HandNote from '@/components/ui/HandNote'
import Underline from '@/components/ui/Underline'
import { C, F, R, T } from '@/lib/theme/dark-tokens'
import type { TrackRecord } from '@/lib/engagements/lifecycle'

export interface DashboardData {
  student: {
    fullName: string | null
    university: string | null
    major: string | null
    degreeType: string | null
    graduationYear: number | null
    githubUsername: string | null
    activeApplicationCount: number
  }
  githubConnected: boolean
  trackRecord: TrackRecord
  skills: { skillId: string; name: string; bestLevel: number }[]
  applications: {
    id: string
    listingId: string
    title: string
    posterName: string | null
    status: string
    fitTier: string | null
    createdAt: string
  }[]
  listings: { id: string; title: string | null; status: string; createdAt: string; applicantCount: number }[]
  engagements: { id: string; listingId: string; title: string; stage: string; asPoster: boolean; openedAt: string }[]
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Familiar', 2: 'Practiced', 3: 'Strong', 4: 'Advanced', 5: 'Expert' }
const MAX_ACTIVE_APPLICATIONS = 5

// Status words, written the way a person would say them. "submitted" is
// what the database calls it; "waiting to be read" is what is actually
// happening to you, and it is the difference between a table and a product.
const APPLICATION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  submitted:   { label: 'Waiting to be read', tone: 'neutral' },
  shortlisted: { label: "They're interested", tone: 'info' },
  accepted:    { label: "You're in",          tone: 'positive' },
  rejected:    { label: 'Not this time',      tone: 'neutral' },
  withdrawn:   { label: 'Withdrawn',          tone: 'neutral' },
}

const STAGE_LABEL: Record<string, string> = {
  open: 'Getting started',
  in_progress: 'In progress',
  submitted: 'Waiting on sign-off',
  closed: 'Finished',
  abandoned: 'Abandoned',
}

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      <h2 style={{ fontFamily: F.display, fontSize: T.h2, fontWeight: 700, letterSpacing: '-0.02em', color: C.text }}>{children}</h2>
      {aside}
    </div>
  )
}

/** One row inside a card — title, a quiet second line, and something on the right. */
function Row({ title, meta, right, href }: { title: string; meta: string; right?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: T.body, fontWeight: 600, color: C.text, marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: T.meta, color: C.textFaint }}>{meta}</p>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>{right}</div>}
    </>
  )
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    padding: '15px 17px', background: C.bg, borderRadius: R.md, flexWrap: 'wrap',
    textDecoration: 'none', color: 'inherit',
  }
  return href ? <Link href={href} style={style}>{body}</Link> : <div style={style}>{body}</div>
}

export default function StudentDashboardClient({ data }: { data: DashboardData }) {
  const { student, skills, applications, listings, engagements, githubConnected, trackRecord } = data
  const router = useRouter()
  const { toast } = useToast()
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  const activeEngagements = engagements.filter((e) => e.stage !== 'closed' && e.stage !== 'abandoned')

  // Withdrawing frees a slot against the 5-application cap — without
  // this, a student who applied to five stale listings is stuck.
  // The RLS policy permits exactly the submitted -> withdrawn transition
  // on their own row, so no API route is needed.
  async function withdraw(id: string) {
    if (!confirm('Withdraw this application? You can apply again later while the project is still open.')) return
    setWithdrawing(id)
    const supabase = createClient()
    const { error } = await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', id)
    if (error) toast('Could not withdraw.', 'error')
    else { toast('Application withdrawn.', 'success'); router.refresh() }
    setWithdrawing(null)
  }

  // ── What's actually waiting on you ────────────────────────────────────
  // The old dashboard opened with statistics, which answer a question
  // nobody arrives with. This answers the one they do: is there anything
  // I need to do? Every item is derived from real state — if there is
  // nothing, the block does not appear rather than inventing filler.
  const todo: { key: string; title: string; body: string; href: string; cta: string; accent?: boolean }[] = []

  if (!githubConnected) {
    todo.push({
      key: 'github',
      title: 'Connect GitHub to start your record',
      body: 'Your skills come from repositories you link. Nothing else here works without it.',
      href: '/student/github',
      cta: 'Connect',
      accent: true,
    })
  }
  for (const a of applications) {
    if (a.status === 'shortlisted' || a.status === 'accepted') {
      todo.push({
        key: `app-${a.id}`,
        title: a.status === 'accepted'
          ? `${a.posterName ?? 'A poster'} accepted you`
          : `${a.posterName ?? 'A poster'} shortlisted you`,
        body: a.title,
        href: `/listings/${a.listingId}`,
        cta: a.status === 'accepted' ? 'Open it' : 'Reply',
      })
    }
  }
  for (const e of activeEngagements) {
    if (e.stage === 'submitted') {
      todo.push({
        key: `eng-${e.id}`,
        title: 'Agree on what was built',
        body: `${e.title} — nothing lands on your record until you both sign off.`,
        href: `/engagements/${e.id}`,
        cta: 'Take a look',
      })
    }
  }
  for (const l of listings) {
    if (l.status === 'open' && l.applicantCount > 0) {
      todo.push({
        key: `list-${l.id}`,
        title: `${l.applicantCount} ${l.applicantCount === 1 ? 'person has' : 'people have'} applied to your project`,
        body: l.title ?? 'Untitled project',
        href: `/listings/${l.id}/applicants`,
        cta: 'Review them',
      })
    }
  }

  const firstName = student.fullName?.trim().split(/\s+/)[0]

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={student.fullName ?? undefined} />

      <main id="main-content" style={{ maxWidth: 820, margin: '0 auto', padding: '36px 28px 72px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Greeting */}
        <div>
          <h1 className="mob-text-h1" style={{ fontFamily: F.display, fontSize: T.display, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12, color: C.text }}>
            {firstName ? `Hey ${firstName} — ` : ''}
            {todo.length > 0 ? (
              <>
                {todo.length === 1 ? 'one thing is ' : `${todo.length} things are `}
                <Underline>waiting on you</Underline>.
              </>
            ) : (
              <>you&apos;re all caught up.</>
            )}
          </h1>
          <p style={{ fontSize: 17, color: C.textMuted, marginTop: 16 }}>
            {[student.degreeType, student.major, student.university].filter(Boolean).join(' · ') || 'Welcome back.'}
          </p>
        </div>

        {/* Waiting on you */}
        {todo.length > 0 && (
          <Card padding={6} hoverable={false}>
            {todo.map((item, i) => (
              <div
                key={item.key}
                style={{
                  padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                  borderBottom: i < todo.length - 1 ? `1px solid ${C.borderFaint}` : 'none',
                }}
              >
                <div style={{ flexGrow: 1, minWidth: 200 }}>
                  <p style={{ fontFamily: F.display, fontSize: T.h3, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, marginBottom: 3 }}>{item.title}</p>
                  <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.5 }}>{item.body}</p>
                </div>
                <Button href={item.href} variant={item.accent ? 'accent' : 'ink'} size="sm">{item.cta}</Button>
              </div>
            ))}
          </Card>
        )}

        {/* The record */}
        <div style={{ position: 'relative' }}>
          <HandNote offset={{ right: -22, top: 62 }}>this is the bit posters actually read</HandNote>

          <Card ruled hoverable={false} padding={24}>
            <SectionTitle aside={<Link href="/me" style={{ fontSize: T.meta, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>See everything →</Link>}>
              Your record
            </SectionTitle>

            <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap', marginBottom: 22 }}>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, lineHeight: 1, color: C.text }}>{skills.length}</div>
                <div style={{ fontSize: T.meta, color: C.textFaint, marginTop: 3 }}>{skills.length === 1 ? 'skill proven' : 'skills proven'}</div>
              </div>
              {trackRecord.closeOutRate !== null && (
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, lineHeight: 1, color: C.text }}>
                    {trackRecord.closed}<span style={{ fontSize: 22, color: C.textGhost }}>/{trackRecord.closed + trackRecord.abandoned}</span>
                  </div>
                  <div style={{ fontSize: T.meta, color: C.textFaint, marginTop: 3 }}>projects finished</div>
                </div>
              )}
              {trackRecord.active > 0 && (
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, lineHeight: 1, color: C.text }}>{trackRecord.active}</div>
                  <div style={{ fontSize: T.meta, color: C.textFaint, marginTop: 3 }}>in flight</div>
                </div>
              )}
            </div>

            {skills.length === 0 ? (
              <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.6 }}>
                {githubConnected
                  ? 'Nothing scanned yet. Run a scan and your repositories will start filling this in.'
                  : 'Connect GitHub and scan your repositories — everything on this page grows from that.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {skills.map((s) => {
                  const strong = s.bestLevel >= 3
                  return (
                    <span
                      key={s.skillId}
                      style={{
                        fontSize: T.meta, fontWeight: strong ? 600 : 500,
                        color: strong ? C.accentInk : C.textMuted,
                        background: strong ? '#EDE9FF' : C.surfaceAlt,
                        borderRadius: R.sm, padding: '7px 13px',
                      }}
                    >
                      {s.name} · {LEVEL_NAMES[s.bestLevel] ?? s.bestLevel}
                    </span>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* The one accent moment on the page */}
        <div style={{ background: C.bgDeep, borderRadius: R.lg, padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flexGrow: 1, minWidth: 240 }}>
            <p style={{ fontFamily: F.display, fontSize: T.h2, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF', marginBottom: 6 }}>
              Not sure what to build next?
            </p>
            <p style={{ fontSize: T.bodySm, color: '#A9B0C2', lineHeight: 1.6 }}>
              We&apos;ll look at what open projects are actually asking for, compare it to your record, and hand you something small enough to finish this weekend.
            </p>
          </div>
          <Button href="/goals" variant="accent" size="sm">Show me the gaps</Button>
        </div>

        {/* Active work */}
        {activeEngagements.length > 0 && (
          <Card hoverable={false} padding={24}>
            <SectionTitle>Work in flight</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeEngagements.map((e) => (
                <Row
                  key={e.id}
                  href={`/engagements/${e.id}`}
                  title={e.title}
                  meta={`${e.asPoster ? 'You posted this' : 'You were accepted'} · opened ${relativeDays(e.openedAt)}`}
                  right={<Badge tone={e.stage === 'submitted' ? 'info' : 'neutral'}>{STAGE_LABEL[e.stage] ?? e.stage.replace('_', ' ')}</Badge>}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Applications */}
        <Card hoverable={false} padding={24}>
          <SectionTitle aside={
            <span style={{ fontSize: T.meta, color: C.textFaint }}>
              {MAX_ACTIVE_APPLICATIONS - student.activeApplicationCount} more you can send
            </span>
          }>
            Where you&apos;ve applied
          </SectionTitle>
          {applications.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <p style={{ fontSize: T.body, color: C.textMuted }}>Nothing out yet.</p>
              <Button href="/listings" variant="outline" size="sm">Find something</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {applications.map((a) => {
                const s = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as BadgeTone }
                return (
                  <Row
                    key={a.id}
                    title={a.title}
                    meta={[a.posterName, relativeDays(a.createdAt)].filter(Boolean).join(' · ')}
                    right={
                      <>
                        {a.status === 'submitted' && (
                          <Button variant="quiet" size="sm" onClick={() => withdraw(a.id)} busyLabel={withdrawing === a.id ? 'Withdrawing…' : null}>
                            Withdraw
                          </Button>
                        )}
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </>
                    }
                  />
                )
              })}
            </div>
          )}
        </Card>

        {/* Posted */}
        <Card hoverable={false} padding={24}>
          <SectionTitle aside={<Button href="/listings/new" variant="outline" size="sm">Post a project</Button>}>
            Projects you posted
          </SectionTitle>
          {listings.length === 0 ? (
            <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.6 }}>
              Need a collaborator? Post a project and get matched with students whose repositories actually demonstrate what you need.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {listings.map((l) => (
                <Row
                  key={l.id}
                  href={`/listings/${l.id}/applicants`}
                  title={l.title ?? 'Untitled project'}
                  meta={`${l.applicantCount} ${l.applicantCount === 1 ? 'applicant' : 'applicants'} · posted ${relativeDays(l.createdAt)}`}
                  right={<Badge tone={l.status === 'open' ? 'positive' : 'neutral'}>{l.status === 'open' ? 'Open' : l.status}</Badge>}
                />
              ))}
            </div>
          )}
        </Card>

      </main>
    </div>
  )
}
