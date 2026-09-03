'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { GRACE_DAYS } from '@/lib/account/deletion'

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 7 }}>{children}</li>
  )
}

/**
 * The page that lets someone leave.
 *
 * Written to be readable rather than discouraging. A deletion flow that
 * hides the button, buries it under three "are you sure"s, or lists the
 * consequences in a tone designed to frighten is a dark pattern, and this
 * product's whole claim is that it tells people the truth about themselves.
 * One typed confirmation, an honest list of what goes and what can be
 * undone, and out.
 */
export function DeleteClient({ liveEngagements }: { liveEngagements: number }) {
  const router = useRouter()
  const { toast } = useToast()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not delete the account.')

      // Signed out here rather than left in a half-valid session. The
      // account is no longer usable, and a stale session would just bounce
      // between pages telling them so.
      await createClient().auth.signOut()
      router.replace('/account/deleted?done=1')
      router.refresh()
    } catch (err) {
      setBusy(false)
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 72px' }}>
      <Link href="/student/dashboard" style={{ fontSize: 13, color: C.textFaint, textDecoration: 'none' }}>
        ← Back
      </Link>

      <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: C.text, margin: '20px 0 10px' }}>
        Delete your account
      </h1>
      <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.65, marginBottom: 26 }}>
        You can do this, and we&apos;ll actually do it. Here&apos;s exactly what happens.
      </p>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '20px 22px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 11 }}>Straight away</h2>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <Bullet>You&apos;re signed out and the account stops working.</Bullet>
          <Bullet>Your public profile stops loading and you disappear from the student directory.</Bullet>
          <Bullet>Any application you have open is withdrawn, and any listing you posted is closed.</Bullet>
          <Bullet>We stop reading your GitHub.</Bullet>
        </ul>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '20px 22px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 11 }}>After {GRACE_DAYS} days</h2>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <Bullet>
            Everything is deleted for real — your profile, your skill record and the evidence
            behind it, your messages, your engagement history. Not hidden. Gone.
          </Bullet>
          <Bullet>Workmark&apos;s access to your GitHub is revoked at GitHub&apos;s end too.</Bullet>
          <Bullet>
            All we keep is a line saying an account asked to be deleted on this date and was.
            It has no name, no email and nothing about you in it.
          </Bullet>
        </ul>
      </div>

      <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '15px 18px', marginBottom: 22 }}>
        <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>You have {GRACE_DAYS} days to change your mind.</strong>{' '}
          Sign in again and there&apos;s a button to restore it. That brings back your record — but
          not your public profile link, your directory listing or the applications that were
          withdrawn. Those went the moment you pressed the button.
        </p>
      </div>

      {liveEngagements > 0 && (
        <div role="alert" style={{ background: state.cautionBg, borderRadius: R.md, padding: '14px 17px', marginBottom: 22, fontSize: 13.5, color: '#6B3A0A', lineHeight: 1.6 }}>
          You have {liveEngagements === 1 ? 'a project' : `${liveEngagements} projects`} in progress.
          Deleting your account ends {liveEngagements === 1 ? 'it' : 'them'} and the other side
          loses the record of the work. Worth telling them first.
        </div>
      )}

      <label htmlFor="confirm-delete" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>
        Type <code style={{ fontFamily: F.mono }}>DELETE</code> to confirm
      </label>
      <input
        id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off" spellCheck={false} className="dk-input"
        style={{ maxWidth: 220, marginBottom: 20 }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button
          variant="danger" onClick={submit} disabled={confirm !== 'DELETE' || busy}
          busyLabel={busy ? 'Deleting…' : null}
        >
          Delete my account
        </Button>
        <Link href="/student/dashboard" className="nb-btn nb-btn-quiet">Keep my account</Link>
      </div>

      <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6, marginTop: 24 }}>
        Want a copy of everything we hold about you before you go? Ask at{' '}
        <a href="mailto:support@workmark.org" style={{ color: C.textFaint }}>support@workmark.org</a>{' '}
        and we&apos;ll send it.
      </p>
    </div>
  )
}
