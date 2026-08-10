'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'

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

function StatusPill({ label }: { label: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    accepted: { color: '#15803D', bg: 'rgba(21,128,61,0.12)', border: 'rgba(21,128,61,0.35)' },
    shortlisted: { color: '#0369A1', bg: 'rgba(3,105,161,0.12)', border: 'rgba(3,105,161,0.35)' },
    rejected: { color: '#B91C1C', bg: 'rgba(185,28,28,0.12)', border: 'rgba(185,28,28,0.3)' },
    open: { color: '#15803D', bg: 'rgba(21,128,61,0.12)', border: 'rgba(21,128,61,0.35)' },
  }
  const s = map[label] ?? { color: C.textFaint, bg: C.surfaceAlt, border: C.border }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: s.color, background: s.bg, border: `1px solid ${s.border}`, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{children}</h2>
      {action}
    </div>
  )
}

export default function StudentDashboardClient({ data }: { data: DashboardData }) {
  const { student, skills, applications, listings, engagements, githubConnected } = data
  const activeEngagements = engagements.filter((e) => e.stage !== 'closed' && e.stage !== 'abandoned')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={student.fullName ?? undefined} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Header */}
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
            {student.fullName ?? 'Your dashboard'}
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {[student.degreeType, student.major, student.university].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* GitHub prompt — the whole record depends on this */}
        {!githubConnected && (
          <Card hoverable={false} padding={20} style={{ borderColor: C.accentBorder, background: C.accentHover }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Connect GitHub to build your record</p>
                <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
                  Your verified skills come from the repos you link. Nothing else on Workmark works without it.
                </p>
              </div>
              <Link href="/student/github" className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex', flexShrink: 0 }}>
                <Icon name="github" size={13} /> Connect
              </Link>
            </div>
          </Card>
        )}

        {/* Verified skills */}
        <section>
          <SectionHeading action={
            <Link href="/student/github" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
              Full record →
            </Link>
          }>
            Verified skills ({skills.length})
          </SectionHeading>
          {skills.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 13, color: C.textFaint }}>
                {githubConnected
                  ? 'No evidence yet — scan your repos to build your record.'
                  : 'Connect GitHub and scan your repos to build your record.'}
              </p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skills.map((s) => {
                const c = tagColor(s.name)
                return (
                  <span key={s.skillId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                    {s.name}
                    <span style={{ fontWeight: 400, opacity: 0.75 }}>{LEVEL_NAMES[s.bestLevel] ?? s.bestLevel}</span>
                  </span>
                )
              })}
            </div>
          )}
        </section>

        {/* Active engagements */}
        {activeEngagements.length > 0 && (
          <section>
            <SectionHeading>Active work ({activeEngagements.length})</SectionHeading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeEngagements.map((e) => (
                <Card key={e.id} href={`/engagements/${e.id}`} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.title}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {e.asPoster ? 'You posted this' : 'You were accepted'} · opened {new Date(e.openedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusPill label={e.stage.replace('_', ' ')} />
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* My applications */}
        <section>
          <SectionHeading action={
            <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
              {student.activeApplicationCount}/{MAX_ACTIVE_APPLICATIONS} active slots
            </span>
          }>
            Applications sent ({applications.length})
          </SectionHeading>
          {applications.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 13, color: C.textFaint }}>You haven&apos;t applied to anything yet.</p>
                <Link href="/listings" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  Browse projects
                </Link>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {applications.map((a) => (
                <Card key={a.id} href={`/listings/${a.listingId}`} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{a.title}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {[a.posterName, `applied ${new Date(a.createdAt).toLocaleDateString()}`, a.fitTier ? FIT_TIER_LABEL[a.fitTier as FitTier] : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusPill label={a.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* My listings */}
        <section>
          <SectionHeading action={
            <Link href="/listings/new" className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              <Icon name="plus" size={12} /> Post a project
            </Link>
          }>
            Projects you posted ({listings.length})
          </SectionHeading>
          {listings.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 13, color: C.textFaint }}>
                Need a collaborator? Post a project and get matched with students whose repos actually demonstrate the skills you need.
              </p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {listings.map((l) => (
                <Card key={l.id} href={`/listings/${l.id}/applicants`} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{l.title ?? 'Untitled project'}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {l.applicantCount} applicant{l.applicantCount === 1 ? '' : 's'} · posted {new Date(l.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusPill label={l.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
