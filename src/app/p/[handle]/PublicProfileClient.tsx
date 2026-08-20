'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Kicker, Stat } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { C, F, R } from '@/lib/theme/dark-tokens'
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
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: 60, display: 'flex', alignItems: 'center' }}>
          <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Wordmark height={22} />
          </Link>
        </header>
      )}

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        {isOwner && (
          <Card hoverable={false} padding="10px 15px" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 12.5, color: C.textMuted }}>This is your public profile — exactly as everyone else sees it.</p>
              <Link href="/me" style={{ fontSize: 12.5, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
            </div>
          </Card>
        )}

        {/* A stranger reads top to bottom and can't choose where to start,
            so the identity and the argument for it share one band instead
            of competing across a two-column layout. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32, alignItems: 'center', paddingBottom: 22, borderBottom: `1px solid ${C.border}`, marginBottom: 26 }} className="mob-1col">
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 29, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1, color: C.text, marginBottom: 9 }}>
              {student.fullName ?? 'Student'}
            </h1>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 13 }}>
              {[student.degreeType, student.major, student.university, student.graduationYear ? `Class of ${student.graduationYear}` : null]
                .filter(Boolean).join(' · ')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {student.githubUsername && (
                <a href={`https://github.com/${student.githubUsername}`} target="_blank" rel="noopener noreferrer" className="nb-btn nb-btn-outline nb-btn-sm">
                  <Icon name="github" size={12} /> {student.githubUsername}
                </a>
              )}
              {student.linkedinUrl && (
                <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="nb-btn nb-btn-outline nb-btn-sm">
                  <Icon name="linkedin" size={12} /> LinkedIn
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, borderLeft: `1px solid ${C.border}`, paddingLeft: 28 }} className="mob-static">
            <Stat value={skills.length} label={skills.length === 1 ? 'skill proven from code' : 'skills proven from code'} />
            {trackRecord.closeOutRate !== null && (
              <>
                <Stat value={trackRecord.closed} label="collaborations completed" />
                <Stat value={`${Math.round(trackRecord.closeOutRate * 100)}%`} label="close-out rate" />
              </>
            )}
          </div>
        </div>

        <div className="nb-split">
          <div>
            {/* Verified skills — the point of the page */}
            <div style={{ marginBottom: 30 }}>
              <Kicker style={{ marginBottom: 5 }}>What the code shows</Kicker>
              <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.45, marginBottom: 13, maxWidth: 460 }}>
                Derived from code they actually wrote — commit-attributed, in repositories they linked themselves. Not self-reported.
              </p>
              {skills.length === 0 ? (
                <Card hoverable={false} padding={17}><p style={{ fontSize: 13, color: C.textFaint }}>No verified skills on this record yet.</p></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {skills.map((s) => (
                    <div key={s.skillId}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontSize: 11.5, color: C.textGhost }}>
                          {LEVEL_NAMES[s.bestLevel] ?? s.bestLevel} · {s.artifactCount} project{s.artifactCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} style={{ flexGrow: 1, height: 5, borderRadius: 3, background: i <= s.bestLevel ? C.accent : C.border }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Self-reported, clearly separated */}
            {claimedOnly.length > 0 && (
              <div style={{ marginBottom: 30 }}>
                <Kicker style={{ marginBottom: 5 }}>Also claims</Kicker>
                <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.45, marginBottom: 10 }}>
                  Self-reported. Nothing in their linked repositories evidences these yet.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {claimedOnly.map((s) => (
                    <span key={s} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: R.pill, background: 'transparent', border: `1px dashed ${C.border}`, color: C.textGhost }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 11.5, color: C.textGhost, lineHeight: 1.55, borderTop: `1px solid ${C.border}`, paddingTop: 15 }}>
              Verified by <Link href="/" style={{ color: C.textMuted, textDecoration: 'none' }}>Workmark</Link> — skills evidenced by commit-attributed code, not self-reported.
            </p>
          </div>

          {/* Public work. Rendered only when there's something to show — an
              empty section with a heading would itself signal that
              something was withheld. */}
          {engagements.length > 0 && (
            <div>
              <Kicker style={{ marginBottom: 11 }}>Collaborations</Kicker>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {engagements.map((e) => (
                  <Card key={e.id} hoverable={false} padding={16}>
                    {e.redacted ? (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 3 }}>Confidential engagement</p>
                        <p style={{ fontSize: 11.5, color: C.textGhost }}>
                          Completed{e.closedAt ? ` ${new Date(e.closedAt).toLocaleDateString()}` : ''} · details withheld
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: C.text, marginBottom: 3 }}>
                          {e.listingTitle ?? 'Untitled project'}
                        </p>
                        <p style={{ fontSize: 11.5, color: C.textGhost, marginBottom: e.description ? 9 : 0 }}>
                          {[e.posterDisplayName, e.closedAt ? `completed ${new Date(e.closedAt).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                        </p>
                        {e.description && (
                          <p style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.description}</p>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
