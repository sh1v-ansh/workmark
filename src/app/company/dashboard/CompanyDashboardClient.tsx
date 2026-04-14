'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import type { Company, Project, Application } from '@/lib/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseDurationDays(duration: string | null): number {
  if (!duration) return 90
  const lower = duration.toLowerCase()
  const weekMatch = lower.match(/(\d+)\s*week/)
  if (weekMatch) return parseInt(weekMatch[1]) * 7
  const monthMatch = lower.match(/(\d+)\s*month/)
  if (monthMatch) return parseInt(monthMatch[1]) * 30
  const semMatch = lower.match(/semester/)
  if (semMatch) return 120
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

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Add and press Enter'}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <button type="button" onClick={add} className="px-3 py-2 text-sm font-medium text-brand-700 bg-brand-50 rounded-xl hover:bg-brand-100">Add</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gray-100 text-sm text-gray-700">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-gray-400 hover:text-red-500">×</button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── New project form ─────────────────────────────────────────────────────────

function NewProjectForm({
  companyId,
  onCreated,
  onCancel,
}: {
  companyId: string
  onCreated: (p: Project) => void
  onCancel: () => void
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
          company_id: companyId,
          title,
          description: description || null,
          type,
          required_skills: reqSkills.length > 0 ? reqSkills : null,
          preferred_skills: prefSkills.length > 0 ? prefSkills : null,
          work_mode: workMode,
          location: location || null,
          duration: duration || null,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
          is_paid: isPaid,
          compensation: compensation || null,
          work_auth_required: workAuthRequired,
          min_gpa: minGpa ? parseFloat(minGpa) : null,
          degree_level: degreeLevel,
          preferred_majors: prefMajors.length > 0 ? prefMajors : null,
          is_open: true,
        })
        .select()
        .single()

      if (error) throw error
      toast('Project posted!', 'success')
      onCreated(data as Project)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create project.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="ML Research Intern" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="Describe the project, goals, and what students will learn…" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
            <option value="project">Project</option>
            <option value="internship">Internship</option>
            <option value="part-time">Part-time</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Work mode</label>
          <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="San Francisco, CA" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="8 weeks, 1 semester…" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours / week</label>
          <input type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="20" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Degree level</label>
          <select value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
            <option value="both">All levels</option>
            <option value="undergrad">Undergrad only</option>
            <option value="grad">Graduate only</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. GPA</label>
          <input type="number" min={0} max={4} step={0.01} value={minGpa} onChange={(e) => setMinGpa(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="3.0" />
        </div>
      </div>

      {/* Compensation */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="w-4 h-4 accent-brand-600 rounded" />
          <span className="text-sm font-medium text-gray-700">This is a paid position</span>
        </label>
        {isPaid && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Compensation details</label>
            <input value={compensation} onChange={(e) => setCompensation(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" placeholder="$20/hr, $2000 stipend…" />
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={workAuthRequired} onChange={(e) => setWorkAuthRequired(e.target.checked)} className="w-4 h-4 accent-brand-600 rounded" />
          <span className="text-sm font-medium text-gray-700">US work authorization required</span>
        </label>
      </div>

      <TagInput label="Required skills" value={reqSkills} onChange={setReqSkills} placeholder="Python, React…" />
      <TagInput label="Preferred skills (optional)" value={prefSkills} onChange={setPrefSkills} placeholder="Docker, Kubernetes…" />
      <TagInput label="Preferred majors (optional)" value={prefMajors} onChange={setPrefMajors} placeholder="CS, ECE…" />

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Posting…
            </span>
          ) : 'Post project'}
        </button>
      </div>
    </form>
  )
}

// ─── Application row ──────────────────────────────────────────────────────────

function ApplicationRow({
  app,
  onAccept,
  onReject,
}: {
  app: Application
  onAccept: (appId: string) => void
  onReject: (appId: string) => void
}) {
  const student = app.students
  const [acting, setActing] = useState(false)

  async function handleAccept() {
    setActing(true)
    await onAccept(app.id)
    setActing(false)
  }

  async function handleReject() {
    setActing(true)
    await onReject(app.id)
    setActing(false)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-xl">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{student?.full_name ?? 'Student'}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {student?.university ?? ''}
          {student?.gpa ? ` · GPA ${student.gpa}` : ''}
        </p>
        {student?.skills && student.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {student.skills.slice(0, 5).map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {app.resume_url && (
          <a
            href={`/api/resume?path=${encodeURIComponent(app.resume_url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-600 border border-brand-200 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Resume ↗
          </a>
        )}
        {app.status === 'applied' ? (
          <>
            <button
              onClick={handleReject}
              disabled={acting}
              className="text-xs font-medium text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={handleAccept}
              disabled={acting}
              className="text-xs font-medium text-white bg-green-600 px-2.5 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {acting ? '…' : 'Accept'}
            </button>
          </>
        ) : (
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${app.status === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
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

export default function CompanyDashboardClient({
  company,
  initialProjects,
  initialApplications,
}: Props) {
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
      // 1. Update application status
      const { error: updateErr } = await supabase
        .from('applications')
        .update({ status: 'accepted' })
        .eq('id', appId)
      if (updateErr) throw updateErr

      // 2. Auto-create experience record
      const project = projects.find((p) => p.id === app.project_id)
      const startDate = new Date()
      const durationDays = parseDurationDays(project?.duration ?? null)
      const endDate = addDays(startDate, durationDays)

      const { error: expErr } = await supabase.from('experience_records').insert({
        application_id: appId,
        student_id: app.student_id,
        company_id: company.id,
        project_id: app.project_id,
        project_title: project?.title ?? null,
        company_name: company.company_name,
        skills_used: project?.required_skills ?? null,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        verification_status: 'in_progress',
      })
      if (expErr) throw expErr

      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'accepted' } : a))
      )
      toast('Application accepted and experience record created.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error')
    }
  }

  async function handleReject(appId: string) {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'rejected' })
        .eq('id', appId)
      if (error) throw error
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'rejected' } : a))
      )
      toast('Application rejected.', 'info')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error')
    }
  }

  async function handleToggleOpen(project: Project) {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_open: !project.is_open })
        .eq('id', project.id)
      if (error) throw error
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, is_open: !p.is_open } : p))
      )
      toast(project.is_open ? 'Project closed.' : 'Project re-opened.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update project.', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="company" userName={company.company_name ?? undefined} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {company.company_name ?? 'Company Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {company.industry}{company.hq_location ? ` · ${company.hq_location}` : ''}
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Post project
          </button>
        </div>

        {/* ── New project form ── */}
        {showNewForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-slide-up">
            <h2 className="text-base font-bold text-gray-900 mb-5">New project</h2>
            <NewProjectForm
              companyId={company.id}
              onCreated={(p) => {
                setProjects((prev) => [p, ...prev])
                setShowNewForm(false)
              }}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        )}

        {/* ── Projects list ── */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">
            Your Projects ({projects.length})
          </h2>

          {projects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="text-base mb-1">No projects yet</p>
              <p className="text-sm">Click &ldquo;Post project&rdquo; to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const apps = getAppsForProject(project.id)
                const expanded = expandedProject === project.id
                const pendingCount = apps.filter((a) => a.status === 'applied').length

                return (
                  <div key={project.id} className="bg-white rounded-2xl border border-gray-200">
                    {/* Project header */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">
                              {project.title ?? 'Untitled'}
                            </h3>
                            {project.is_open ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Open</span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Closed</span>
                            )}
                            {project.type && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">{project.type}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Posted {fmtDate(project.created_at)}
                            {project.duration ? ` · ${project.duration}` : ''}
                            {project.compensation ? ` · ${project.compensation}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleOpen(project)}
                            className="text-xs font-medium text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            {project.is_open ? 'Close' : 'Re-open'}
                          </button>
                          <button
                            onClick={() => setExpandedProject(expanded ? null : project.id)}
                            className="flex items-center gap-1 text-xs font-medium text-brand-600 border border-brand-200 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                          >
                            {apps.length} applicant{apps.length !== 1 ? 's' : ''}
                            {pendingCount > 0 && (
                              <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center font-bold">
                                {pendingCount}
                              </span>
                            )}
                            <span className="ml-0.5">{expanded ? '▲' : '▼'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Applications panel */}
                    {expanded && (
                      <div className="border-t border-gray-100 p-4 space-y-3">
                        {apps.length === 0 ? (
                          <p className="text-sm text-center text-gray-400 py-3">
                            No applications yet
                          </p>
                        ) : (
                          apps.map((app) => (
                            <ApplicationRow
                              key={app.id}
                              app={app}
                              onAccept={handleAccept}
                              onReject={handleReject}
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
      </main>
    </div>
  )
}
