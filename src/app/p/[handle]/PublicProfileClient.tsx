'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import { Kicker, Stat } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'
import type { PublicEngagement } from '@/lib/profile/visibility'
import type { TrackRecord } from '@/lib/engagements/lifecycle'
import { LEVEL_NAMES, SELF_EVIDENCED_CAP } from '@/lib/skills/level-names'
import { LAYOUT } from '@/lib/theme/layout'


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
      {/* Signed-in visitors get the app navbar from the section layout. A
          recruiter opening this link has no account and no use for a nav
          full of "My record" — they get the wordmark and nothing else. */}
      {!signedIn && (
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: 60, display: 'flex', alignItems: 'center' }}>
          <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Wordmark height={22} />
          </Link>
        </header>
      )}

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        {isOwner && (
          <Card hoverable={false} padding="11px 16.5px" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 13, color: C.textMuted }}>This is your public profile — exactly as everyone else sees it.</p>
              <Link href="/me" style={{ fontSize: 13, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
            </div>
          </Card>
        )}

        {/* A stranger reads top to bottom and can't choose where to start,
            so the identity and the argument for it share one band instead
            of competing across a two-column layout. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 36, alignItems: 'center', paddingBottom: 26, borderBottom: `1px solid ${C.border}`, marginBottom: 31 }} className="mob-1col">
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 34, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: C.text, marginBottom: 10.5 }}>
              {student.fullName ?? 'Student'}
            </h1>
            <p style={{ fontSize: 15.5, color: C.textMuted, marginBottom: 14.5 }}>
              {[student.degreeType, student.major, student.university, student.graduationYear ? `Class of ${student.graduationYear}` : null]
                .filter(Boolean).join(' · ')}
            </p>
            <div style={{ display: 'flex', gap: 8.5, flexWrap: 'wrap' }}>
              {student.githubUsername && (
                <a href={`https://github.com/${student.githubUsername}`} target="_blank" rel="noopener noreferrer" className="nb-btn nb-btn-outline nb-btn-sm">
                  <Icon name="github" size={12.5} /> {student.githubUsername}
                </a>
              )}
              {student.linkedinUrl && (
                <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="nb-btn nb-btn-outline nb-btn-sm">
                  <Icon name="linkedin" size={12.5} /> LinkedIn
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12.5, borderLeft: `1px solid ${C.border}`, paddingLeft: 32 }} className="mob-static">
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
            <div style={{ marginBottom: 35 }}>
              <Kicker style={{ marginBottom: 5.5 }}>What the code shows</Kicker>
              <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginBottom: 14, maxWidth: 480 }}>
                Derived from code they actually wrote — commit-attributed, in repositories they linked themselves. Not self-reported.
              </p>
              {skills.length === 0 ? (
                <Card hoverable={false} padding={19.5}><p style={{ fontSize: 14, color: C.textFaint }}>No verified skills on this record yet.</p></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {skills.map((s) => (
                    <div key={s.skillId}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6.5 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontSize: 12, color: C.textGhost }}>
                          {LEVEL_NAMES[s.bestLevel] ?? s.bestLevel} · {s.artifactCount} project{s.artifactCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      {/* Only the levels anyone can currently reach are drawn.
                          A five-segment bar that stops at three reads as "3
                          out of 5" — mediocre — when three is the maximum
                          every record on the platform tops out at. Showing a
                          ceiling nobody can pass makes everyone look worse
                          than they are, to the exact audience that matters. */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {Array.from({ length: SELF_EVIDENCED_CAP }, (_, k) => k + 1).map((i) => (
                          <span key={i} style={{ flexGrow: 1, height: 5.5, borderRadius: 3, background: i <= s.bestLevel ? C.accent : C.border }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Self-reported, clearly separated */}
            {claimedOnly.length > 0 && (
              <div style={{ marginBottom: 35 }}>
                <Kicker style={{ marginBottom: 5.5 }}>Also claims</Kicker>
                <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginBottom: 11 }}>
                  Self-reported. Nothing in their linked repositories evidences these yet.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5.5 }}>
                  {claimedOnly.map((s) => (
                    <span key={s} style={{ fontSize: 12, padding: '3.5px 9.5px', borderRadius: R.pill, background: 'transparent', border: `1px dashed ${C.border}`, color: C.textGhost }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 16.5 }}>
              Verified by <Link href="/" style={{ color: C.textMuted, textDecoration: 'none' }}>Workmark</Link> — skills evidenced by commit-attributed code, not self-reported.
            </p>
          </div>

          {/* Public work. Rendered only when there's something to show — an
              empty section with a heading would itself signal that
              something was withheld. */}
          {engagements.length > 0 && (
            <div>
              <Kicker style={{ marginBottom: 12 }}>Collaborations</Kicker>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {engagements.map((e) => (
                  <Card key={e.id} hoverable={false} padding={18}>
                    {e.redacted ? (
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, marginBottom: 3 }}>Confidential engagement</p>
                        <p style={{ fontSize: 12, color: C.textGhost }}>
                          Completed{e.closedAt ? ` ${new Date(e.closedAt).toLocaleDateString()}` : ''} · details withheld
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontFamily: F.display, fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, marginBottom: 3 }}>
                          {e.listingTitle ?? 'Untitled project'}
                        </p>
                        <p style={{ fontSize: 12, color: C.textGhost, marginBottom: e.description ? 9.5 : 0 }}>
                          {[e.posterDisplayName, e.closedAt ? `completed ${new Date(e.closedAt).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                        </p>
                        {e.description && (
                          <p style={{ fontSize: 13.5, color: C.textSub, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.description}</p>
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
