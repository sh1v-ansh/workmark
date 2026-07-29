'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { C, F } from '@/lib/theme/dark-tokens'
import { useToast } from '@/components/Toast'
import MarketplaceSection from './MarketplaceSection'
import type { Student, Application, ExperienceRecord, GithubEvidencedSkill, GithubRepoProfile, Project, ContactShare } from '@/lib/types'

function AppStatusBadge({ status }: { status: string }) {
  const color = status === 'accepted' ? C.accent : status === 'rejected' ? '#DC2626' : C.textMuted
  const bg = status === 'accepted' ? C.accentHover : status === 'rejected' ? 'rgba(248,113,113,0.1)' : C.surfaceAlt
  const border = status === 'accepted' ? C.accentBorder : status === 'rejected' ? 'rgba(248,113,113,0.3)' : C.border
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color, background: bg, border: `1px solid ${border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function TierBadge({ tier, locked }: { tier: 1 | 2 | null; locked: boolean }) {
  if (!locked) return null
  const label = tier === 1 ? 'Tier 1 · Employer' : tier === 2 ? 'Tier 2 · Faculty' : null
  if (!label) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}`, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      ✓ {label}
    </span>
  )
}

function StatusBadge({ record }: { record: ExperienceRecord }) {
  if (record.locked_at) {
    return <TierBadge tier={record.tier} locked={true} />
  }
  const label = record.verification_status === 'incomplete' ? 'Incomplete' : 'In progress'
  const color = record.verification_status === 'incomplete' ? C.textFaint : C.textMuted
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color, background: C.surfaceAlt, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

interface Props {
  student: Student
  applications: (Application & { projects?: { title: string | null; poster_display_name: string | null } })[]
  experienceRecords: ExperienceRecord[]
  githubSkills: GithubEvidencedSkill[]
  githubRepos: GithubRepoProfile[]
  postedProjects: Project[]
  receivedRequests: Application[]
  contactShares: ContactShare[]
}

export default function StudentDashboardClient({ student, applications, experienceRecords, githubSkills, githubRepos, postedProjects, receivedRequests, contactShares }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [scanning, setScanning] = useState(false)

  const verifiedCount = experienceRecords.filter((r) => !!r.locked_at).length
  const githubConnected = !!student.github_username

  // Surface OAuth callback results as toasts (redirected here from /api/github/callback).
  useEffect(() => {
    const err = searchParams.get('gh_error')
    const ok = searchParams.get('gh_connected')
    if (err) {
      toast(`GitHub connection failed: ${err.replace(/_/g, ' ')}`, 'error')
    } else if (ok) {
      toast('GitHub connected. Click Re-scan repos to extract skills.', 'success')
    }
    if (err || ok) {
      // Clean the URL so the toast doesn't fire again on refresh.
      router.replace('/student/dashboard')
    }
  }, [searchParams, toast, router])

  function connectGithub() {
    window.location.href = '/api/github/oauth-start'
  }

  async function scanRepos() {
    setScanning(true)
    try {
      const res = await fetch('/api/github/scan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed.')
      toast(`Scan complete. Found ${json.skills} skills across ${json.repos} repos.`, 'success')
      window.location.reload()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Scan failed.', 'error')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={student.full_name ?? undefined} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Profile summary ── */}
        <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
                {student.full_name ?? 'Your Profile'}
              </h1>
              <p style={{ fontSize: 13, color: C.textMuted, fontFamily: F.mono }}>
                {[student.degree_type, student.major, student.university].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 12px', border: `1px solid ${C.border}`, textDecoration: 'none' }}>
                  GitHub ↗
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 12px', border: `1px solid ${C.border}`, textDecoration: 'none' }}>
                  LinkedIn ↗
                </a>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: student.skills && student.skills.length > 0 ? 20 : 0 }}>
            <StatCard label="Applications" value={applications.length} />
            <StatCard label="Accepted" value={applications.filter((a) => a.status === 'accepted').length} />
            <StatCard label="Records" value={experienceRecords.length} />
            <StatCard label="Verified" value={verifiedCount} highlight />
          </div>

          {student.skills && student.skills.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Self-reported skills</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {student.skills.map((s) => (
                  <span key={s} style={{ fontSize: 11, padding: '3px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: F.mono }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Verified Work Records (Tier 1 + 2) ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Verified work records
            </h2>
            <Link href="/projects" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
              Browse projects →
            </Link>
          </div>

          {experienceRecords.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 6 }}>No verified work records yet</p>
              <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
                Get accepted to a project and complete the close-out flow to earn your first Tier 1 or Tier 2 record.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {experienceRecords.map((record) => (
                <Link key={record.id} href={`/records/${record.id}`}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20, textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>{record.project_title ?? 'Project'}</p>
                      <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>{record.poster_display_name}</p>
                    </div>
                    <StatusBadge record={record} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: record.skills_used && record.skills_used.length > 0 ? 10 : 0 }}>
                    {record.start_date && (
                      <span>{fmtDate(record.start_date)}{record.end_date ? ` → ${fmtDate(record.end_date)}` : ''}</span>
                    )}
                    {record.locked_at && (
                      <span style={{ color: C.accent }}>Locked {fmtDate(record.locked_at)}</span>
                    )}
                  </div>
                  {record.skills_used && record.skills_used.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {record.skills_used.map((s) => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 7px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>{s}</span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── GitHub-Evidenced Skills (Tier 3) ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Tier 3 · GitHub-evidenced skills
            </h2>
            {githubConnected ? (
              <button onClick={scanRepos} disabled={scanning}
                style={{ fontSize: 11, fontFamily: F.mono, color: C.accent, background: 'transparent', border: `1px solid ${C.accentBorder}`, padding: '5px 12px', cursor: scanning ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}>
                {scanning ? 'Scanning…' : 'Re-scan repos'}
              </button>
            ) : (
              <button onClick={connectGithub}
                style={{ fontSize: 11, fontFamily: F.mono, color: '#FFFFFF', background: C.accent, border: 'none', padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Connect GitHub
              </button>
            )}
          </div>
          {githubSkills.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>
                {githubConnected ? 'No skills extracted yet — click "Re-scan repos".' : 'Connect GitHub to auto-populate skills from your repos.'}
              </p>
              <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, lineHeight: 1.6 }}>
                We read only dependency files (package.json, requirements.txt, etc.) — never source code.
              </p>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {githubSkills.map((s) => (
                  <span key={s.id} style={{ fontSize: 12, padding: '4px 10px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: F.mono }}>
                    {s.skill} <span style={{ color: C.textFaint, marginLeft: 4 }}>· {s.evidence_count} repo{s.evidence_count > 1 ? 's' : ''}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Repo profiles (structural signals from same scan) ── */}
        {githubRepos.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Repo profiles ({githubRepos.length})
              </h2>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.textGhost }}>from your last scan · manifest files only</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} className="mob-1col">
              {githubRepos.map((r) => (
                <a key={r.id} href={r.repo_url ?? '#'} target="_blank" rel="noopener noreferrer"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16, textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <p style={{ fontFamily: F.mono, fontSize: 12, color: C.textSub, marginBottom: 6, wordBreak: 'break-all' }}>{r.repo_full_name}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {r.project_type && r.project_type !== 'unknown' && (
                      <span style={{ fontSize: 10, padding: '2px 7px', background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.project_type}</span>
                    )}
                    {r.architecture && r.architecture !== 'unknown' && (
                      <span style={{ fontSize: 10, padding: '2px 7px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.architecture}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10, fontFamily: F.mono, color: C.textFaint }}>
                    {r.has_tests && <span style={{ color: C.accent }}>✓ tests</span>}
                    {r.has_ci && <span style={{ color: C.accent }}>✓ CI</span>}
                    {r.has_docker && <span style={{ color: C.accent }}>✓ Docker</span>}
                    {r.has_docs && <span style={{ color: C.accent }}>✓ docs</span>}
                    {r.has_auth && <span style={{ color: C.accent }}>✓ auth</span>}
                    {r.has_deploy_config && <span style={{ color: C.accent }}>✓ deploy</span>}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

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
              {applications.map((app, i) => {
                const share = contactShares.find((s) => s.application_id === app.id)
                return (
                  <div key={app.id} style={{ padding: '14px 20px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>
                          {app.projects?.title ?? 'Project'}
                        </p>
                        <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                          {app.projects?.poster_display_name ?? ''} · {fmtDate(app.created_at)}
                        </p>
                      </div>
                      <AppStatusBadge status={app.status} />
                    </div>
                    {app.status === 'accepted' && share?.poster_email && (
                      <div style={{ marginTop: 10, padding: '10px 12px', background: C.accentHover, border: `1px solid ${C.accentBorder}` }}>
                        <p style={{ fontSize: 10, fontFamily: F.mono, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>✓ Contact shared</p>
                        <a href={`mailto:${share.poster_email}`} style={{ fontSize: 13, color: C.text, fontFamily: F.mono, textDecoration: 'none' }}>
                          {share.poster_email}
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Peer marketplace: post projects, review collaboration requests ── */}
        <MarketplaceSection
          studentId={student.id}
          studentName={student.full_name}
          initialPostedProjects={postedProjects}
          initialReceivedRequests={receivedRequests}
          contactShares={contactShares}
        />

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
