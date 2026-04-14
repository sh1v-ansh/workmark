'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import type { Student } from '@/lib/types'

interface ApplyModalProps {
  projectId: string
  projectTitle: string
  student: Student
  onClose: () => void
  onSuccess: () => void
}

export default function ApplyModal({
  projectId,
  projectTitle,
  student,
  onClose,
  onSuccess,
}: ApplyModalProps) {
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
        // Sanitise the filename to avoid path traversal
        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${student.id}/${Date.now()}_${safeFilename}`
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(path, file, { upsert: true })

        if (uploadError) throw uploadError

        // Build a private URL (signed URLs are generated when needed)
        resumeUrl = path
      }

      if (!resumeUrl) {
        toast('Please attach a resume before applying.', 'error')
        return
      }

      const { error } = await supabase.from('applications').insert({
        project_id: projectId,
        student_id: student.id,
        resume_url: resumeUrl,
        status: 'applied',
      })

      if (error) {
        if (error.code === '23505') {
          toast('You have already applied to this project.', 'error')
        } else {
          throw error
        }
        return
      }

      toast('Application submitted!', 'success')
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      toast(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-slide-up">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Apply to project
          </h2>
          <p className="text-sm text-gray-500 mb-5">{projectTitle}</p>

          {/* Resume selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Resume</p>

            {student.resume_url && (
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="resume"
                  checked={useExisting}
                  onChange={() => setUseExisting(true)}
                  className="accent-brand-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Use resume on file
                  </p>
                  <p className="text-xs text-gray-400">
                    Previously uploaded resume
                  </p>
                </div>
              </label>
            )}

            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="resume"
                checked={!useExisting}
                onChange={() => setUseExisting(false)}
                className="accent-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Upload new resume
                </p>
                <p className="text-xs text-gray-400">PDF, max 5 MB</p>
              </div>
            </label>

            {!useExisting && (
              <div className="ml-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                >
                  {file ? (
                    <span className="font-medium text-gray-800">
                      {file.name}
                    </span>
                  ) : (
                    'Click to select PDF'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={uploading || (!useExisting && !file)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit Application'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
