'use client'

import { useState } from 'react'
import Link from 'next/link'
import { C, F } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

interface Record {
  id: string
  project_title: string | null
  poster_display_name: string | null
  start_date: string | null
  end_date: string | null
  verification_status: string
  students?: { full_name: string | null } | null
}

interface Props {
  record: Record | null
  token: string
}

type ActionState = 'idle' | 'loading' | 'done'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
        <Wordmark height={33} />
      </Link>
      {children}
    </main>
  )
}

export default function VerifyClient({ record, token }: Props) {
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [decision, setDecision] = useState<'verified' | 'incomplete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!record) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>Link not found</h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            This verification link is invalid or has expired.
          </p>
        </div>
      </Shell>
    )
  }

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

  if (actionState === 'done' && decision) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: C.accentHover, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', borderRadius: '50%' }} aria-hidden="true">
            {decision === 'verified' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            {decision === 'verified' ? 'Experience verified' : 'Response recorded'}
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            {studentName}&rsquo;s record for <strong style={{ color: C.text }}>{record.project_title ?? 'this project'}</strong> has been marked as{' '}
            <strong style={{ color: decision === 'verified' ? C.accent : C.textSub }}>{decision}</strong>.
          </p>
          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 20 }}>You can close this tab.</p>
        </div>
      </Shell>
    )
  }

  if (alreadyActioned) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>Already responded</h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            This record was already marked as <strong style={{ color: C.text }}>{record.verification_status}</strong>.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32, width: '100%', maxWidth: 440 }}>
        <p style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
          Experience verification
        </p>
        <h1 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 20, lineHeight: 1.3 }}>
          Did {studentName} complete this project?
        </h1>

        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 16, marginBottom: 20 }}>
          <Row label="Student" value={studentName} />
          <Row label="Project" value={record.project_title ?? 'Project'} />
          {record.poster_display_name && <Row label="Organization" value={record.poster_display_name} />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Row label="Start" value={fmtDate(record.start_date)} />
            <Row label="End" value={fmtDate(record.end_date)} />
          </div>
        </div>

        {error && (
          <div role="alert" style={{ background: 'rgba(180,40,40,0.12)', border: '1px solid rgba(180,40,40,0.35)', padding: '10px 14px', fontSize: 13, color: '#DC2626', fontFamily: F.sans, lineHeight: 1.5, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => submitDecision('incomplete')}
            disabled={actionState === 'loading'}
            style={{ flex: 1, padding: '12px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: actionState === 'loading' ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Did not complete
          </button>
          <button
            onClick={() => submitDecision('verified')}
            disabled={actionState === 'loading'}
            style={{ flex: 1, padding: '12px 0', background: C.accent, border: 'none', color: '#FFFFFF', fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: actionState === 'loading' ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            {actionState === 'loading' ? 'Saving…' : 'Yes, completed ✓'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, textAlign: 'center', marginTop: 16 }}>
          No login required. This link is unique to this record.
        </p>
      </div>
    </Shell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono), IBM Plex Mono, Menlo, monospace', color: '#7C7C86', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: '#F5F4F8' }}>{value}</p>
    </div>
  )
}
