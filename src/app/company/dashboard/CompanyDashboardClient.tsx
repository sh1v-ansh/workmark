'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/app/landing/tokens'
import type { Company, Project, Application } from '@/lib/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseDurationDays(duration: string | null): number {
  if (!duration) return 90
  const lower = duration.toLowerCase()
  const weekMatch = lower.match(/(\d+)\s*week/)
  if (weekMatch) return parseInt(weekMatch[1]) * 7
  const monthMatch = lower.match(/(\d+)\s*month/)
  if (monthMatch) return parseInt(monthMatch[1]) * 30
  if (lower.match(/semester/)) return 120
  return 90
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
      {children}
    </label>
  )
}

// ─── Tag input ────────────────────────────────────────────────────────────────

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
          id={inputId}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Add and press Enter'}
          className="dk-input"
          style={{ flex: 1 }}
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

// ─── New project form ─────────────────────────────────────────────────────────

function NewProjectForm({ companyId, onCreated, onCancel }: {
  companyId: string; onCreated: (p: Project) => void; onCancel: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('project')
  const [reqSkills, setReqSkills] = useState<string[]>([])
  const [prefSkills, setPrefSkills] = useState<string[]>([])
  const [workMode, setWorkMode] = useState('remote')
  const [location, setLocation] = useState('')
  const [duration, setDuration] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [isPaid, setIsPaid] = useState(true)
  const [compensation, setCompensation] = useState('')
  const [workAuthRequired, setWorkAuthRequired] = useState(false)
  const [minGpa, setMinGpa] = useState('')
  const [degreeLevel, setDegreeLevel] = useState('both')
  const [prefMajors, setPrefMajors] = useState<string[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          company_id: companyId, title, description: description || null, type,
          required_skills: reqSkills.length > 0 ? reqSkills : null,
          preferred_skills: prefSkills.length > 0 ? prefSkills : null,
          work_mode: workMode, location: location || null, duration: duration || null,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
          is_paid: isPaid, compensation: compensation || null,
          work_auth_required: workAuthRequired,
          min_gpa: minGpa ? parseFloat(minGpa) : null, degree_level: degreeLevel,
          preferred_majors: prefMajors.length > 0 ? prefMajors : null, is_open: true,
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
        <Label htmlFor="proj-title">Title <span aria-hidden="true" style={{ color: C.accent }}>*</span></Label>
        <input id="proj-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="dk-input" placeholder="ML Research Intern" />
      </div>

      <div style={fieldGap}>
        <Label htmlFor="proj-desc">Description</Label>
        <textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="dk-textarea" placeholder="Describe the project, goals, and what students will learn…" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldGap}>
          <Label htmlFor="proj-type">Type</Label>
          <select id="proj-type" value={type} onChange={(e) => setType(e.target.value)} className="dk-select">
            <option value="project">Project</option>
            <option value="internship">Internship</option>
            <option value="part-time">Part-time</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="proj-work-mode">Work mode</Label>
          <select id="proj-work-mode" value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="dk-select">
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="proj-location">Location</Label>
          <input id="proj-location" value={location} onChange={(e) => setLocation(e.target.value)} className="dk-input" placeholder="San Francisco, CA" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="proj-duration">Duration</Label>
          <input id="proj-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="dk-input" placeholder="8 weeks, 1 semester…" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="proj-hours">Hours / week</Label>
          <input id="proj-hours" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="dk-input" placeholder="20" />
        </div>
        <div style={fieldGap}>
          <Label htmlFor="proj-degree">Degree level</Label>
          <select id="proj-degree" value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)} className="dk-select">
            <option value="both">All levels</option>
            <option value="undergrad">Undergrad only</option>
            <option value="grad">Graduate only</option>
          </select>
        </div>
        <div style={fieldGap}>
          <Label htmlFor="proj-gpa">Min. GPA</Label>
          <input id="proj-gpa" type="number" min={0} max={4} step={0.01} value={minGpa} onChange={(e) => setMinGpa(e.target.value)} className="dk-input" placeholder="3.0" />
        </div>
      </div>

      {/* Compensation */}
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="dk-checkbox" />
          <span style={{ fontSize: 13, color: C.textMuted }}>This is a paid position</span>
        </label>
        {isPaid && (
          <div style={fieldGap}>
            <Label htmlFor="proj-comp">Compensation details</Label>
            <input id="proj-comp" value={compensation} onChange={(e) => setCompensation(e.target.value)} className="dk-input" placeholder="$20/hr, $2000 stipend…" />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={workAuthRequired} onChange={(e) => setWorkAuthRequired(e.target.checked)} className="dk-checkbox" />
          <span style={{ fontSize: 13, color: C.textMuted }}>US work authorization required</span>
        </label>
      </div>

      <TagInput label="Required skills" inputId="proj-req-skills" value={reqSkills} onChange={setReqSkills} placeholder="Python, React…" />
      <TagInput label="Preferred skills (optional)" inputId="proj-pref-skills" value={prefSkills} onChange={setPrefSkills} placeholder="Docker, Kubernetes…" />
      <TagInput label="Preferred majors (optional)" inputId="proj-majors" value={prefMajors} onChange={setPrefMajors} placeholder="CS, ECE…" />

      <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '11px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} style={{ flex: 1, padding: '11px 0', background: loading ? C.surfaceAlt : C.accent, border: 'none', color: loading ? C.textMuted : C.bg, fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
          {loading ? 'Posting…' : 'Post project →'}
        </button>
      </div>
    </form>
  )
}

// ─── Application row ──────────────────────────────────────────────────────────

function ApplicationRow({ app, onAccept, onReject }: {
  app: Application; onAccept: (id: string) => void; onReject: (id: string) => void
}) {
  const student = app.students
  const [acting, setActing] = useState(false)

  async function handleAccept() { setActing(true); await onAccept(app.id); setActing(false) }
  async function handleReject() { setActing(true); await onReject(app.id); setActing(false) }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>{student?.full_name ?? 'Student'}</p>
        <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
          {student?.university ?? ''}{student?.gpa ? ` · GPA ${student.gpa}` : ''}
        </p>
        {student?.skills && student.skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {student.skills.slice(0, 5).map((s) => (
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
              style={{ fontSize: 11, fontFamily: F.mono, color: '#f87171', padding: '5px 10px', border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.5 : 1 }}>
              Reject
            </button>
            <button onClick={handleAccept} disabled={acting}
              style={{ fontSize: 11, fontFamily: F.mono, color: C.bg, background: C.accent, padding: '5px 12px', border: 'none', cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: acting ? 0.5 : 1 }}>
              {acting ? '…' : 'Accept'}
            </button>
          </>
        ) : (
          <span style={{
            fontSize: 10, fontFamily: F.mono, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em',
            color: app.status === 'accepted' ? C.accent : '#f87171',
            background: app.status === 'accepted' ? C.accentHover : 'rgba(248,113,113,0.1)',
            border: `1px solid ${app.status === 'accepted' ? C.accentBorder : 'rgba(248,113,113,0.3)'}`,
          }}>
            {app.status}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Props & Page ─────────────────────────────────────────────────────────────

interface Props {
  company: Company
  initialProjects: Project[]
  initialApplications: Application[]
}

export default function CompanyDashboardClient({ company, initialProjects, initialApplications }: Props) {
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [applications, setApplications] = useState<Application[]>(initialApplications)
  const [showNewForm, setShowNewForm] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  function getAppsForProject(projectId: string) {
    return applications.filter((a) => a.project_id === projectId)
  }

  async function handleAccept(appId: string) {
    const supabase = createClient()
    const app = applications.find((a) => a.id === appId)
    if (!app) return
    try {
      const { error: updateErr } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId)
      if (updateErr) throw updateErr
      const project = projects.find((p) => p.id === app.project_id)
      const startDate = new Date()
      const endDate = addDays(startDate, parseDurationDays(project?.duration ?? null))
      const { error: expErr } = await supabase.from('experience_records').insert({
        application_id: appId, student_id: app.student_id, company_id: company.id,
        project_id: app.project_id, project_title: project?.title ?? null,
        company_name: company.company_name, skills_used: project?.required_skills ?? null,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        verification_status: 'in_progress',
      })
      if (expErr) throw expErr
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'accepted' } : a)))
      toast('Application accepted and experience record created.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error')
    }
  }

  async function handleReject(appId: string) {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('applications').update({ status: 'rejected' }).eq('id', appId)
      if (error) throw error
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'rejected' } : a)))
      toast('Application rejected.', 'info')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error')
    }
  }

  async function handleToggleOpen(project: Project) {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('projects').update({ is_open: !project.is_open }).eq('id', project.id)
      if (error) throw error
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, is_open: !p.is_open } : p)))
      toast(project.is_open ? 'Project closed.' : 'Project re-opened.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update project.', 'error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="company" userName={company.company_name ?? undefined} />

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {company.company_name ?? 'Company Dashboard'}
            </h1>
            <p style={{ fontSize: 13, color: C.textMuted, fontFamily: F.mono }}>
              {company.industry}{company.hq_location ? ` · ${company.hq_location}` : ''}
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            style={{ padding: '10px 20px', background: C.accent, color: C.bg, fontFamily: F.mono, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
          >
            + Post project
          </button>
        </div>

        {/* ── New project form ── */}
        {showNewForm && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
            <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>New project</h2>
            <NewProjectForm
              companyId={company.id}
              onCreated={(p) => { setProjects((prev) => [p, ...prev]); setShowNewForm(false) }}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        )}

        {/* ── Projects list ── */}
        <section>
          <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Your Projects ({projects.length})
          </h2>

          {projects.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 6 }}>No projects yet</p>
              <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>Click &ldquo;Post project&rdquo; to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map((project) => {
                const apps = getAppsForProject(project.id)
                const expanded = expandedProject === project.id
                const pendingCount = apps.filter((a) => a.status === 'applied').length

                return (
                  <div key={project.id} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 500, color: C.textSub }}>{project.title ?? 'Untitled'}</h3>
                            <span style={{
                              fontSize: 9, fontFamily: F.mono, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.08em',
                              color: project.is_open ? C.accent : C.textFaint,
                              border: `1px solid ${project.is_open ? C.accentBorder : C.border}`,
                              background: project.is_open ? C.accentHover : C.surfaceAlt,
                            }}>
                              {project.is_open ? 'Open' : 'Closed'}
                            </span>
                            {project.type && (
                              <span style={{ fontSize: 9, fontFamily: F.mono, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textFaint, border: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                                {project.type}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                            Posted {fmtDate(project.created_at)}
                            {project.duration ? ` · ${project.duration}` : ''}
                            {project.compensation ? ` · ${project.compensation}` : ''}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleToggleOpen(project)}
                            style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, padding: '5px 10px', border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer' }}>
                            {project.is_open ? 'Close' : 'Re-open'}
                          </button>
                          <button onClick={() => setExpandedProject(expanded ? null : project.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: F.mono, color: C.accent, padding: '5px 10px', border: `1px solid ${C.accentBorder}`, background: C.accentHover, cursor: 'pointer' }}>
                            {apps.length} applicant{apps.length !== 1 ? 's' : ''}
                            {pendingCount > 0 && (
                              <span style={{ width: 16, height: 16, background: C.accent, color: C.bg, borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} aria-label={`${pendingCount} pending`}>
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
                        {apps.length === 0 ? (
                          <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono, textAlign: 'center', padding: '12px 0' }}>No applications yet</p>
                        ) : (
                          apps.map((app) => (
                            <ApplicationRow key={app.id} app={app} onAccept={handleAccept} onReject={handleReject} />
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

      </main>
    </div>
  )
}
