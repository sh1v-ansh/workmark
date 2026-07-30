'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import { Icon } from '@/components/Icon'
import type { Project, Student } from '@/lib/types'

interface ApplyModalProps {
  project: Project
  student: Student
  heading?: string
  submitLabel?: string
  onClose: () => void
  onSuccess: () => void
}

const MIN_PROPOSAL_CHARS = 60
const MIN_SHORT_ANSWER_CHARS = 40
const MAX_ACTIVE_APPLICATIONS = 5

export default function ApplyModal({ project, student, heading = 'Apply to project', submitLabel = 'Submit →', onClose, onSuccess }: ApplyModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [useExisting, setUseExisting] = useState(!!student.resume_url)
  const [file, setFile] = useState<File | null>(null)
  const [proposal, setProposal] = useState('')

  const isPeerProject = project.poster_type === 'student'
  const remainingSlots = project.max_applicants - project.applicant_count
  const projectFull = isPeerProject && remainingSlots <= 0
  const atApplicationCap = student.active_application_count >= MAX_ACTIVE_APPLICATIONS

  const minChars = isPeerProject ? MIN_SHORT_ANSWER_CHARS : MIN_PROPOSAL_CHARS
  const proposalOk = proposal.trim().length >= minChars
  const resumeOk = isPeerProject ? true : (useExisting ? !!student.resume_url : !!file)
  const canSubmit = proposalOk && resumeOk && !uploading && !projectFull && !atApplicationCap

  async function handleApply() {
    if (!canSubmit) return
    setUploading(true)
    const supabase = createClient()
    try {
      let resumeUrl: string | null = null
      if (!isPeerProject) {
        resumeUrl = student.resume_url ?? null
        if (!useExisting && file) {
          const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${student.id}/${Date.now()}_${safeFilename}`
          const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file, { upsert: true })
          if (uploadError) throw uploadError
          resumeUrl = path
        }
        if (!resumeUrl) { toast('Please attach a resume before applying.', 'error'); return }
      }
      const { error } = await supabase.from('applications').insert({
        project_id: project.id,
        student_id: student.id,
        resume_url: resumeUrl,
        proposal_text: proposal.trim(),
        status: 'applied',
      })
      if (error) {
        if (error.code === '23505') { toast('You have already applied to this project.', 'error') } else { throw error }
        return
      }
      toast(isPeerProject ? 'Request sent!' : 'Application submitted!', 'success')
      onSuccess()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(4px)' }} aria-hidden="true" />

      <div role="dialog" aria-modal="true" aria-labelledby="apply-modal-title"
        style={{ position: 'relative', width: '100%', maxWidth: 520, background: C.bg, border: `1px solid ${C.border}`, padding: 28, boxShadow: '0 20px 48px rgba(62,31,255,0.15), 0 4px 12px rgba(0,0,0,0.08)', borderRadius: 12, maxHeight: '90vh', overflowY: 'auto' }}
        className="animate-slide-up">
        <h2 id="apply-modal-title" style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4, letterSpacing: '-0.01em' }}>{heading}</h2>
        <p style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans, marginBottom: 20 }}>{project.title}</p>

        {(projectFull || atApplicationCap) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 20 }}>
            <span style={{ color: '#B91C1C', flexShrink: 0, marginTop: 1 }}><Icon name="x" size={14} /></span>
            <p style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
              {projectFull
                ? "This project's application slots are full."
                : `You have ${student.active_application_count} of ${MAX_ACTIVE_APPLICATIONS} active applications. Withdraw one from your dashboard before applying here.`}
            </p>
          </div>
        )}

        {isPeerProject && !projectFull && remainingSlots <= 3 && (
          <p style={{ fontSize: 12, color: '#B45309', marginBottom: 16 }}>
            Only {remainingSlots} application slot{remainingSlots === 1 ? '' : 's'} left on this project.
          </p>
        )}

        {/* Answer / proposal */}
        <div style={{ marginBottom: 22 }}>
          <label htmlFor="proposal" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            {isPeerProject ? (project.application_prompt || 'What\'s your approach to this project?') : 'Proposal'}
            <span aria-hidden="true" style={{ color: C.accent }}> *</span>
          </label>
          <textarea id="proposal" rows={isPeerProject ? 4 : 6} value={proposal} onChange={(e) => setProposal(e.target.value)} className="dk-textarea"
            placeholder={isPeerProject
              ? 'A few sentences — specific to this project, not a copy-paste.'
              : `Why are you a fit for this project? What's your approach? Any relevant prior work?\n\nBe specific — this is what the poster reads before deciding.`} />
          <p style={{ fontSize: 11, color: proposalOk ? C.accent : C.textFaint, marginTop: 6 }}>
            {proposal.trim().length}/{minChars}+ chars {proposalOk ? '✓' : '(minimum)'}
          </p>
        </div>

        {isPeerProject ? (
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 22, lineHeight: 1.6 }}>
            Your self-reported skills and verified (GitHub, peer-confirmed) skills go with this request automatically — no resume needed.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Resume <span aria-hidden="true" style={{ color: C.accent }}>*</span></p>

            {student.resume_url && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: useExisting ? C.accentHover : C.surfaceAlt, border: `1px solid ${useExisting ? C.accentBorder : C.border}`, cursor: 'pointer', borderRadius: 8 }}>
                <input type="radio" name="resume" checked={useExisting} onChange={() => setUseExisting(true)} style={{ accentColor: C.accent }} />
                <div>
                  <p style={{ fontSize: 13, color: C.textSub, marginBottom: 2 }}>Use resume on file</p>
                  <p style={{ fontSize: 11, color: C.textFaint }}>Previously uploaded resume</p>
                </div>
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: !useExisting ? C.accentHover : C.surfaceAlt, border: `1px solid ${!useExisting ? C.accentBorder : C.border}`, cursor: 'pointer', borderRadius: 8 }}>
              <input type="radio" name="resume" checked={!useExisting} onChange={() => setUseExisting(false)} style={{ accentColor: C.accent }} />
              <div>
                <p style={{ fontSize: 13, color: C.textSub, marginBottom: 2 }}>Upload new resume</p>
                <p style={{ fontSize: 11, color: C.textFaint }}>PDF, max 5 MB</p>
              </div>
            </label>

            {!useExisting && (
              <div style={{ marginLeft: 4 }}>
                <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', padding: '14px', background: C.bg, border: `1px dashed ${file ? C.accent : C.border}`, color: file ? C.accent : C.textFaint, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', borderRadius: 8 }}>
                  {file ? file.name : 'Click to select PDF'}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="wm-btn wm-btn-secondary" style={{ flex: 1, display: 'flex' }}>
            Cancel
          </button>
          <button onClick={handleApply} disabled={!canSubmit} className="wm-btn wm-btn-primary" style={{ flex: 1, display: 'flex', opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {uploading ? 'Submitting…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
