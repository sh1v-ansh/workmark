'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import MessageThread from './MessageThread'
import type { Project, Application, ContactShare, PeerRecord, GithubEvidencedSkill } from '@/lib/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STALE_MS = 21 * 24 * 60 * 60 * 1000 // 3 weeks

function isStale(project: Project): boolean {
  if (!project.is_open || project.status !== 'open') return false
  const anchor = project.renewed_at ?? project.created_at
  return Date.now() - new Date(anchor).getTime() > STALE_MS
}

const COMPLEXITY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function ComplexityBadge({ level }: { level: string | null }) {
  if (!level) return null
  const color = level === 'advanced' ? '#DC2626' : level === 'intermediate' ? C.accent : C.textMuted
  const bg = level === 'advanced' ? 'rgba(248,113,113,0.08)' : level === 'intermediate' ? C.accentHover : C.surfaceAlt
  const border = level === 'advanced' ? 'rgba(248,113,113,0.25)' : level === 'intermediate' ? C.accentBorder : C.border
  return (
    <span style={{ fontSize: 9, fontFamily: F.mono, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.08em', color, background: bg, border: `1px solid ${border}` }}>
      {COMPLEXITY_LABEL[level] ?? level}
    </span>
  )
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  filled: 'Filled',
  closed: 'Closed',
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'open' ? C.accent : status === 'in_progress' ? '#D97706' : C.textFaint
  const bg = status === 'open' ? C.accentHover : status === 'in_progress' ? 'rgba(217,119,6,0.08)' : C.surfaceAlt
  const border = status === 'open' ? C.accentBorder : status === 'in_progress' ? 'rgba(217,119,6,0.3)' : C.border
  return (
    <span style={{ fontSize: 9, fontFamily: F.mono, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.08em', color, background: bg, border: `1px solid ${border}` }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ─── Label / TagInput (mirrors CompanyDashboardClient's pattern) ──────────────

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
      {children}
    </label>
  )
}

function TagInput({ label, inputId, value, onChange, placeholder }: {
  label: string; inputId: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
  }
  return (
    <div>
      <Label htmlFor={inputId}>{label}</Label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          id={inputId} type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Add and press Enter'} className="dk-input" style={{ flex: 1 }}
        />
        <button type="button" onClick={add} style={{ padding: '0 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 11, cursor: 'pointer' }}>
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {value.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSub, fontFamily: F.mono }}>
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Peer project form — handles both create and edit ────────────────────────

function PeerProjectForm({ studentId, studentName, initialProject, onSaved, onCancel }: {
  studentId: string; studentName: string | null; initialProject?: Project
  onSaved: (p: Project) => void; onCancel: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialProject?.title ?? '')
  const [description, setDescription] = useState(initialProject?.description ?? '')
  const [type, setType] = useState(initialProject?.type ?? 'project')
  const [complexityLevel, setComplexityLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(initialProject?.complexity_level ?? 'intermediate')
  const [reqSkills, setReqSkills] = useState<string[]>(initialProject?.required_skills ?? [])
  const [prefSkills, setPrefSkills] = useState<string[]>(initialProject?.preferred_skills ?? [])
  const [workMode, setWorkMode] = useState(initialProject?.work_mode ?? 'remote')
  const [duration, setDuration] = useState(initialProject?.duration ?? '')
  const [hoursPerWeek, setHoursPerWeek] = useState(initialProject?.hours_per_week?.toString() ?? '')
  const [teamSize, setTeamSize] = useState(initialProject?.team_size?.toString() ?? '1')
  const [startDate, setStartDate] = useState(initialProject?.start_date ?? '')
  const [repoUrl, setRepoUrl] = useState(initialProject?.repo_url ?? '')
  const [demoUrl, setDemoUrl] = useState(initialProject?.demo_url ?? '')
  const [isPaid, setIsPaid] = useState(initialProject?.is_paid ?? false)
  const [compensation, setCompensation] = useState(initialProject?.compensation ?? '')

  const isEdit = !!initialProject

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const payload = {
      title, description: description || null, type,
      complexity_level: complexityLevel,
      required_skills: reqSkills.length > 0 ? reqSkills : null,
      preferred_skills: prefSkills.length > 0 ? prefSkills : null,
      work_mode: workMode, duration: duration || null,
      hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
      team_size: teamSize ? parseInt(teamSize) : null,
      start_date: startDate || null,
      repo_url: repoUrl || null,
      demo_url: demoUrl || null,
      is_paid: isPaid, compensation: isPaid ? (compensation || null) : null,
    }
    try {
      if (isEdit) {
        const { data, error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', initialProject.id)
          .select().single()
        if (error) throw error
        toast('Project updated.', 'success')
        onSaved(data as Project)
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            poster_id: studentId, poster_type: 'student',
            poster_display_name: studentName,
            ...payload,
            is_open: true, status: 'open',
          })
          .select().single()
        if (error) throw error
        toast('Project posted!', 'success')
        onSaved(data as Project)
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save project.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fieldGap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={fieldGap}>
        <Label htmlFor="peer-proj-title">Title <span aria-hidden="true" style={{ color: C.accent }}>*</span></Label>
        <input id="peer-proj-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="dk-input" placeholder="Need a co-founder for a campus events app" />
      </div>

      <div style={fieldGap}>
        <Label htmlFor="peer-proj-desc">Description</Label>
        <textarea id="peer-proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="dk-textarea" placeholder="What are you building? What help do you need?" />
      </div>

      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-type">Type</Label>
          <select id="peer-proj-type" value={type} onChange={(e) => setType(e.target.value)} className="dk-select">
            <option value="project">Project</option>
            <option value="part-time">Ongoing / part-time</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-complexity">Complexity level</Label>
          <select id="peer-proj-complexity" value={complexityLevel ?? 'intermediate'} onChange={(e) => setComplexityLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')} className="dk-select">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-work-mode">Work mode</Label>
          <select id="peer-proj-work-mode" value={workMode ?? 'remote'} onChange={(e) => setWorkMode(e.target.value)} className="dk-select">
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-duration">Duration</Label>
          <input id="peer-proj-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="dk-input" placeholder="4 weeks, ongoing…" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-hours">Hours / week</Label>
          <input id="peer-proj-hours" type="number" min={1} max={40} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="dk-input" placeholder="10" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-team-size">Collaborators wanted</Label>
          <input id="peer-proj-team-size" type="number" min={1} max={10} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="dk-input" placeholder="1" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-start">Start date (optional)</Label>
          <input id="peer-proj-start" type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} className="dk-input" />
        </div>
      </div>

      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-repo">Repo link (optional)</Label>
          <input id="peer-proj-repo" type="url" value={repoUrl ?? ''} onChange={(e) => setRepoUrl(e.target.value)} className="dk-input" placeholder="https://github.com/you/project" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-demo">Live demo link (optional)</Label>
          <input id="peer-proj-demo" type="url" value={demoUrl ?? ''} onChange={(e) => setDemoUrl(e.target.value)} className="dk-input" placeholder="https://your-demo.vercel.app" />
        </div>
      </div>

      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="dk-checkbox" />
          <span style={{ fontSize: 13, color: C.textMuted }}>This includes pay, equity, or a stipend</span>
        </label>
        {isPaid && (
          <div style={fieldGap}>
            <Label htmlFor="peer-proj-comp">Details</Label>
            <input id="peer-proj-comp" value={compensation ?? ''} onChange={(e) => setCompensation(e.target.value)} className="dk-input" placeholder="Revenue share, $15/hr, course credit…" />
          </div>
        )}
      </div>

      <TagInput label="Skills needed" inputId="peer-proj-skills" value={reqSkills} onChange={setReqSkills} placeholder="React, Figma, PostgreSQL…" />
      <TagInput label="Nice-to-have skills (optional)" inputId="peer-proj-pref-skills" value={prefSkills} onChange={setPrefSkills} placeholder="Docker, GraphQL…" />

      <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '11px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} style={{ flex: 1, padding: '11px 0', background: loading ? C.surfaceAlt : C.accent, border: 'none', color: loading ? C.textMuted : '#FFFFFF', fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Post project →'}
        </button>
      </div>
    </form>
  )
}

// ─── Incoming request row ──────────────────────────────────────────────────────

function RequestRow({ app, contactShare, peerRecord, githubSkills, currentUserId, onAccept, onReject, onConfirmCompletion }: {
  app: Application; contactShare?: ContactShare; peerRecord?: PeerRecord; githubSkills: GithubEvidencedSkill[]
  currentUserId: string
  onAccept: (id: string) => void; onReject: (id: string) => void; onConfirmCompletion: (id: string) => void
}) {
  const applicant = app.students
  const [acting, setActing] = useState(false)
  const [showProposal, setShowProposal] = useState(false)

  async function handleAccept() { setActing(true); await onAccept(app.id); setActing(false) }
  async function handleReject() { setActing(true); await onReject(app.id); setActing(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>{applicant?.full_name ?? 'Student'}</p>
          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
            {applicant?.university ?? ''}
          </p>
          {applicant?.skills && applicant.skills.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 9, color: C.textFaint, fontFamily: F.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Self-reported</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {applicant.skills.slice(0, 8).map((s) => (
                  <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: C.surface, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {githubSkills.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 9, color: C.accent, fontFamily: F.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Tier 3 · GitHub-evidenced</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {githubSkills.slice(0, 8).map((s) => (
                  <span key={s.id} style={{ fontSize: 10, padding: '2px 6px', background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono }}>
                    {s.skill} <span style={{ opacity: 0.7 }}>· {s.evidence_count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {app.resume_url && (
            <a href={`/api/resume?path=${encodeURIComponent(app.resume_url)}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, fontFamily: F.mono, color: C.accent, padding: '5px 10px', border: `1px solid ${C.accentBorder}`, textDecoration: 'none' }}>
              Resume ↗
            </a>
          )}
          {app.status === 'applied' ? (
            <>
              <button onClick={handleReject} disabled={acting}
                style={{ fontSize: 11, fontFamily: F.mono, color: '#DC2626', padding: '5px 10px', border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.5 : 1 }}>
                Decline
              </button>
              <button onClick={handleAccept} disabled={acting}
                style={{ fontSize: 11, fontFamily: F.mono, color: '#FFFFFF', background: C.accent, padding: '5px 12px', border: 'none', cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: acting ? 0.5 : 1 }}>
                {acting ? '…' : 'Accept'}
              </button>
            </>
          ) : (
            <span style={{
              fontSize: 10, fontFamily: F.mono, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em',
              color: app.status === 'accepted' ? C.accent : '#DC2626',
              background: app.status === 'accepted' ? C.accentHover : 'rgba(248,113,113,0.1)',
              border: `1px solid ${app.status === 'accepted' ? C.accentBorder : 'rgba(248,113,113,0.3)'}`,
            }}>
              {app.status}
            </span>
          )}
        </div>
      </div>

      {app.proposal_text && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <button onClick={() => setShowProposal((v) => !v)}
            style={{ fontSize: 11, fontFamily: F.mono, color: C.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}>
            {showProposal ? '▲ Hide proposal' : '▼ Read proposal'}
          </button>
          {showProposal && (
            <div style={{ marginTop: 10, background: C.bg, border: `1px solid ${C.border}`, padding: 14, borderRadius: 6 }}>
              <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{app.proposal_text}</p>
            </div>
          )}
        </div>
      )}

      {app.status === 'accepted' && contactShare?.student_email && (
        <div style={{ borderTop: `1px solid ${C.accentBorder}`, background: C.accentHover, margin: '0 -16px 0', padding: '10px 16px' }}>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>✓ Contact shared</p>
          <a href={`mailto:${contactShare.student_email}`} style={{ fontSize: 13, color: C.text, fontFamily: F.mono, textDecoration: 'none' }}>
            {contactShare.student_email}
          </a>
        </div>
      )}

      {app.status === 'accepted' && peerRecord && (
        <div>
          {peerRecord.locked_at ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 10, fontFamily: F.mono, color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ✓ Collaboration confirmed
            </span>
          ) : peerRecord.poster_confirmed_at ? (
            <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Waiting on {applicant?.full_name ?? 'them'} to confirm too</p>
          ) : (
            <button onClick={() => onConfirmCompletion(app.id)}
              style={{ fontSize: 11, fontFamily: F.mono, color: C.accent, background: 'transparent', border: `1px solid ${C.accentBorder}`, padding: '5px 12px', cursor: 'pointer' }}>
              Mark this collaboration as complete
            </button>
          )}
        </div>
      )}

      {(app.status === 'applied' || app.status === 'accepted') && (
        <MessageThread applicationId={app.id} currentUserId={currentUserId} otherPartyLabel={applicant?.full_name ?? 'them'} />
      )}
    </div>
  )
}

// ─── Section ────────────────────────────────────────────────────────────────────

interface Props {
  studentId: string
  studentName: string | null
  initialPostedProjects: Project[]
  initialReceivedRequests: Application[]
  contactShares: ContactShare[]
  initialPeerRecords: PeerRecord[]
  githubSkillsByApplicant: Record<string, GithubEvidencedSkill[]>
}

export default function MarketplaceSection({ studentId, studentName, initialPostedProjects, initialReceivedRequests, contactShares, initialPeerRecords, githubSkillsByApplicant }: Props) {
  const { toast } = useToast()
  const [postedProjects, setPostedProjects] = useState<Project[]>(initialPostedProjects)
  const [receivedRequests, setReceivedRequests] = useState<Application[]>(initialReceivedRequests)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [shares, setShares] = useState<ContactShare[]>(contactShares)
  const [peerRecords, setPeerRecords] = useState<PeerRecord[]>(initialPeerRecords)

  function getRequestsForProject(projectId: string) {
    return receivedRequests.filter((a) => a.project_id === projectId)
  }

  function shareFor(applicationId: string) {
    return shares.find((s) => s.application_id === applicationId)
  }

  function recordFor(applicationId: string) {
    return peerRecords.find((r) => r.application_id === applicationId)
  }

  async function handleAccept(appId: string) {
    try {
      const res = await fetch('/api/collab/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Action failed.')
      setReceivedRequests((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'accepted' } : a)))
      setShares((prev) => [...prev.filter((s) => s.application_id !== appId), {
        id: 'temp', application_id: appId, student_id: '', poster_id: studentId,
        student_email: json.student_email ?? null, poster_email: json.poster_email ?? null, shared_at: new Date().toISOString(),
      }])
      const app = receivedRequests.find((a) => a.id === appId)
      setPeerRecords((prev) => [...prev.filter((r) => r.application_id !== appId), {
        id: 'temp', application_id: appId, project_id: app?.project_id ?? '', poster_id: studentId, student_id: app?.student_id ?? '',
        project_title: null, skills_used: null, summary: null,
        poster_confirmed_at: null, student_confirmed_at: null, locked_at: null, created_at: new Date().toISOString(),
      }])
      toast('Request accepted. Contact info shared.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error')
    }
  }

  async function handleReject(appId: string) {
    try {
      const res = await fetch('/api/collab/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Action failed.')
      setReceivedRequests((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'rejected' } : a)))
      toast('Request declined.', 'info')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error')
    }
  }

  async function handleConfirmCompletion(appId: string) {
    try {
      const res = await fetch('/api/collab/confirm-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not confirm.')
      setPeerRecords((prev) => prev.map((r) => {
        if (r.application_id !== appId) return r
        const now = new Date().toISOString()
        return { ...r, poster_confirmed_at: now, locked_at: json.locked ? now : r.locked_at }
      }))
      toast(json.locked ? 'Confirmed! Both sides agree, this collaboration is locked in.' : 'Confirmed. Waiting on the other side.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not confirm.', 'error')
    }
  }

  async function handleToggleOpen(project: Project) {
    const supabase = createClient()
    try {
      const nowOpen = !project.is_open
      const { error } = await supabase.from('projects').update({ is_open: nowOpen, status: nowOpen ? 'open' : 'closed' }).eq('id', project.id)
      if (error) throw error
      setPostedProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, is_open: nowOpen, status: nowOpen ? 'open' : 'closed' } : p)))
      toast(project.is_open ? 'Project closed.' : 'Project re-opened.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update project.', 'error')
    }
  }

  async function handleStatusChange(project: Project, status: string) {
    const supabase = createClient()
    try {
      const isOpen = status === 'open' || status === 'in_progress'
      const { error } = await supabase.from('projects').update({ status, is_open: isOpen }).eq('id', project.id)
      if (error) throw error
      setPostedProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status: status as Project['status'], is_open: isOpen } : p)))
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update status.', 'error')
    }
  }

  async function handleRenew(project: Project) {
    const supabase = createClient()
    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('projects').update({ renewed_at: now }).eq('id', project.id)
      if (error) throw error
      setPostedProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, renewed_at: now } : p)))
      toast('Listing renewed — back to the top of "still looking."', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to renew listing.', 'error')
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Your posted projects
        </h2>
        <button onClick={() => setShowNewForm(true)}
          style={{ padding: '8px 16px', background: C.accent, color: '#FFFFFF', fontFamily: F.mono, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          + Post a project
        </button>
      </div>

      {showNewForm && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28, marginBottom: 16 }}>
          <h3 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>New project</h3>
          <PeerProjectForm
            studentId={studentId}
            studentName={studentName}
            onSaved={(p) => { setPostedProjects((prev) => [p, ...prev]); setShowNewForm(false) }}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {postedProjects.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>You haven&apos;t posted a project yet</p>
          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Post one to find other students to collaborate with.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {postedProjects.map((project) => {
            const requests = getRequestsForProject(project.id)
            const expanded = expandedProject === project.id
            const editing = editingProjectId === project.id
            const pendingCount = requests.filter((a) => a.status === 'applied').length
            const acceptedCount = requests.filter((a) => a.status === 'accepted').length
            const stale = isStale(project)

            if (editing) {
              return (
                <div key={project.id} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
                  <h3 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>Edit project</h3>
                  <PeerProjectForm
                    studentId={studentId}
                    studentName={studentName}
                    initialProject={project}
                    onSaved={(p) => { setPostedProjects((prev) => prev.map((x) => (x.id === p.id ? p : x))); setEditingProjectId(null) }}
                    onCancel={() => setEditingProjectId(null)}
                  />
                </div>
              )
            }

            return (
              <div key={project.id} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 500, color: C.textSub }}>{project.title ?? 'Untitled'}</h3>
                        <StatusBadge status={project.status} />
                        <ComplexityBadge level={project.complexity_level} />
                        {stale && (
                          <span style={{ fontSize: 9, fontFamily: F.mono, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D97706', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)' }}>
                            Still looking?
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        Posted {fmtDate(project.created_at)}{project.duration ? ` · ${project.duration}` : ''}
                        {project.team_size ? ` · ${acceptedCount}/${project.team_size} filled` : ''}
                        {' · '}{project.view_count} view{project.view_count === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {stale && (
                        <button onClick={() => handleRenew(project)}
                          style={{ fontSize: 11, fontFamily: F.mono, color: '#D97706', padding: '5px 10px', border: '1px solid rgba(217,119,6,0.3)', background: 'transparent', cursor: 'pointer' }}>
                          Renew
                        </button>
                      )}
                      <select value={project.status} onChange={(e) => handleStatusChange(project, e.target.value)} className="dk-select" style={{ fontSize: 11, padding: '5px 8px', width: 'auto' }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="filled">Filled</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button onClick={() => setEditingProjectId(project.id)}
                        style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 10px', border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => handleToggleOpen(project)}
                        style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 10px', border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer' }}>
                        {project.is_open ? 'Close' : 'Re-open'}
                      </button>
                      <button onClick={() => setExpandedProject(expanded ? null : project.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: F.mono, color: C.accent, padding: '5px 10px', border: `1px solid ${C.accentBorder}`, background: C.accentHover, cursor: 'pointer' }}>
                        {requests.length} request{requests.length !== 1 ? 's' : ''}
                        {pendingCount > 0 && (
                          <span style={{ width: 16, height: 16, background: C.accent, color: '#FFFFFF', borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} aria-label={`${pendingCount} pending`}>
                            {pendingCount}
                          </span>
                        )}
                        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {requests.length === 0 ? (
                      <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono, textAlign: 'center', padding: '12px 0' }}>No requests yet</p>
                    ) : (
                      requests.map((app) => (
                        <RequestRow
                          key={app.id}
                          app={app}
                          contactShare={shareFor(app.id)}
                          peerRecord={recordFor(app.id)}
                          githubSkills={githubSkillsByApplicant[app.student_id] ?? []}
                          currentUserId={studentId}
                          onAccept={handleAccept}
                          onReject={handleReject}
                          onConfirmCompletion={handleConfirmCompletion}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
