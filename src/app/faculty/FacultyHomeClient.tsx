'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { C, R, T, state } from '@/lib/theme/dark-tokens'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'

export interface FacultyData {
  name: string | null
  university: string | null
  verified: boolean
  listings: {
    id: string
    title: string
    status: string
    createdAt: string
    newApplicants: number
    totalApplicants: number
  }[]
  waiting: {
    id: string
    listingId: string
    listingTitle: string
    studentName: string
    fitTier: string | null
    appliedAt: string
  }[]
  active: {
    id: string
    listingTitle: string
    studentName: string
    stage: string
    openedAt: string
  }[]
}

const STAGE_LABEL: Record<string, string> = {
  accepted: 'Just started',
  in_progress: 'Building',
  submitted: 'Submitted — needs your review',
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

export default function FacultyHomeClient({ data }: { data: FacultyData }) {
  const { waiting, active, listings } = data
  const openListings = listings.filter((l) => l.status === 'open')
  const needsReview = active.filter((e) => e.stage === 'submitted')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: 1000, margin: '0 auto', padding: '30px 28px 72px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            <Kicker>Faculty</Kicker>
            {/* Shown in both states on purpose. A badge that appears only
                when something is unconfirmed teaches people to read its
                absence as nothing, when absence is the meaningful half. */}
            <Badge tone={data.verified ? 'positive' : 'caution'}>
              {data.verified ? 'Verified faculty' : 'Verification pending'}
            </Badge>
          </div>
          <h1 style={{ fontSize: T.h1, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, marginBottom: 7 }}>
            {waiting.length + needsReview.length > 0
              ? `${waiting.length + needsReview.length} thing${waiting.length + needsReview.length === 1 ? '' : 's'} need you`
              : 'Nothing needs you right now'}
          </h1>
          <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6, maxWidth: '60ch' }}>
            {data.university ? `${data.university} · ` : ''}
            {openListings.length} open project{openListings.length === 1 ? '' : 's'},
            {' '}{active.length} student{active.length === 1 ? '' : 's'} building.
          </p>
        </div>

        {/* Said plainly rather than hidden. An unconfirmed faculty account
            works fully — someone should know which state they're in without
            having to ask, and what it costs them until it changes. */}
        {!data.verified && (
          <div style={{ background: state.cautionBg, borderRadius: R.md, padding: '13px 17px', marginBottom: 22 }}>
            <p style={{ fontSize: 13.5, color: state.caution, lineHeight: 1.6 }}>
              We haven&apos;t confirmed your faculty status yet. Everything works meanwhile —
              post projects, review applicants, run engagements. Until we do, your account
              reads as unconfirmed rather than verified faculty. It usually takes a day or two
              and there&apos;s nothing you need to do.
            </p>
          </div>
        )}

        <div className="nb-g3" style={{ marginBottom: 26 }}>
          {/* The focal column: people waiting on a decision from this person. */}
          <div className="nb-s2">
            <Card hoverable={false} padding={21}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <Kicker>Waiting on you</Kicker>
                {waiting.length > 0 && (
                  <span style={{ fontSize: 13, color: C.textGhost }}>{waiting.length} applicant{waiting.length === 1 ? '' : 's'}</span>
                )}
              </div>

              {waiting.length === 0 && needsReview.length === 0 ? (
                <p style={{ fontSize: 14.5, color: C.textFaint, lineHeight: 1.6 }}>
                  No applications or submissions to look at. When a student applies you&apos;ll
                  see them here.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {needsReview.map((e) => (
                    <Link
                      key={e.id}
                      href={`/engagements/${e.id}`}
                      style={{
                        display: 'block', textDecoration: 'none',
                        background: state.cautionBg, borderRadius: R.md, padding: '12px 15px',
                      }}
                    >
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                        {e.studentName} submitted their work
                      </p>
                      <p style={{ fontSize: 13, color: state.caution }}>{e.listingTitle} · close it out</p>
                    </Link>
                  ))}
                  {waiting.map((a) => (
                    <Link
                      key={a.id}
                      href={`/listings/${a.listingId}/applicants`}
                      style={{
                        display: 'block', textDecoration: 'none',
                        background: C.bg, borderRadius: R.md, padding: '12px 15px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{a.studentName}</span>
                        {a.fitTier && (
                          <Badge tone="neutral">{FIT_TIER_LABEL[a.fitTier as FitTier] ?? a.fitTier}</Badge>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: C.textFaint }}>
                        {a.listingTitle} · applied {daysAgo(a.appliedAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card hoverable={false} padding={19}>
              <Kicker style={{ marginBottom: 10 }}>Post a project</Kicker>
              <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55, marginBottom: 13 }}>
                Course work or research. Students see it in Find work and apply against their
                verified record.
              </p>
              <Button href="/listings/new" variant="accent" size="sm" fullWidth>New project</Button>
            </Card>

            <Card hoverable={false} padding={19}>
              <Kicker style={{ marginBottom: 9 }}>Building now</Kicker>
              {active.length === 0 ? (
                <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55 }}>Nobody yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {active.slice(0, 5).map((e) => (
                    <Link key={e.id} href={`/engagements/${e.id}`} style={{ textDecoration: 'none' }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{e.studentName}</p>
                      <p style={{ fontSize: 12.5, color: C.textGhost }}>{STAGE_LABEL[e.stage] ?? e.stage}</p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <Kicker>Your projects</Kicker>
            {listings.length > 0 && (
              <Link href="/faculty/listings" style={{ fontSize: 13, color: C.accentInk, textDecoration: 'none', fontWeight: 600 }}>
                See all →
              </Link>
            )}
          </div>

          {listings.length === 0 ? (
            <Card hoverable={false} padding={30}>
              <p style={{ fontSize: 15, color: C.textFaint, textAlign: 'center', lineHeight: 1.6, marginBottom: 15 }}>
                You haven&apos;t posted anything yet. A project can be a piece of course work or a
                slice of research — students apply with a record of what they&apos;ve actually built.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button href="/listings/new" variant="accent">Post your first project</Button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {listings.slice(0, 6).map((l) => (
                <Link
                  key={l.id}
                  href={l.totalApplicants > 0 ? `/listings/${l.id}/applicants` : `/listings/${l.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    textDecoration: 'none', background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: R.md, padding: '13px 16px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{l.title}</span>
                      <Badge tone={l.status === 'open' ? 'positive' : 'neutral'}>{l.status}</Badge>
                    </div>
                    <p style={{ fontSize: 13, color: C.textFaint }}>
                      {l.totalApplicants === 0
                        ? 'No applicants yet'
                        : `${l.totalApplicants} applicant${l.totalApplicants === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  {l.newApplicants > 0 && (
                    <span style={{
                      flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '4px 9px',
                      borderRadius: R.pill, background: C.accent, color: '#fff',
                    }}>
                      {l.newApplicants} new
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
