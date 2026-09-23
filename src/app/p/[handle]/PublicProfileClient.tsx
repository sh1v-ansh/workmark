'use client'

import { useState } from 'react'
import Link from 'next/link'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import SkillChip from '@/components/skills/SkillChip'
import { Kicker } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'
import { InviteModal } from '@/app/listings/PeopleTab'
import type { PublicEngagement } from '@/lib/profile/visibility'
import type { TrackRecord } from '@/lib/engagements/lifecycle'
import type { InvitableProject } from '@/lib/listings/people'
import { LEVEL_NAMES } from '@/lib/skills/level-names'
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

function initials(name: string | null): string {
  return (name ?? 'S').trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * A student's profile: who they are, what their code proves, and what they
 * have finished with other people.
 *
 * Laid out for a stranger reading top to bottom: identity and the one action
 * first, then skills grouped by level (the point of the page), then work
 * done with others. The same component serves the shareable /p/[handle]
 * page and the /people/[id] page opened from Find work.
 */
export default function PublicProfileClient({
  studentId, student, skills, engagements, trackRecord, isOwner, signedIn, invite = null,
}: {
  studentId: string
  student: PublicStudent
  skills: { skillId: string; name: string; bestLevel: number; artifactCount: number }[]
  engagements: PublicEngagement[]
  trackRecord: TrackRecord
  isOwner: boolean
  signedIn: boolean
  /** Present when the viewer may invite this student to a project. */
  invite?: { projects: InvitableProject[] } | null
}) {
  const [inviting, setInviting] = useState(false)

  // Self-reported skills the record does not back up. Shown apart and
  // labelled, because claimed and proven are different things.
  const evidencedNames = new Set(skills.map((s) => s.name.toLowerCase()))
  const claimedOnly = student.selfReportedSkills.filter((s) => !evidencedNames.has(s.toLowerCase()))

  // Highest level first, so the strongest work is what a reader sees first.
  const levels = Array.from(new Set(skills.map((s) => s.bestLevel))).sort((a, b) => b - a)
  const line = [
    [student.degreeType, student.major].filter(Boolean).join(' '),
    student.university,
    student.graduationYear ? `Class of ${student.graduationYear}` : null,
  ].filter(Boolean).join(' · ')

  const stats: [string | number, string][] = [
    [skills.length, skills.length === 1 ? 'Verified skill' : 'Verified skills'],
  ]
  if (trackRecord.closeOutRate !== null) {
    stats.push([trackRecord.closed, trackRecord.closed === 1 ? 'Project finished' : 'Projects finished'])
    stats.push([`${Math.round(trackRecord.closeOutRate * 100)}%`, 'Finish rate'])
  }

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>
      {/* Signed-out visitors (a recruiter with a link) get the wordmark and
          nothing else; signed-in visitors get the app navbar from the layout. */}
      {!signedIn && (
        <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: 60, display: 'flex', alignItems: 'center' }}>
          <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Wordmark height={22} />
          </Link>
        </header>
      )}

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>
        {isOwner && (
          <Card hoverable={false} padding="11px 16px" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: C.textMuted }}>This is how other people see your profile.</p>
              <Button href="/me" variant="outline" size="sm">Edit my record</Button>
            </div>
          </Card>
        )}

        {/* ── Who ── */}
        <Card hoverable={false} padding={26} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div
              aria-hidden="true"
              style={{
                width: 72, height: 72, borderRadius: 999, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(145deg, #EEE9FF 0%, #F7F5FF 60%, #FFFFFF 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(97,66,245,0.18)',
                fontFamily: F.display, fontSize: 24, fontWeight: 600, color: C.accent,
              }}
            >
              {initials(student.fullName)}
            </div>

            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <h1 style={{ fontFamily: F.display, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: C.text, marginBottom: 6 }}>
                {student.fullName ?? 'Student'}
              </h1>
              {line && <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 12 }}>{line}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {invite && (
                  <Button variant="accent" size="sm" onClick={() => setInviting(true)}>Invite to a project</Button>
                )}
                {student.githubUsername && (
                  <a href={`https://github.com/${student.githubUsername}`} target="_blank" rel="noopener noreferrer" className="nb-btn nb-btn-outline nb-btn-sm">
                    <Icon name="github" size={13} /> GitHub
                  </a>
                )}
                {student.linkedinUrl && (
                  <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer" className="nb-btn nb-btn-outline nb-btn-sm">
                    <Icon name="linkedin" size={13} /> LinkedIn
                  </a>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {stats.map(([value, label]) => (
                <div key={label} style={{ minWidth: 96, padding: '12px 14px', borderRadius: R.md, background: C.surfaceAlt }}>
                  <p style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 13, color: C.textMuted, marginTop: 5 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="nb-split">
          {/* ── What the code shows ── */}
          <Card hoverable={false} padding={24}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <h2 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 600, color: C.text }}>Verified skills</h2>
              <span style={{ fontSize: 13, color: C.textMuted }}>From code they wrote, not self-reported</span>
            </div>

            {skills.length === 0 ? (
              <p style={{ fontSize: 14, color: C.textMuted }}>No verified skills yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 18 }}>
                {levels.map((level) => {
                  const atLevel = skills.filter((s) => s.bestLevel === level)
                  return (
                    <div key={level}>
                      <Kicker style={{ marginBottom: 9 }}>{LEVEL_NAMES[level] ?? `Level ${level}`} · {atLevel.length}</Kicker>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {atLevel.map((s) => <SkillChip key={s.skillId} name={s.name} level={s.bestLevel} showLevel={false} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {claimedOnly.length > 0 && (
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.borderFaint}` }}>
                <Kicker style={{ marginBottom: 9 }}>Also claims, not yet verified</Kicker>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {claimedOnly.map((s) => (
                    <span key={s} style={{ fontSize: 13, padding: '3.5px 10px', borderRadius: R.pill, border: `1px dashed ${C.border}`, color: C.textMuted }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── Work with other people ── */}
          <div>
            <Kicker style={{ marginBottom: 10 }}>Projects with others</Kicker>
            {engagements.length === 0 ? (
              <Card hoverable={false} padding={18}>
                <p style={{ fontSize: 14, color: C.textMuted }}>No finished projects with others yet.</p>
              </Card>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {engagements.map((e) => (
                  <Card key={e.id} hoverable={false} padding={18}>
                    {e.redacted ? (
                      <>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.textSub, marginBottom: 3 }}>Confidential project</p>
                        <p style={{ fontSize: 13, color: C.textMuted }}>
                          Finished{e.closedAt ? ` ${new Date(e.closedAt).toLocaleDateString()}` : ''} · details private
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontFamily: F.display, fontSize: 15.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                          {e.listingTitle ?? 'Untitled project'}
                        </p>
                        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: e.description ? 8 : 0 }}>
                          {[e.posterDisplayName, e.closedAt ? `finished ${new Date(e.closedAt).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                        </p>
                        {e.description && (
                          <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.description}</p>
                        )}
                      </>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 26 }}>
          Verified by <Link href="/" style={{ color: C.accent, textDecoration: 'none' }}>Workmark</Link> from commits in repositories they linked themselves.
        </p>
      </main>

      {invite && (
        <InviteModal
          person={inviting ? { id: studentId, name: student.fullName ?? 'this student' } : null}
          projects={invite.projects}
          onClose={() => setInviting(false)}
        />
      )}
    </div>
  )
}
