'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import type { Project, Application, ContactShare } from '@/lib/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

// ─── New (peer) project form ───────────────────────────────────────────────────

function NewPeerProjectForm({ studentId, studentName, onCreated, onCancel }: {
  studentId: string; studentName: string | null; onCreated: (p: Project) => void; onCancel: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('project')
  const [complexityLevel, setComplexityLevel] = useState('intermediate')
  const [reqSkills, setReqSkills] = useState<string[]>([])
  const [workMode, setWorkMode] = useState('remote')
  const [duration, setDuration] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [compensation, setCompensation] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          poster_id: studentId, poster_type: 'student',
          poster_display_name: studentName,
          title, description: description || null, type,
          complexity_level: complexityLevel,
          required_skills: reqSkills.length > 0 ? reqSkills : null,
          work_mode: workMode, duration: duration || null,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
          is_paid: isPaid, compensation: compensation || null,
          is_open: true,
        })
        .select().single()
      if (error) throw error
      toast('Project posted!', 'success')
      onCreated(data as Project)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create project.', 'error')
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
          <select id="peer-proj-complexity" value={complexityLevel} onChange={(e) => setComplexityLevel(e.target.value)} className="dk-select">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="peer-proj-work-mode">Work mode</Label>
          <select id="peer-proj-work-mode" value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="dk-select">
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
      </div>

      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="dk-checkbox" />
          <span style={{ fontSize: 13, color: C.textMuted }}>This includes pay, equity, or a stipend</span>
        </label>
        {isPaid && (
          <div style={fieldGap}>
            <Label htmlFor="peer-proj-comp">Details</Label>
            <input id="peer-proj-comp" value={compensation} onChange={(e) => setCompensation(e.target.value)} className="dk-input" placeholder="Revenue share, $15/hr, course credit…" />
          </div>
        )}
      </div>

      <TagInput label="Skills needed" inputId="peer-proj-skills" value={reqSkills} onChange={setReqSkills} placeholder="React, Figma, PostgreSQL…" />

      <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '11px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} style={{ flex: 1, padding: '11px 0', background: loading ? C.surfaceAlt : C.accent, border: 'none', color: loading ? C.textMuted : '#FFFFFF', fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
          {loading ? 'Posting…' : 'Post project →'}
        </button>
      </div>
    </form>
  )
}

// ─── Incoming request row ──────────────────────────────────────────────────────

function RequestRow({ app, contactShare, onAccept, onReject }: {
  app: Application; contactShare?: ContactShare; onAccept: (id: string) => void; onReject: (id: string) => void
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {applicant.skills.slice(0, 8).map((s) => (
                <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: C.surface, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>{s}</span>
              ))}
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
        <div style={{ borderTop: `1px solid ${C.accentBorder}`, background: C.accentHover, margin: '0 -16px -14px', padding: '10px 16px 14px' }}>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>✓ Contact shared</p>
          <a href={`mailto:${contactShare.student_email}`} style={{ fontSize: 13, color: C.text, fontFamily: F.mono, textDecoration: 'none' }}>
            {contactShare.student_email}
          </a>
        </div>
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
}

export default function MarketplaceSection({ studentId, studentName, initialPostedProjects, initialReceivedRequests, contactShares }: Props) {
  const { toast } = useToast()
  const [postedProjects, setPostedProjects] = useState<Project[]>(initialPostedProjects)
  const [receivedRequests, setReceivedRequests] = useState<Application[]>(initialReceivedRequests)
  const [showNewForm, setShowNewForm] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [shares, setShares] = useState<ContactShare[]>(contactShares)

  function getRequestsForProject(projectId: string) {
    return receivedRequests.filter((a) => a.project_id === projectId)
  }

  function shareFor(applicationId: string) {
    return shares.find((s) => s.application_id === applicationId)
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

  async function handleToggleOpen(project: Project) {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('projects').update({ is_open: !project.is_open }).eq('id', project.id)
      if (error) throw error
      setPostedProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, is_open: !p.is_open } : p)))
      toast(project.is_open ? 'Project closed.' : 'Project re-opened.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update project.', 'error')
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
          <NewPeerProjectForm
            studentId={studentId}
            studentName={studentName}
            onCreated={(p) => { setPostedProjects((prev) => [p, ...prev]); setShowNewForm(false) }}
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
            const pendingCount = requests.filter((a) => a.status === 'applied').length

            return (
              <div key={project.id} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 500, color: C.textSub }}>{project.title ?? 'Untitled'}</h3>
                        <span style={{
                          fontSize: 9, fontFamily: F.mono, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.08em',
                          color: project.is_open ? C.accent : C.textFaint,
                          border: `1px solid ${project.is_open ? C.accentBorder : C.border}`,
                          background: project.is_open ? C.accentHover : C.surfaceAlt,
                        }}>
                          {project.is_open ? 'Open' : 'Closed'}
                        </span>
                        <ComplexityBadge level={project.complexity_level} />
                      </div>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        Posted {fmtDate(project.created_at)}{project.duration ? ` · ${project.duration}` : ''}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                        <RequestRow key={app.id} app={app} contactShare={shareFor(app.id)} onAccept={handleAccept} onReject={handleReject} />
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
