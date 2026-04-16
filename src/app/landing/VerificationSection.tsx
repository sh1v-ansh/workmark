'use client'

import { useState } from 'react'
import { C, F } from './tokens'

type WorkAgain = 'yes' | 'maybe' | 'no'

function InteractiveAttestation() {
  const [delivered, setDelivered] = useState<'yes' | 'no' | null>(null)
  const [stack, setStack] = useState({ React: true, TypeScript: true, SQL: true })
  const [workAgain, setWorkAgain] = useState<WorkAgain | null>(null)
  const [legalChecked, setLegalChecked] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = delivered === 'yes' && workAgain !== null && legalChecked

  const toggleBtn = (active: boolean) => ({
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accentHover : C.surfaceAlt,
    color: active ? C.accent : C.textMuted,
    cursor: 'pointer' as const,
    transition: 'all 0.15s',
  })

  if (submitted) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, background: C.accentHover, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10l4 4 8-8" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Record locked</div>
        <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
          Aisha&apos;s engagement has been confirmed. Her record is now permanent and verified — no edits, no disputes.
        </p>
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Record hash</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.accent }}>wm_rec_7f3a9b2c1e4d…</div>
        </div>
        <button
          onClick={() => { setSubmitted(false); setDelivered(null); setWorkAgain(null); setLegalChecked(false); setStack({ React: true, TypeScript: true, SQL: true }) }}
          style={{ fontSize: 12, color: C.textFaint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.mono }}
        >
          Reset demo ↩
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Employer attestation — project close
      </div>

      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, fontWeight: 500 }}>Aisha Syed</div>
        <div style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono, marginTop: 2 }}>Nonprofit Data Dashboard · 8 wks</div>
      </div>

      {/* Delivered? */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Did the student deliver on the project brief?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['yes', 'no'] as const).map(v => (
            <button key={v} onClick={() => setDelivered(v)} style={{ flex: 1, padding: '8px 0', fontFamily: F.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', ...toggleBtn(delivered === v) }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Stack */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>
          Stack used <span style={{ fontSize: 11, color: C.textFaint }}>(uncheck any not used)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(stack) as Array<keyof typeof stack>).map(s => (
            <button key={s} onClick={() => setStack(p => ({ ...p, [s]: !p[s] }))} style={{ padding: '5px 12px', fontFamily: F.mono, fontSize: 12, ...toggleBtn(stack[s]) }}>
              {stack[s] ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>
      </div>

      {/* Work again? */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Would you work with them again?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['yes', 'maybe', 'no'] as const).map(v => (
            <button key={v} onClick={() => setWorkAgain(v)} style={{ flex: 1, padding: '8px 0', fontFamily: F.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', ...toggleBtn(workAgain === v) }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legal */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
        <input type="checkbox" checked={legalChecked} onChange={e => setLegalChecked(e.target.checked)} style={{ marginTop: 2, accentColor: C.accent, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5 }}>
          I confirm this attestation is accurate. I understand it will be permanently associated with this student&apos;s record. No code or files are reviewed — this is my word only.
        </span>
      </label>

      <button
        onClick={() => canSubmit && setSubmitted(true)}
        disabled={!canSubmit}
        style={{ width: '100%', padding: '11px 0', fontFamily: F.mono, fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', background: canSubmit ? C.accent : C.surfaceAlt, color: canSubmit ? C.bg : C.textGhost, border: `1px solid ${canSubmit ? C.accent : C.border}`, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
      >
        Confirm &amp; lock record
      </button>
    </div>
  )
}

const flowSteps = [
  ['01', 'Stack locked at posting', 'The technologies are declared before work begins — no retroactive changes.'],
  ['02', 'Activity trail auto-captured', 'Work activity is logged internally. No code or files are ever shared or reviewed.'],
  ['03', 'Project closes', 'The engagement window ends. Both parties receive a confirmation request.'],
  ['04', 'Employer taps confirm', 'One confirmation. Record is locked forever — immutable and employer-signed.'],
]

export function VerificationSection() {
  return (
    <section id="verification" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
        <div className="reveal-item">
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Verification</div>
          <h2 style={{ fontFamily: F.serif, fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: C.text, marginBottom: 24 }}>
            One button.<br />Permanent record.
          </h2>
          <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.7, marginBottom: 32 }}>
            No code review. No file uploads. No disputes. The employer confirms four things — that&apos;s it.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {flowSteps.map(([n, title, body]) => (
              <div key={n} style={{ display: 'flex', gap: 16 }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, marginTop: 2, flexShrink: 0 }}>{n}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal-item" style={{ transitionDelay: '0.15s' }}>
          <InteractiveAttestation />
        </div>
      </div>
    </section>
  )
}
