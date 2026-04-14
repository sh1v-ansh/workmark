'use client'

import { useState } from 'react'

interface Record {
  id: string
  project_title: string | null
  company_name: string | null
  start_date: string | null
  end_date: string | null
  verification_status: string
  students?: { full_name: string | null }
}

interface Props {
  record: Record
  token: string
}

type ActionState = 'idle' | 'loading' | 'done'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VerifyClient({ record, token }: Props) {
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [decision, setDecision] = useState<'verified' | 'incomplete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Already actioned
  const alreadyActioned =
    record.verification_status === 'verified' ||
    record.verification_status === 'incomplete'

  async function submitDecision(status: 'verified' | 'incomplete') {
    setActionState('loading')
    setError(null)

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, status }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong.')

      setDecision(status)
      setActionState('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setActionState('idle')
    }
  }

  const studentName = record.students?.full_name ?? 'the student'

  // ── Already done state ──
  if (actionState === 'done' && decision) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md text-center">
          {decision === 'verified' ? (
            <>
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Experience verified
              </h1>
              <p className="text-sm text-gray-500">
                {studentName}&rsquo;s Workmark record for{' '}
                <strong>{record.project_title}</strong> has been marked as{' '}
                <span className="text-green-700 font-semibold">verified</span>.
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Response recorded</h1>
              <p className="text-sm text-gray-500">
                {studentName}&rsquo;s record has been marked as incomplete. Thank you for
                your response.
              </p>
            </>
          )}
          <p className="text-xs text-gray-400 mt-5">
            Powered by Workmark · You can close this tab.
          </p>
        </div>
      </div>
    )
  }

  // ── Already actioned (server state) ──
  if (alreadyActioned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md text-center">
          <p className="text-4xl mb-4">
            {record.verification_status === 'verified' ? '✅' : '⚪'}
          </p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Already responded
          </h1>
          <p className="text-sm text-gray-500">
            This experience record was already marked as{' '}
            <strong>{record.verification_status}</strong>.
          </p>
        </div>
      </div>
    )
  }

  // ── Main verification form ──
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-3xl font-bold tracking-tight text-gray-900">
            Work<span className="text-brand-600">mark</span>
          </span>
          <p className="text-sm text-gray-500 mt-1">Experience Verification</p>
        </div>

        {/* Record details */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-6 space-y-2">
          <div>
            <p className="text-xs text-gray-400">Student</p>
            <p className="text-sm font-semibold text-gray-900">{studentName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Project</p>
            <p className="text-sm font-semibold text-gray-900">
              {record.project_title ?? 'Project'}
            </p>
          </div>
          {record.company_name && (
            <div>
              <p className="text-xs text-gray-400">Company</p>
              <p className="text-sm text-gray-700">{record.company_name}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <p className="text-xs text-gray-400">Start date</p>
              <p className="text-sm text-gray-700">{fmtDate(record.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">End date</p>
              <p className="text-sm text-gray-700">{fmtDate(record.end_date)}</p>
            </div>
          </div>
        </div>

        <h2 className="text-base font-bold text-gray-900 mb-1 text-center">
          Did {studentName} complete this project?
        </h2>
        <p className="text-sm text-gray-500 text-center mb-5">
          Your response creates a verified record on their Workmark profile.
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 animate-fade-in">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => submitDecision('incomplete')}
            disabled={actionState === 'loading'}
            className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Did not complete
          </button>
          <button
            onClick={() => submitDecision('verified')}
            disabled={actionState === 'loading'}
            className="flex-1 py-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {actionState === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              'Yes, completed ✓'
            )}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-5">
          No login required. This link is unique to this record.
        </p>
      </div>
    </div>
  )
}
