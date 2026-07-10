'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import type { Student } from '@/lib/types'

interface ApplyModalProps {
  projectId: string
  projectTitle: string
  student: Student
  onClose: () => void
  onSuccess: () => void
}

const MIN_PROPOSAL_CHARS = 60

export default function ApplyModal({ projectId, projectTitle, student, onClose, onSuccess }: ApplyModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [useExisting, setUseExisting] = useState(!!student.resume_url)
  const [file, setFile] = useState<File | null>(null)
  const [proposal, setProposal] = useState('')

  const proposalOk = proposal.trim().length >= MIN_PROPOSAL_CHARS
  const resumeOk = useExisting ? !!student.resume_url : !!file
  const canSubmit = proposalOk && resumeOk && !uploading

  async function handleApply() {
    if (!canSubmit) return
    setUploading(true)
    const supabase = createClient()
    try {
      let resumeUrl = student.resume_url ?? null
      if (!useExisting && file) {
        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${student.id}/${Date.now()}_${safeFilename}`
        const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file, { upsert: true })
        if (uploadError) throw uploadError
        resumeUrl = path
      }
      if (!resumeUrl) { toast('Please attach a resume before applying.', 'error'); return }
      const { error } = await supabase.from('applications').insert({
        project_id: projectId,
        student_id: student.id,
        resume_url: resumeUrl,
        proposal_text: proposal.trim(),
        status: 'applied',
      })
      if (error) {
        if (error.code === '23505') { toast('You have already applied to this project.', 'error') } else { throw error }
        return
      }
      toast('Application submitted!', 'success')
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
        <h2 id="apply-modal-title" style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4, letterSpacing: '-0.01em' }}>Apply to project</h2>
        <p style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans, marginBottom: 24 }}>{projectTitle}</p>

        {/* Proposal */}
        <div style={{ marginBottom: 22 }}>
          <label htmlFor="proposal" style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Proposal <span aria-hidden="true" style={{ color: C.accent }}>*</span>
          </label>
          <textarea id="proposal" rows={6} value={proposal} onChange={(e) => setProposal(e.target.value)} className="dk-textarea"
            placeholder={`Why are you a fit for this project? What's your approach? Any relevant prior work?\n\nBe specific — this is what the poster reads before deciding.`} />
          <p style={{ fontFamily: F.mono, fontSize: 10, color: proposalOk ? C.accent : C.textFaint, marginTop: 6 }}>
            {proposal.trim().length}/{MIN_PROPOSAL_CHARS}+ chars {proposalOk ? '✓' : '(minimum)'}
          </p>
        </div>

        {/* Resume selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Resume <span aria-hidden="true" style={{ color: C.accent }}>*</span></p>

          {student.resume_url && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: useExisting ? C.accentHover : C.surfaceAlt, border: `1px solid ${useExisting ? C.accentBorder : C.border}`, cursor: 'pointer', borderRadius: 8 }}>
              <input type="radio" name="resume" checked={useExisting} onChange={() => setUseExisting(true)} style={{ accentColor: C.accent }} />
              <div>
                <p style={{ fontSize: 13, color: C.textSub, marginBottom: 2 }}>Use resume on file</p>
                <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Previously uploaded resume</p>
              </div>
            </label>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: !useExisting ? C.accentHover : C.surfaceAlt, border: `1px solid ${!useExisting ? C.accentBorder : C.border}`, cursor: 'pointer', borderRadius: 8 }}>
            <input type="radio" name="resume" checked={!useExisting} onChange={() => setUseExisting(false)} style={{ accentColor: C.accent }} />
            <div>
              <p style={{ fontSize: 13, color: C.textSub, marginBottom: 2 }}>Upload new resume</p>
              <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>PDF, max 5 MB</p>
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

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: 8 }}>
            Cancel
          </button>
          <button onClick={handleApply} disabled={!canSubmit}
            style={{ flex: 1, padding: '11px 0', background: canSubmit ? C.accent : C.surfaceAlt, border: 'none', color: canSubmit ? '#FFFFFF' : C.textFaint, fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: canSubmit ? 'pointer' : 'not-allowed', textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: 8 }}>
            {uploading ? 'Submitting…' : 'Submit →'}
          </button>
        </div>
      </div>
    </div>
  )
}
