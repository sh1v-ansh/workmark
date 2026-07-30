'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon, type IconName } from '@/components/Icon'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import { useToast } from '@/components/Toast'
import MarketplaceSection from './MarketplaceSection'
import MessageThread from './MessageThread'
import type { Student, Application, ExperienceRecord, GithubEvidencedSkill, GithubRepoProfile, Project, ContactShare, PeerRecord } from '@/lib/types'

function AppStatusBadge({ status }: { status: string }) {
  const color = status === 'accepted' ? '#15803D' : status === 'rejected' ? '#B91C1C' : status === 'withdrawn' ? C.textFaint : C.textMuted
  const bg = status === 'accepted' ? '#F0FDF4' : status === 'rejected' ? '#FEF2F2' : C.surfaceAlt
  const border = status === 'accepted' ? '#BBF7D0' : status === 'rejected' ? '#FECACA' : C.border
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function TierBadge({ tier, locked }: { tier: 1 | 2 | null; locked: boolean }) {
  if (!locked) return null
  const label = tier === 1 ? 'Tier 1 · Employer' : tier === 2 ? 'Tier 2 · Faculty' : null
  if (!label) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}`, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      <Icon name="check" size={11} /> {label}
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, color, background: C.surfaceAlt, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
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
  peerRecords: PeerRecord[]
  githubSkillsByApplicant: Record<string, GithubEvidencedSkill[]>
}

export default function StudentDashboardClient({ student, applications: initialApplications, experienceRecords, githubSkills, githubRepos, postedProjects, receivedRequests, contactShares, peerRecords: initialPeerRecords, githubSkillsByApplicant }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [peerRecords, setPeerRecords] = useState<PeerRecord[]>(initialPeerRecords)
  const [applications, setApplications] = useState(initialApplications)

  async function handleWithdraw(applicationId: string) {
    if (!confirm('Withdraw this collaboration request?')) return
    try {
      const res = await fetch('/api/collab/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not withdraw.')
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status: 'withdrawn' } : a)))
      toast('Request withdrawn.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not withdraw.', 'error')
    }
  }

  async function handleConfirmCompletion(applicationId: string) {
    try {
      const res = await fetch('/api/collab/confirm-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not confirm.')
      setPeerRecords((prev) => prev.map((r) => {
        if (r.application_id !== applicationId) return r
        const now = new Date().toISOString()
        return { ...r, student_confirmed_at: now, locked_at: json.locked ? now : r.locked_at }
      }))
      toast(json.locked ? 'Confirmed! Both sides agree, this collaboration is locked in.' : 'Confirmed. Waiting on the other side.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not confirm.', 'error')
    }
  }
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
        <Card hoverable={false} padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #3E1FFF 0%, #6C4BFF 100%)', padding: '24px 28px' }}>
            <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 6, letterSpacing: '-0.02em' }}>
              {student.full_name ?? 'Your Profile'}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>
              {[student.degree_type, student.major, student.university].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginBottom: 20 }}>
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noopener noreferrer" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  <Icon name="github" size={13} /> GitHub
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noopener noreferrer" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  <Icon name="linkedin" size={13} /> LinkedIn
                </a>
              )}
            </div>

            {/* Stats row */}
            <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: student.skills && student.skills.length > 0 ? 24 : 0 }}>
              <StatCard icon="briefcase" label="Applications" value={applications.length} />
              <StatCard icon="check" label="Accepted" value={applications.filter((a) => a.status === 'accepted').length} />
              <StatCard icon="award" label="Records" value={experienceRecords.length} />
              <StatCard icon="star" label="Verified" value={verifiedCount} highlight />
            </div>

            {student.skills && student.skills.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: C.textFaint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>Self-reported skills</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {student.skills.map((s) => {
                    const c = tagColor(s)
                    return (
                      <span key={s} style={{ fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>{s}</span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Verified Work Records (Tier 1 + 2) ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionHeading>Verified work records</SectionHeading>
            <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>
              Browse projects <Icon name="arrow-right" size={13} />
            </Link>
          </div>

          {experienceRecords.length === 0 ? (
            <EmptyState icon="award" title="No verified work records yet"
              subtitle="Get accepted to a project and complete the close-out flow to earn your first Tier 1 or Tier 2 record." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {experienceRecords.map((record) => (
                <Card key={record.id} href={`/records/${record.id}`} padding={20}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>{record.project_title ?? 'Project'}</p>
                      <p style={{ fontSize: 12, color: C.textFaint }}>{record.poster_display_name}</p>
                    </div>
                    <StatusBadge record={record} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: C.textFaint, marginBottom: record.skills_used && record.skills_used.length > 0 ? 10 : 0 }}>
                    {record.start_date && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="calendar" size={12} />{fmtDate(record.start_date)}{record.end_date ? ` → ${fmtDate(record.end_date)}` : ''}</span>
                    )}
                    {record.locked_at && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.accent, fontWeight: 500 }}><Icon name="check" size={12} />Locked {fmtDate(record.locked_at)}</span>
                    )}
                  </div>
                  {record.skills_used && record.skills_used.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {record.skills_used.map((s) => {
                        const c = tagColor(s)
                        return <span key={s} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>{s}</span>
                      })}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── GitHub-Evidenced Skills (Tier 3) ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionHeading>Tier 3 · GitHub-evidenced skills</SectionHeading>
            {githubConnected ? (
              <button onClick={scanRepos} disabled={scanning} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex', opacity: scanning ? 0.6 : 1 }}>
                <Icon name="refresh" size={13} /> {scanning ? 'Scanning…' : 'Re-scan repos'}
              </button>
            ) : (
              <button onClick={connectGithub} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                <Icon name="github" size={13} /> Connect GitHub
              </button>
            )}
          </div>
          {githubSkills.length === 0 ? (
            <EmptyState icon="github"
              title={githubConnected ? 'No skills extracted yet — click "Re-scan repos".' : 'Connect GitHub to auto-populate skills from your repos.'}
              subtitle="We read only dependency files (package.json, requirements.txt, etc.) — never source code." />
          ) : (
            <Card hoverable={false} padding={20}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {githubSkills.map((s) => {
                  const c = tagColor(s.skill)
                  return (
                    <span key={s.id} style={{ fontSize: 13, fontWeight: 500, padding: '5px 12px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                      {s.skill} <span style={{ opacity: 0.7, marginLeft: 4 }}>· {s.evidence_count} repo{s.evidence_count > 1 ? 's' : ''}</span>
                    </span>
                  )
                })}
              </div>
            </Card>
          )}
        </section>

        {/* ── Repo profiles (structural signals from same scan) ── */}
        {githubRepos.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionHeading>Repo profiles ({githubRepos.length})</SectionHeading>
              <span style={{ fontSize: 11, color: C.textGhost }}>from your last scan · manifest files only</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="mob-1col">
              {githubRepos.map((r) => (
                <Card key={r.id} href={r.repo_url ?? '#'} padding={16}>
                  <p style={{ fontFamily: F.mono, fontSize: 12, color: C.textSub, marginBottom: 8, wordBreak: 'break-all' }}>{r.repo_full_name}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {r.project_type && r.project_type !== 'unknown' && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.project_type}</span>
                    )}
                    {r.architecture && r.architecture !== 'unknown' && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.architecture}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: C.textFaint }}>
                    {r.has_tests && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.accent }}><Icon name="check" size={11} />tests</span>}
                    {r.has_ci && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.accent }}><Icon name="check" size={11} />CI</span>}
                    {r.has_docker && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.accent }}><Icon name="check" size={11} />Docker</span>}
                    {r.has_docs && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.accent }}><Icon name="check" size={11} />docs</span>}
                    {r.has_auth && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.accent }}><Icon name="check" size={11} />auth</span>}
                    {r.has_deploy_config && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.accent }}><Icon name="check" size={11} />deploy</span>}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── Applications ── */}
        <section>
          <SectionHeading style={{ marginBottom: 14 }}>Applications</SectionHeading>

          {applications.length === 0 ? (
            <EmptyState icon="inbox" title="No applications yet" cta={{ href: '/projects', label: 'Browse open projects' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {applications.map((app) => {
                const share = contactShares.find((s) => s.application_id === app.id)
                const record = peerRecords.find((r) => r.application_id === app.id)
                return (
                  <Card key={app.id} hoverable={false} padding={20}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                          {app.projects?.title ?? 'Project'}
                        </p>
                        <p style={{ fontSize: 12, color: C.textFaint }}>
                          {app.projects?.poster_display_name ?? ''} · {fmtDate(app.created_at)}
                        </p>
                      </div>
                      <AppStatusBadge status={app.status} />
                    </div>
                    {app.status === 'accepted' && share?.poster_email && (
                      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: C.accentHover, border: `1px solid ${C.accentBorder}` }}>
                        <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                          <Icon name="check" size={11} />Contact shared
                        </p>
                        <a href={`mailto:${share.poster_email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text, textDecoration: 'none' }}>
                          <Icon name="mail" size={13} />{share.poster_email}
                        </a>
                      </div>
                    )}
                    {record && (
                      <div style={{ marginTop: 10 }}>
                        {record.locked_at ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <Icon name="check" size={11} />Collaboration confirmed
                          </span>
                        ) : record.student_confirmed_at ? (
                          <p style={{ fontSize: 12, color: C.textFaint }}>Waiting on the poster to confirm too</p>
                        ) : (
                          <button onClick={() => handleConfirmCompletion(app.id)} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                            <Icon name="check" size={13} />Mark this collaboration as complete
                          </button>
                        )}
                      </div>
                    )}
                    {app.status === 'applied' && (
                      <div style={{ marginTop: 10 }}>
                        <button onClick={() => handleWithdraw(app.id)} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex', color: C.textFaint }}>
                          <Icon name="x" size={12} />Withdraw request
                        </button>
                      </div>
                    )}
                    {(app.status === 'applied' || app.status === 'accepted') && (
                      <MessageThread
                        applicationId={app.id}
                        currentUserId={student.id}
                        otherPartyLabel={app.projects?.poster_display_name ?? 'the poster'}
                      />
                    )}
                  </Card>
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
          initialPeerRecords={peerRecords}
          githubSkillsByApplicant={githubSkillsByApplicant}
        />

      </main>
    </div>
  )
}

function SectionHeading({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em', ...style }}>
      {children}
    </h2>
  )
}

function StatCard({ label, value, highlight, icon }: { label: string; value: number; highlight?: boolean; icon: IconName }) {
  return (
    <div style={{ background: highlight ? C.accentHover : C.surfaceAlt, border: `1px solid ${highlight ? C.accentBorder : C.border}`, borderRadius: 12, padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: highlight ? C.accent : C.textFaint }}><Icon name={icon} size={15} /></span>
        <p style={{ fontSize: 24, fontWeight: 700, color: highlight ? C.accent : C.text }}>{value}</p>
      </div>
      <p style={{ fontSize: 11, color: C.textFaint, fontWeight: 500 }}>{label}</p>
    </div>
  )
}

function EmptyState({ icon, title, subtitle, cta }: { icon: IconName; title: string; subtitle?: string; cta?: { href: string; label: string } }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 14 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: C.accentHover, color: C.accent, marginBottom: 14 }}>
        <Icon name={icon} size={20} />
      </div>
      <p style={{ fontSize: 14, color: C.textMuted, marginBottom: subtitle || cta ? 6 : 0, fontWeight: 500 }}>{title}</p>
      {subtitle && <p style={{ fontSize: 12, color: C.textFaint, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>{subtitle}</p>}
      {cta && (
        <Link href={cta.href} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex', marginTop: 16 }}>
          {cta.label} <Icon name="arrow-right" size={13} />
        </Link>
      )}
    </div>
  )
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
