'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'

const KINDS = Object.keys(EMAIL_KINDS) as EmailKind[]

export function NotificationsClient({
  initialPrefs,
  initialUnsubscribedAll,
  notice,
}: {
  initialPrefs: Record<string, boolean>
  initialUnsubscribedAll: boolean
  notice: string | null
}) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState(initialPrefs)
  const [allOff, setAllOff] = useState(initialUnsubscribedAll)
  const [busy, setBusy] = useState(false)

  const on = (kind: EmailKind) => prefs[kind] !== false && !(allOff && !EMAIL_KINDS[kind].essential)

  async function save(next: Record<string, boolean>, nextAllOff: boolean) {
    const prevPrefs = prefs
    const prevAll = allOff
    // Optimistic: a toggle that waits on a round trip before moving feels
    // broken, and the only failure mode is putting it back.
    setPrefs(next)
    setAllOff(nextAllOff)
    setBusy(true)
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: next, unsubscribeAll: nextAllOff }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save.')
    } catch (err) {
      setPrefs(prevPrefs)
      setAllOff(prevAll)
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  function toggle(kind: EmailKind) {
    const next = { ...prefs, [kind]: !on(kind) }
    // Turning one back on while everything is off should do what it looks
    // like it does, rather than being silently overridden by the global
    // switch. So it lifts the global off and turns the rest off explicitly.
    if (allOff && !on(kind)) {
      for (const k of KINDS) if (k !== kind && !EMAIL_KINDS[k].essential) next[k] = false
      void save(next, false)
      return
    }
    void save(next, allOff)
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '40px 24px 72px' }}>
      <Link href="/student/dashboard" style={{ fontSize: 13, color: C.textFaint, textDecoration: 'none' }}>← Back</Link>

      <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: C.text, margin: '20px 0 10px' }}>
        Email
      </h1>
      <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.65, marginBottom: 24 }}>
        Workmark only emails you when something happened that you can act on. Turn off whatever
        you don&apos;t want.
      </p>

      {notice && (
        <div role="status" style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '13px 16px', fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
          {notice}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: 'hidden' }}>
        {KINDS.map((kind, i) => {
          const meta = EMAIL_KINDS[kind]
          return (
            <label
              key={kind}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 13, padding: '15px 20px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.borderFaint}`,
                cursor: meta.essential ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox" checked={on(kind)} disabled={meta.essential || busy}
                onChange={() => toggle(kind)} className="dk-checkbox" style={{ marginTop: 2 }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                  {meta.label}
                </span>
                <span style={{ display: 'block', fontSize: 13, color: C.textFaint, lineHeight: 1.55 }}>
                  {meta.detail}
                  {meta.essential && (
                    <>
                      {' '}
                      <span style={{ color: C.textGhost }}>
                        — can&apos;t be turned off. It&apos;s the answer to something you sent, and
                        dropping it would leave you refreshing a page for weeks.
                      </span>
                    </>
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      <button
        type="button" disabled={busy}
        onClick={() => save(prefs, !allOff)}
        style={{ background: 'none', border: 'none', padding: 0, marginTop: 18, font: 'inherit', fontSize: 13.5, color: C.textFaint, textDecoration: 'underline', cursor: 'pointer' }}
      >
        {allOff ? 'Turn my email back on' : 'Turn off everything optional'}
      </button>

      <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6, marginTop: 26 }}>
        Changes save as you make them. This doesn&apos;t affect password resets or sign-in emails,
        which aren&apos;t notifications.
      </p>
    </div>
  )
}
