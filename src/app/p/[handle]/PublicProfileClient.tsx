'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import { Wordmark } from '@/app/landing/Wordmark'
import type { PublicEngagement } from '@/lib/profile/visibility'
import type { TrackRecord } from '@/lib/engagements/lifecycle'

const LEVEL_NAMES: Record<number, string> = { 1: 'Familiar', 2: 'Practiced', 3: 'Strong', 4: 'Advanced', 5: 'Expert' }

interface PublicStudent {
  fullName: string | null
  university: string | null
  major: string | null
  degreeType: string | null
  graduationYear: number | null
  handle: string | null
  githubUsername: string | null
  linkedinUrl: string | null
  selfReportedSkills: string[]
}

export default function PublicProfileClient({
  student, skills, engagements, trackRecord, isOwner, signedIn,
}: {
  student: PublicStudent
  skills: { skillId: string; name: string; bestLevel: number; artifactCount: number }[]
  engagements: PublicEngagement[]
  trackRecord: TrackRecord
  isOwner: boolean
  signedIn: boolean
}) {
  // Self-reported skills the record doesn't corroborate. Shown, but
  // visually separated and labelled — the whole premise is that claimed
  // and evidenced are different things, so quietly merging them would
  // undo the product.
  const evidencedNames = new Set(skills.map((s) => s.name.toLowerCase()))
  const claimedOnly = student.selfReportedSkills.filter((s) => !evidencedNames.has(s.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {signedIn ? (
        <Navbar userName={undefined} />
      ) : (
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center' }}>
          <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Wordmark height={22} />
          </Link>
        </header>
      )}

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {isOwner && (
          <Card hoverable={false} padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>This is your public profile — exactly as everyone else sees it.</p>
              <Link href="/me" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
                Manage →
              </Link>
            </div>
          </Card>
        )}

        {/* Header */}
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: '-0.02em' }}>
            {student.fullName ?? 'Student'}
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
            {[student.degreeType, student.major, student.university, student.graduationYear ? `Class of ${student.graduationYear}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {student.githubUsername && (
              <a href={`https://github.com/${student.githubUsername}`} target="_blank" rel="noopener noreferrer" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                <Icon name="github" size={12} /> {student.githubUsername}
              </a>
            )}
            {student.linkedinUrl && (
              <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                <Icon name="linkedin" size={12} /> LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Verified skills — the point of the page */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Verified skills</h2>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
            Derived from code they actually wrote — commit-attributed, in repos they linked themselves. Not self-reported.
          </p>
          {skills.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 13, color: C.textFaint }}>No verified skills on this record yet.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {skills.map((s) => {
                const c = tagColor(s.name)
                return (
                  <span
                    key={s.skillId}
                    title={`${s.artifactCount} project${s.artifactCount === 1 ? '' : 's'}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}
                  >
                    {s.name}
                    <span style={{ fontWeight: 400, opacity: 0.75 }}>{LEVEL_NAMES[s.bestLevel] ?? s.bestLevel}</span>
                  </span>
                )
              })}
            </div>
          )}
        </section>

        {/* Track record */}
        {trackRecord.closeOutRate !== null && (
          <Card hoverable={false} padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{Math.round(trackRecord.closeOutRate * 100)}%</p>
                <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>close-out rate</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{trackRecord.closed}</p>
                <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>collaborations completed</p>
              </div>
            </div>
          </Card>
        )}

        {/* Public work. Rendered only when there's something to show —
            an empty section with a heading would itself signal that
            something was withheld. */}
        {engagements.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Collaborations</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {engagements.map((e) => (
                <Card key={e.id} hoverable={false} padding={16}>
                  {e.redacted ? (
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.textMuted }}>Confidential engagement</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        Completed{e.closedAt ? ` ${new Date(e.closedAt).toLocaleDateString()}` : ''} · details withheld
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.listingTitle ?? 'Untitled project'}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: e.description ? 8 : 0 }}>
                        {[e.posterDisplayName, e.closedAt ? `completed ${new Date(e.closedAt).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                      </p>
                      {e.description && (
                        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.description}</p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Self-reported, clearly separated */}
        {claimedOnly.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Also claims</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
              Self-reported. Nothing in their linked repos evidences these yet.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {claimedOnly.map((s) => (
                <span key={s} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'transparent', border: `1px dashed ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          Verified by <Link href="/" style={{ color: C.textMuted, textDecoration: 'none' }}>Workmark</Link> — skills evidenced by commit-attributed code, not self-reported.
        </p>
      </main>
    </div>
  )
}
