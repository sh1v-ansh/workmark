'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/app/landing/tokens'
import type { Student } from '@/lib/types'

interface ApplyModalProps {
  projectId: string
  projectTitle: string
  student: Student
  onClose: () => void
  onSuccess: () => void
}

export default function ApplyModal({ projectId, projectTitle, student, onClose, onSuccess }: ApplyModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [useExisting, setUseExisting] = useState(!!student.resume_url)
  const [file, setFile] = useState<File | null>(null)

  async function handleApply() {
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
      const { error } = await supabase.from('applications').insert({ project_id: projectId, student_id: student.id, resume_url: resumeUrl, status: 'applied' })
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
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} aria-hidden="true" />

      {/* Panel */}
      <div role="dialog" aria-modal="true" aria-labelledby="apply-modal-title" style={{ position: 'relative', width: '100%', maxWidth: 420, background: C.surface, border: `1px solid ${C.border}`, padding: 28, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }} className="animate-slide-up">
        <h2 id="apply-modal-title" style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4, letterSpacing: '0.02em' }}>Apply to project</h2>
        <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono, marginBottom: 24 }}>{projectTitle}</p>

        {/* Resume selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Resume</p>

          {student.resume_url && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: useExisting ? C.accentHover : C.surfaceAlt, border: `1px solid ${useExisting ? C.accentBorder : C.border}`, cursor: 'pointer', transition: 'all 0.15s' }}>
              <input type="radio" name="resume" checked={useExisting} onChange={() => setUseExisting(true)} style={{ accentColor: C.accent }} />
              <div>
                <p style={{ fontSize: 13, color: C.textSub, marginBottom: 2 }}>Use resume on file</p>
                <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Previously uploaded resume</p>
              </div>
            </label>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: !useExisting ? C.accentHover : C.surfaceAlt, border: `1px solid ${!useExisting ? C.accentBorder : C.border}`, cursor: 'pointer', transition: 'all 0.15s' }}>
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
                style={{ width: '100%', padding: '14px', background: C.bg, border: `1px dashed ${file ? C.accent : C.border}`, color: file ? C.accent : C.textFaint, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                {file ? file.name : 'Click to select PDF'}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Cancel
          </button>
          <button onClick={handleApply} disabled={uploading || (!useExisting && !file)}
            style={{ flex: 1, padding: '10px 0', background: (uploading || (!useExisting && !file)) ? C.surfaceAlt : C.accent, border: 'none', color: (uploading || (!useExisting && !file)) ? C.textFaint : C.bg, fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: (uploading || (!useExisting && !file)) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
            {uploading ? 'Submitting…' : 'Submit →'}
          </button>
        </div>
      </div>
    </div>
  )
}
