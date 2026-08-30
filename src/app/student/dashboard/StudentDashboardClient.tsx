'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { type BadgeTone } from '@/components/ui/Badge'
import { Kicker, Stat } from '@/components/ui/Section'
import { C, F, R, T } from '@/lib/theme/dark-tokens'
import type { TrackRecord } from '@/lib/engagements/lifecycle'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'
import { LAYOUT } from '@/lib/theme/layout'
import LevelTag from '@/components/ui/LevelTag'

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

const MAX_ACTIVE_APPLICATIONS = 5

const APPLICATION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  submitted:   { label: 'Not read yet',       tone: 'neutral' },
  shortlisted: { label: "They're interested", tone: 'info' },
  accepted:    { label: "You're in",          tone: 'positive' },
  rejected:    { label: 'Not this time',      tone: 'neutral' },
  withdrawn:   { label: 'Withdrawn',          tone: 'neutral' },
}

const STAGE_LABEL: Record<string, string> = {
  accepted: 'Getting started',
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

/** One of the three glyphs a to-do can carry. Drawn, never emoji. */
function TodoIcon({ kind, size = 21 }: { kind: Todo['kind']; size?: number }) {
  const stroke = { message: C.accent, signoff: '#94500F', applicants: '#1D4ED8', github: C.accent }[kind]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'message' && (
        <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 014 13.5v-7z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
      )}
      {kind === 'signoff' && (
        <>
          <path d="M6 4h8l4 4v12H6V4z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 13.5l2 2 4-4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === 'applicants' && (
        <>
          <circle cx="9" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
          <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6S13.9 16 14.5 19" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 6.2a3 3 0 010 5.6M17.6 14.8c1.9.6 3.9 2.2 3.4 4.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {kind === 'github' && (
        <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.72c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 015 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.33 4.8-4.56 5.05.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49A10.06 10.06 0 0022 12.25C22 6.58 17.52 2 12 2z" fill={stroke} />
      )}
    </svg>
  )
}

interface Todo {
  key: string
  kind: 'message' | 'signoff' | 'applicants' | 'github'
  /** The fact that matters, not the name of the task. */
  headline: string
  body: string
  /** Shown only on the focal card, where there is room for it. */
  detail?: string
  href: string
  cta: string
  eyebrow: string
}

const ICON_BG: Record<Todo['kind'], string> = {
  message: '#EDE9FF',
  signoff: '#FBEFE0',
  applicants: '#E4EBFF',
  github: '#EDE9FF',
}

export default function StudentDashboardClient({ data, isAdmin = false }: { data: DashboardData; isAdmin?: boolean }) {
  const { student, skills, applications, listings, engagements, githubConnected, trackRecord } = data
  const router = useRouter()
  const { toast } = useToast()
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  const activeEngagements = engagements.filter((e) => e.stage !== 'closed' && e.stage !== 'abandoned')

  async function withdraw(id: string) {
    if (!confirm('Withdraw this application? You can apply again later while the project is still open.')) return
    setWithdrawing(id)
    const supabase = createClient()
    const { error } = await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', id)
    if (error) toast('Could not withdraw.', 'error')
    else { toast('Application withdrawn.', 'success'); router.refresh() }
    setWithdrawing(null)
  }

  // ── What needs you ────────────────────────────────────────────────────
  // Ordered by how much the delay costs. A person waiting on a reply is
  // the most expensive thing on the list; a listing collecting applicants
  // is the least. The first item gets the focal card, so this ordering is
  // the page's judgement about what to do first — it is not decoration.
  const todos: Todo[] = []

  if (!githubConnected) {
    todos.push({
      key: 'github',
      kind: 'github',
      headline: 'Your record is empty until GitHub is connected',
      body: 'Every skill here is read out of repositories you link.',
      detail: 'Nothing else on Workmark does anything useful until this is done — matching, applying and your public profile all read from it.',
      href: '/student/github',
      cta: 'Connect GitHub',
      eyebrow: 'Start here',
    })
  }
  for (const a of applications) {
    if (a.status === 'accepted') {
      todos.push({
        key: `app-${a.id}`,
        kind: 'message',
        headline: `${a.posterName ?? 'The poster'} accepted you`,
        body: a.title,
        detail: 'Their contact details are on the project page. The engagement starts when one of you opens it.',
        href: `/listings/${a.listingId}`,
        cta: 'Open it',
        eyebrow: 'Do this first',
      })
    } else if (a.status === 'shortlisted') {
      todos.push({
        key: `app-${a.id}`,
        kind: 'message',
        headline: `${a.posterName ?? 'A poster'} is deciding`,
        body: a.title,
        detail: `They shortlisted you ${relativeDays(a.createdAt)} and can send two more messages before choosing. Not replying reads as not interested.`,
        href: `/listings/${a.listingId}`,
        cta: 'Reply',
        eyebrow: 'Do this first',
      })
    }
  }
  for (const e of activeEngagements) {
    if (e.stage === 'submitted') {
      todos.push({
        key: `eng-${e.id}`,
        kind: 'signoff',
        headline: 'Agree on what was built',
        body: e.title,
        detail: 'Nothing lands on your record until you both sign off, and neither of you can write the other’s version of what happened.',
        href: `/engagements/${e.id}`,
        cta: 'Review it',
        eyebrow: 'Waiting on you',
      })
    }
  }
  for (const l of listings) {
    if (l.status === 'open' && l.applicantCount > 0) {
      todos.push({
        key: `list-${l.id}`,
        kind: 'applicants',
        headline: `${l.applicantCount} ${l.applicantCount === 1 ? 'person has' : 'people have'} applied to your project`,
        body: l.title ?? 'Untitled project',
        detail: 'You can see exactly which of your required skills each of them has evidence for, and which they only claimed.',
        href: `/listings/${l.id}/applicants`,
        cta: 'See them',
        eyebrow: 'Your project',
      })
    }
  }

  const [lead, ...restTodos] = todos
  const rail = restTodos.slice(0, 2)
  const overflow = restTodos.slice(2)

  // Everything that is genuinely not the reader's move. Deliberately one
  // list rather than three sections: from where they sit, an unread
  // application and an in-flight engagement are the same thing.
  const waiting: { key: string; title: string; meta: string; right: React.ReactNode; href: string }[] = []
  for (const e of activeEngagements) {
    if (e.stage === 'submitted') continue
    waiting.push({
      key: `w-eng-${e.id}`,
      title: e.title,
      meta: `${e.asPoster ? 'You posted this' : 'In progress'} · opened ${relativeDays(e.openedAt)}`,
      right: <span style={{ fontSize: 13.5, color: C.textFaint }}>{STAGE_LABEL[e.stage] ?? e.stage}</span>,
      href: `/engagements/${e.id}`,
    })
  }
  for (const a of applications) {
    if (a.status === 'accepted' || a.status === 'shortlisted') continue
    const s = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as BadgeTone }
    waiting.push({
      key: `w-app-${a.id}`,
      title: a.title,
      meta: [
        `Applied ${relativeDays(a.createdAt)}`,
        a.posterName,
        a.fitTier ? FIT_TIER_LABEL[a.fitTier as FitTier] : null,
      ].filter(Boolean).join(' · '),
      right: a.status === 'submitted' ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={(e) => { e.preventDefault(); withdraw(a.id) }}
            disabled={withdrawing === a.id}
            style={{ fontSize: 13.5, color: C.textGhost, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
          >
            {withdrawing === a.id ? 'Withdrawing…' : 'Withdraw'}
          </button>
          <span style={{ fontSize: 13.5, color: C.textFaint }}>{s.label}</span>
        </span>
      ) : (
        <span style={{ fontSize: 13.5, color: C.textFaint }}>{s.label}</span>
      ),
      href: `/listings/${a.listingId}`,
    })
  }
  for (const l of listings) {
    if (l.status === 'open' && l.applicantCount > 0) continue
    waiting.push({
      key: `w-list-${l.id}`,
      title: l.title ?? 'Untitled project',
      meta: `Your project · posted ${relativeDays(l.createdAt)}`,
      right: <span style={{ fontSize: 13.5, color: C.textFaint }}>{l.status === 'open' ? 'No applicants yet' : l.status}</span>,
      href: `/listings/${l.id}/applicants`,
    })
  }

  const firstName = student.fullName?.trim().split(/\s+/)[0]

  const nudge = (
    <div style={{ background: C.bgDeep, borderRadius: R.lg, padding: 21, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 154 }}>
      <div>
        <p style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.25, marginBottom: 7 }}>
          Not sure what to build next?
        </p>
        <p style={{ fontSize: 13.5, color: '#A9B0C2', lineHeight: 1.55 }}>
          We&apos;ll show you which skills open projects keep asking for that your record
          doesn&apos;t cover yet — and give you a project worth building to close one.
        </p>
      </div>
      <div style={{ marginTop: 16 }}>
        <Button href="/goals" variant="accent" size="sm">Show me the gaps</Button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        {/* Header — the answer, not a greeting */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: C.text, marginBottom: 4.5 }}>
              {todos.length === 0
                ? `You're all caught up${firstName ? `, ${firstName}` : ''}`
                : `${todos.length === 1 ? 'One thing needs' : `${todos.length} things need`} you`}
            </h1>
            {(student.degreeType || student.major || student.university) && (
              <p style={{ fontSize: 14, color: C.textMuted }}>
                {[student.degreeType, student.major, student.university].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <span style={{ fontSize: 14, color: C.textGhost }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>

        {/* Focal band. The lead item is roughly four times the area of a
            supporting tile, so the eye lands rather than searches. When the
            rail has only one item the focal drops to a single row so the
            band stays square-edged instead of ragged. */}
        {lead && (
          <div className="nb-g3" style={{ marginBottom: 18 }}>
            <div
              className="nb-focal nb-s2"
              style={{ gridRow: rail.length > 1 ? 'span 2' : 'span 1', padding: '27px 29px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 17.5 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: ICON_BG[lead.kind], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TodoIcon kind={lead.kind} size={16} />
                  </div>
                  <Kicker style={{ color: C.accentInk }}>{lead.eyebrow}</Kicker>
                </div>
                <p style={{ fontFamily: F.display, fontSize: 27, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: C.text, marginBottom: 10.5 }}>
                  {lead.headline}
                </p>
                <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, maxWidth: 455 }}>
                  {lead.detail ?? lead.body}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14.5, marginTop: 24, flexWrap: 'wrap' }}>
                <Button href={lead.href} variant="accent">{lead.cta}</Button>
                <span style={{ fontSize: 14, color: C.textGhost }}>{lead.body}</span>
              </div>
            </div>

            {rail.map((t) => (
              <Card key={t.key} hoverable={false} padding={18} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 13, minHeight: 154 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8.5 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8.5, background: ICON_BG[t.kind], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TodoIcon kind={t.kind} size={15.5} />
                    </div>
                    <Kicker>{t.eyebrow}</Kicker>
                  </div>
                  <p style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25, color: C.text, marginBottom: 4 }}>
                    {t.headline}
                  </p>
                  <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.45 }}>{t.body}</p>
                </div>
                <div><Button href={t.href} variant="outline" size="sm">{t.cta}</Button></div>
              </Card>
            ))}

            {/* With no rail items the third column would sit empty, so the
                page's one accent panel moves up to fill it. */}
            {rail.length === 0 && nudge}
          </div>
        )}

        {overflow.length > 0 && (
          <div className="nb-g3" style={{ marginBottom: 18 }}>
            {overflow.map((t) => (
              <Card key={t.key} hoverable={false} padding={16} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 13, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>{t.headline}</p>
                  <p style={{ fontSize: 13, color: C.textGhost }}>{t.body}</p>
                </div>
                <Button href={t.href} variant="outline" size="sm">{t.cta}</Button>
              </Card>
            ))}
          </div>
        )}

        {/* Second band — the record at two thirds against the accent panel */}
        <div className={lead && rail.length === 0 ? undefined : 'nb-g2'} style={{ marginBottom: 18 }}>
          <Card ruled hoverable={false} padding={23}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 19, marginBottom: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 35, flexWrap: 'wrap' }}>
                <Stat value={skills.length} label={skills.length === 1 ? 'Skill proven' : 'Skills proven'} />
                {trackRecord.closeOutRate !== null && (
                  <Stat value={trackRecord.closed} suffix={`/${trackRecord.closed + trackRecord.abandoned}`} label="Projects finished" />
                )}
                {trackRecord.active > 0 && <Stat value={trackRecord.active} label="In flight" />}
              </div>
              <Link href="/me" style={{ fontSize: 13, color: C.accent, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                See it all →
              </Link>
            </div>

            {skills.length === 0 ? (
              <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.6 }}>
                {githubConnected
                  ? 'Nothing scanned yet. Run a scan and your repositories will start filling this in.'
                  : 'Connect GitHub and scan your repositories — everything on this page grows from that.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {skills.map((s) => {
                  const strong = s.bestLevel >= 3
                  return (
                    <span
                      key={s.skillId}
                      style={{
                        fontSize: 13, fontWeight: strong ? 600 : 500,
                        color: strong ? C.accentInk : C.textMuted,
                        background: strong ? '#EDE9FF' : C.surfaceAlt,
                        borderRadius: R.sm, padding: '5.5px 11px',
                      }}
                    >
                      {s.name} · <LevelTag level={s.bestLevel} />
                    </span>
                  )
                })}
              </div>
            )}
          </Card>

          {!(lead && rail.length === 0) && nudge}
        </div>

        {/* Closing strip — everything that isn't the reader's move */}
        {waiting.length > 0 && (
          <Card hoverable={false} padding="14.5px 22px 16.5px">
            <Kicker style={{ marginBottom: 5.5 }}>Your postings</Kicker>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {waiting.map((w) => (
                <div key={w.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 13, padding: '10px 0' }}>
                  <Link href={w.href} style={{ minWidth: 0, textDecoration: 'none' }}>
                    <p style={{ fontSize: 14, color: C.textSub }}>{w.title}</p>
                    <p style={{ fontSize: 13, color: C.textGhost }}>{w.meta}</p>
                  </Link>
                  <span style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{w.right}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {waiting.length === 0 && todos.length === 0 && (
          <Card hoverable={false} padding={23}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: F.display, fontSize: 17.5, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 4 }}>
                  Nothing out, nothing in flight.
                </p>
                <p style={{ fontSize: 14, color: C.textMuted }}>
                  You have {MAX_ACTIVE_APPLICATIONS - student.activeApplicationCount} application slots free.
                </p>
              </div>
              <Button href="/listings" variant="ink" size="sm">Find work</Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
