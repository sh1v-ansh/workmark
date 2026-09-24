'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { C, R } from '@/lib/theme/dark-tokens'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'
import { CONSENT_TEXT } from '@/lib/notify/marketing'

// 'opportunities' is controlled by the marketing consent switch, not here.
const KINDS = (Object.keys(EMAIL_KINDS) as EmailKind[]).filter((k) => k !== 'opportunities')

/**
 * Which emails Workmark is allowed to send.
 *
 * This was its own page at /account/notifications. It is a settings section,
 * so it lives with the other settings; the old route forwards here because
 * its address is printed in the List-Unsubscribe header of every email we
 * have ever sent and cannot stop existing.
 */
export default function EmailSection({
  initialPrefs,
  initialUnsubscribedAll,
  initialMarketing,
  notice,
}: {
  initialPrefs: Record<string, boolean>
  initialUnsubscribedAll: boolean
  /** Whether they have agreed to hear about opportunities. */
  initialMarketing: boolean
  notice: string | null
}) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState(initialPrefs)
  const [allOff, setAllOff] = useState(initialUnsubscribedAll)
  const [marketing, setMarketing] = useState(initialMarketing)
  const [busy, setBusy] = useState(false)

  /**
   * Its own save, deliberately not folded into the one below.
   *
   * save() rebuilds the whole preference map every time, which is right for
   * a set of checkboxes that always travel together. Sending the consent
   * flag through it would mean every unrelated toggle also rewrote the
   * consent record — and the consent record carries a timestamp that is
   * legal proof of when this person agreed. Moving that because somebody
   * switched off "a task is assigned to you" would quietly destroy it.
   */
  async function saveMarketing(next: boolean) {
    const prev = marketing
    setMarketing(next)
    setBusy(true)
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs, unsubscribeAll: allOff, marketingOptIn: next }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save.')
    } catch (err) {
      setMarketing(prev)
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

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
    <>
      {notice && (
        <div
          role="status"
          style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '13px 16px', fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 18 }}
        >
          {notice}
        </div>
      )}

      <div style={{ border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'hidden' }}>
        {KINDS.map((kind, i) => {
          const meta = EMAIL_KINDS[kind]
          return (
            <label
              key={kind}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 17px',
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

      {/* Opportunities, below the rule and visibly apart from the list.
          Everything above is the outcome of something this person did —
          somebody applied to their project, their work was checked. This is
          the only one that is not, which makes it the only one that is
          marketing, and it is governed by different rules: consent has to
          have been freely given, and withdrawal has to be as easy as the
          giving (GDPR Art. 7(3)). Hence: the same toggle, the same page, one
          click, no email to support. */}
      <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.borderFaint}` }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 13, cursor: 'pointer' }}>
          <input
            type="checkbox" checked={marketing} disabled={busy}
            onChange={() => saveMarketing(!marketing)}
            className="dk-checkbox" style={{ marginTop: 2 }}
          />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>
              Opportunities that fit your record
            </span>
            <span style={{ display: 'block', fontSize: 13, color: C.textFaint, lineHeight: 1.55 }}>
              {CONSENT_TEXT}
            </span>
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button" disabled={busy}
          onClick={() => save(prefs, !allOff)}
          style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 13.5, color: C.textFaint, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}
        >
          {allOff ? 'Turn my email back on' : 'Turn off everything optional'}
        </button>
        <span style={{ fontSize: 13, color: C.textGhost }}>Saves as you change it</span>
      </div>
    </>
  )
}
