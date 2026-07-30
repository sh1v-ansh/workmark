'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
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
  const color = level === 'advanced' ? '#B91C1C' : level === 'intermediate' ? C.accent : C.textMuted
  const bg = level === 'advanced' ? '#FEF2F2' : level === 'intermediate' ? C.accentHover : C.surfaceAlt
  const border = level === 'advanced' ? '#FECACA' : level === 'intermediate' ? C.accentBorder : C.border
  return (
    <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '2px 9px', textTransform: 'uppercase', letterSpacing: '0.04em', color, background: bg, border: `1px solid ${border}` }}>
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
  const color = status === 'open' ? C.accent : status === 'in_progress' ? '#B45309' : C.textFaint
  const bg = status === 'open' ? C.accentHover : status === 'in_progress' ? '#FFFBEB' : C.surfaceAlt
  const border = status === 'open' ? C.accentBorder : status === 'in_progress' ? '#FDE68A' : C.border
  return (
    <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '2px 9px', textTransform: 'uppercase', letterSpacing: '0.04em', color, background: bg, border: `1px solid ${border}` }}>
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
        <button type="button" onClick={add} className="wm-btn wm-btn-secondary wm-btn-sm">
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {value.map((t) => {
          const c = tagColor(t)
          return (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, fontSize: 12, color: c.text, fontFamily: F.mono }}>
              {t}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} style={{ display: 'flex', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, opacity: 0.6 }}>
                <Icon name="x" size={11} />
              </button>
            </span>
          )
        })}
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
  const [applicationPrompt, setApplicationPrompt] = useState(initialProject?.application_prompt ?? '')
  const [maxApplicants, setMaxApplicants] = useState(initialProject?.max_applicants?.toString() ?? '10')

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
      application_prompt: applicationPrompt.trim(),
      max_applicants: maxApplicants ? parseInt(maxApplicants) : 10,
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

      <div style={fieldGap}>
        <Label htmlFor="peer-proj-prompt">Application question <span aria-hidden="true" style={{ color: C.accent }}>*</span></Label>
        <textarea id="peer-proj-prompt" required value={applicationPrompt} onChange={(e) => setApplicationPrompt(e.target.value)} rows={2} className="dk-textarea"
          placeholder={`e.g. "What's your first instinct for approaching this?"`} />
        <p style={{ fontSize: 11, color: C.textFaint }}>
          Every applicant answers this in a few sentences instead of writing a generic proposal — it's what filters out spray-applying.
        </p>
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
          <Label htmlFor="peer-proj-max-applicants">Application slots</Label>
          <input id="peer-proj-max-applicants" type="number" min={5} max={20} value={maxApplicants} onChange={(e) => setMaxApplicants(e.target.value)} className="dk-input" placeholder="10" />
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

      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        <button type="button" onClick={onCancel} className="wm-btn wm-btn-secondary" style={{ flex: 1, display: 'flex' }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} className="wm-btn wm-btn-primary" style={{ flex: 1, display: 'flex', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : <>Post project <Icon name="arrow-right" size={14} /></>}
        </button>
      </div>
    </form>
  )
}

// ─── Incoming request row ──────────────────────────────────────────────────────

function RequestRow({ app, contactShare, peerRecord, githubSkills, fitScore, currentUserId, onAccept, onReject, onConfirmCompletion }: {
  app: Application; contactShare?: ContactShare; peerRecord?: PeerRecord; githubSkills: GithubEvidencedSkill[]; fitScore: number
  currentUserId: string
  onAccept: (id: string) => void; onReject: (id: string) => void; onConfirmCompletion: (id: string) => void
}) {
  const applicant = app.students
  const [acting, setActing] = useState(false)
  const [showProposal, setShowProposal] = useState(false)

  async function handleAccept() { setActing(true); await onAccept(app.id); setActing(false) }
  async function handleReject() { setActing(true); await onReject(app.id); setActing(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{applicant?.full_name ?? 'Student'}</p>
            {fitScore > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <Icon name="star" size={10} />Verified fit {fitScore}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: C.textFaint }}>
            {applicant?.university ?? ''}
          </p>
          {applicant?.skills && applicant.skills.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 10, color: C.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Self-reported</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {applicant.skills.slice(0, 8).map((s) => {
                  const c = tagColor(s)
                  return <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>{s}</span>
                })}
              </div>
            </div>
          )}
          {githubSkills.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>
                <Icon name="github" size={11} />Tier 3 · GitHub-evidenced
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {githubSkills.slice(0, 8).map((s) => (
                  <span key={s.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono }}>
                    {s.skill} <span style={{ opacity: 0.7 }}>· {s.evidence_count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {app.resume_url && (
            <a href={`/api/resume?path=${encodeURIComponent(app.resume_url)}`} target="_blank" rel="noopener noreferrer" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
              <Icon name="external-link" size={12} />Resume
            </a>
          )}
          {app.status === 'applied' ? (
            <>
              <button onClick={handleReject} disabled={acting}
                style={{ fontSize: 12, fontWeight: 600, color: '#B91C1C', padding: '7px 12px', borderRadius: 999, border: '1px solid #FECACA', background: 'transparent', cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.5 : 1 }}>
                Decline
              </button>
              <button onClick={handleAccept} disabled={acting} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex', opacity: acting ? 0.6 : 1 }}>
                {acting ? '…' : 'Accept'}
              </button>
            </>
          ) : (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em',
              color: app.status === 'accepted' ? '#15803D' : '#B91C1C',
              background: app.status === 'accepted' ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${app.status === 'accepted' ? '#BBF7D0' : '#FECACA'}`,
            }}>
              {app.status}
            </span>
          )}
        </div>
      </div>

      {app.proposal_text && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <button onClick={() => setShowProposal((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: C.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name={showProposal ? 'chevron-up' : 'chevron-down'} size={13} /> {showProposal ? 'Hide answer' : 'Read answer'}
          </button>
          {showProposal && (
            <div style={{ marginTop: 10, background: C.bg, border: `1px solid ${C.border}`, padding: 14, borderRadius: 10 }}>
              <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{app.proposal_text}</p>
            </div>
          )}
        </div>
      )}

      {app.status === 'accepted' && contactShare?.student_email && (
        <div style={{ borderRadius: 10, background: C.accentHover, border: `1px solid ${C.accentBorder}`, padding: '10px 14px' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            <Icon name="check" size={11} />Contact shared
          </p>
          <a href={`mailto:${contactShare.student_email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text, textDecoration: 'none' }}>
            <Icon name="mail" size={13} />{contactShare.student_email}
          </a>
        </div>
      )}

      {app.status === 'accepted' && peerRecord && (
        <div>
          {peerRecord.locked_at ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Icon name="check" size={11} />Collaboration confirmed
            </span>
          ) : peerRecord.poster_confirmed_at ? (
            <p style={{ fontSize: 12, color: C.textFaint }}>Waiting on {applicant?.full_name ?? 'them'} to confirm too</p>
          ) : (
            <button onClick={() => onConfirmCompletion(app.id)} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
              <Icon name="check" size={13} />Mark this collaboration as complete
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
  verifiedSkillsByApplicant: Record<string, string[]>
}

const SHORTLIST_SIZE = 5

// Verified-fit score: how many of the project's required_skills show up in
// the applicant's VERIFIED (Tier 1/2/3) skill set — self-reported skills
// don't count. Ties broken by earliest application (first-come).
function fitScore(project: Project, verifiedSkills: string[]): number {
  const required = (project.required_skills ?? []).map((s) => s.toLowerCase())
  if (required.length === 0) return 0
  const verified = new Set(verifiedSkills)
  return required.filter((s) => verified.has(s)).length
}

export default function MarketplaceSection({ studentId, studentName, initialPostedProjects, initialReceivedRequests, contactShares, initialPeerRecords, githubSkillsByApplicant, verifiedSkillsByApplicant }: Props) {
  const { toast } = useToast()
  const [postedProjects, setPostedProjects] = useState<Project[]>(initialPostedProjects)
  const [receivedRequests, setReceivedRequests] = useState<Application[]>(initialReceivedRequests)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [showAllApplicants, setShowAllApplicants] = useState<Record<string, boolean>>({})
  const [shares, setShares] = useState<ContactShare[]>(contactShares)
  const [peerRecords, setPeerRecords] = useState<PeerRecord[]>(initialPeerRecords)

  function getRequestsForProject(project: Project) {
    return receivedRequests
      .filter((a) => a.project_id === project.id)
      .slice()
      .sort((a, b) => fitScore(project, verifiedSkillsByApplicant[b.student_id] ?? []) - fitScore(project, verifiedSkillsByApplicant[a.student_id] ?? []))
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
          Your posted projects
        </h2>
        <button onClick={() => setShowNewForm(true)} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
          <Icon name="plus" size={14} />Post a project
        </button>
      </div>

      {showNewForm && (
        <Card hoverable={false} padding={28} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 24 }}>New project</h3>
          <PeerProjectForm
            studentId={studentId}
            studentName={studentName}
            onSaved={(p) => { setPostedProjects((prev) => [p, ...prev]); setShowNewForm(false) }}
            onCancel={() => setShowNewForm(false)}
          />
        </Card>
      )}

      {postedProjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: C.accentHover, color: C.accent, marginBottom: 14 }}>
            <Icon name="briefcase" size={20} />
          </div>
          <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 6, fontWeight: 500 }}>You haven&apos;t posted a project yet</p>
          <p style={{ fontSize: 12, color: C.textFaint }}>Post one to find other students to collaborate with.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {postedProjects.map((project) => {
            const requests = getRequestsForProject(project)
            const expanded = expandedProject === project.id
            const editing = editingProjectId === project.id
            const pendingCount = requests.filter((a) => a.status === 'applied').length
            const acceptedCount = requests.filter((a) => a.status === 'accepted').length
            const stale = isStale(project)

            if (editing) {
              return (
                <Card key={project.id} hoverable={false} padding={28}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 24 }}>Edit project</h3>
                  <PeerProjectForm
                    studentId={studentId}
                    studentName={studentName}
                    initialProject={project}
                    onSaved={(p) => { setPostedProjects((prev) => prev.map((x) => (x.id === p.id ? p : x))); setEditingProjectId(null) }}
                    onCancel={() => setEditingProjectId(null)}
                  />
                </Card>
              )
            }

            return (
              <Card key={project.id} hoverable={false} padding={0} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{project.title ?? 'Untitled'}</h3>
                        <StatusBadge status={project.status} />
                        <ComplexityBadge level={project.complexity_level} />
                        {stale && (
                          <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '2px 9px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                            Still looking?
                          </span>
                        )}
                      </div>
                      <p style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 12, color: C.textFaint }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="calendar" size={12} />{fmtDate(project.created_at)}</span>
                        {project.duration && <span>{project.duration}</span>}
                        {project.team_size && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="users" size={12} />{acceptedCount}/{project.team_size} filled</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="eye" size={12} />{project.view_count} view{project.view_count === 1 ? '' : 's'}</span>
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {stale && (
                        <button onClick={() => handleRenew(project)} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex', color: '#B45309', borderColor: '#FDE68A' }}>
                          <Icon name="refresh" size={12} />Renew
                        </button>
                      )}
                      <select value={project.status} onChange={(e) => handleStatusChange(project, e.target.value)} className="dk-select" style={{ fontSize: 12, padding: '7px 30px 7px 10px', width: 'auto' }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="filled">Filled</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button onClick={() => setEditingProjectId(project.id)} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                        <Icon name="edit" size={12} />Edit
                      </button>
                      <button onClick={() => handleToggleOpen(project)} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                        {project.is_open ? 'Close' : 'Re-open'}
                      </button>
                      <button onClick={() => setExpandedProject(expanded ? null : project.id)} className="wm-btn wm-btn-sm" style={{ display: 'inline-flex', color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}` }}>
                        {requests.length} request{requests.length !== 1 ? 's' : ''}
                        {pendingCount > 0 && (
                          <span style={{ width: 16, height: 16, background: C.accent, color: '#FFFFFF', borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} aria-label={`${pendingCount} pending`}>
                            {pendingCount}
                          </span>
                        )}
                        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {requests.length === 0 ? (
                      <p style={{ fontSize: 12, color: C.textFaint, textAlign: 'center', padding: '12px 0' }}>No requests yet</p>
                    ) : (
                      <>
                        {requests.length > SHORTLIST_SIZE && (
                          <p style={{ fontSize: 11, color: C.textFaint, marginBottom: -2 }}>
                            Showing the {showAllApplicants[project.id] ? `all ${requests.length}` : `top ${SHORTLIST_SIZE}`} ranked by verified-skill fit against what you asked for.
                          </p>
                        )}
                        {(showAllApplicants[project.id] ? requests : requests.slice(0, SHORTLIST_SIZE)).map((app) => (
                          <RequestRow
                            key={app.id}
                            app={app}
                            contactShare={shareFor(app.id)}
                            peerRecord={recordFor(app.id)}
                            githubSkills={githubSkillsByApplicant[app.student_id] ?? []}
                            fitScore={fitScore(project, verifiedSkillsByApplicant[app.student_id] ?? [])}
                            currentUserId={studentId}
                            onAccept={handleAccept}
                            onReject={handleReject}
                            onConfirmCompletion={handleConfirmCompletion}
                          />
                        ))}
                        {requests.length > SHORTLIST_SIZE && (
                          <button
                            onClick={() => setShowAllApplicants((prev) => ({ ...prev, [project.id]: !prev[project.id] }))}
                            className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex', alignSelf: 'center' }}>
                            {showAllApplicants[project.id] ? 'Show top 5 only' : `Show all ${requests.length}`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
