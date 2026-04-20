'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { C, F } from '@/app/landing/tokens'
import type { Student, Application, ExperienceRecord } from '@/lib/types'

// ─── Status badge helpers ─────────────────────────────────────────────────────

function AppStatusBadge({ status }: { status: string }) {
  const color = status === 'accepted' ? C.accent : status === 'rejected' ? '#f87171' : C.textMuted
  const bg = status === 'accepted' ? C.accentHover : status === 'rejected' ? 'rgba(248,113,113,0.1)' : C.surfaceAlt
  const border = status === 'accepted' ? C.accentBorder : status === 'rejected' ? 'rgba(248,113,113,0.3)' : C.border
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color, background: bg, border: `1px solid ${border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function ExperienceBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M1 4l2 2 4-4" stroke={C.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Verified
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color: C.textMuted, background: C.surfaceAlt, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, display: 'inline-block' }} aria-hidden="true" />
        In Progress
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color: C.textFaint, background: C.surfaceAlt, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Incomplete
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  student: Student
  applications: (Application & {
    projects?: { title: string | null; companies?: { company_name: string | null } }
  })[]
  experienceRecords: ExperienceRecord[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentDashboardClient({ student, applications, experienceRecords }: Props) {
  const verifiedCount = experienceRecords.filter((r) => r.verification_status === 'verified').length

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={student.full_name ?? undefined} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Profile summary ── */}
        <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {student.full_name ?? 'Your Profile'}
              </h1>
              <p style={{ fontSize: 13, color: C.textMuted, fontFamily: F.mono }}>
                {[student.degree_type, student.major, student.university].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 12px', border: `1px solid ${C.border}`, textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  GitHub ↗
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 12px', border: `1px solid ${C.border}`, textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  LinkedIn ↗
                </a>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: student.skills && student.skills.length > 0 ? 20 : 0 }}>
            <StatCard label="Applications" value={applications.length} />
            <StatCard label="Accepted" value={applications.filter((a) => a.status === 'accepted').length} />
            <StatCard label="Records" value={experienceRecords.length} />
            <StatCard label="Verified" value={verifiedCount} highlight />
          </div>

          {/* Skills */}
          {student.skills && student.skills.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Skills</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {student.skills.map((s) => (
                  <span key={s} style={{ fontSize: 11, padding: '3px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: F.mono }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Experience Records ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Experience Records
            </h2>
            <Link href="/projects" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
              Browse projects →
            </Link>
          </div>

          {experienceRecords.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 6 }}>No experience records yet</p>
              <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
                Get accepted to a project to start earning verified records.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {experienceRecords.map((record) => (
                <div key={record.id} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>
                        {record.project_title ?? 'Project'}
                      </p>
                      <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>{record.company_name}</p>
                    </div>
                    <ExperienceBadge status={record.verification_status} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: record.skills_used && record.skills_used.length > 0 ? 10 : 0 }}>
                    {record.start_date && (
                      <span>{fmtDate(record.start_date)}{record.end_date ? ` → ${fmtDate(record.end_date)}` : ''}</span>
                    )}
                    {record.verified_at && (
                      <span style={{ color: C.accent }}>Verified {fmtDate(record.verified_at)}</span>
                    )}
                  </div>
                  {record.skills_used && record.skills_used.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {record.skills_used.map((s) => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 7px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Applications ── */}
        <section>
          <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Applications
          </h2>

          {applications.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 8 }}>No applications yet</p>
              <Link href="/projects" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
                Browse open projects →
              </Link>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              {applications.map((app, i) => (
                <div key={app.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 16, borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>
                      {app.projects?.title ?? 'Project'}
                    </p>
                    <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                      {app.projects?.companies?.company_name ?? ''} · {fmtDate(app.created_at)}
                    </p>
                  </div>
                  <AppStatusBadge status={app.status} />
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? C.accentHover : C.surfaceAlt, border: `1px solid ${highlight ? C.accentBorder : C.border}`, padding: '14px 16px', textAlign: 'center' }}>
      <p style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: highlight ? C.accent : C.text, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, letterSpacing: '0.05em' }}>{label}</p>
    </div>
  )
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
