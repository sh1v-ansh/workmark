'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { C, F, R } from '@/lib/theme/dark-tokens'

function Row({ label, children, first = false }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 16, padding: '13px 0', borderTop: first ? 'none' : `1px solid ${C.borderFaint}` }} className="mob-1col">
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>{label}</div>
      <div style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

/**
 * The screen before GitHub's screen.
 *
 * GitHub's own install page says "read access to code and metadata", which
 * is accurate and useless — it describes a permission, not a purpose. This
 * page says what gets read, what gets kept, what other people end up seeing,
 * and how to undo it. Someone should be able to say no here and still have
 * an account that works.
 */
export function ConsentClient({ alreadyConsented }: { alreadyConsented: boolean }) {
  const { toast } = useToast()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function continueToGithub() {
    setBusy(true)
    try {
      // Recorded before the redirect, not after the install returns. If the
      // student walks away at GitHub's screen we have a consent row and no
      // installation, which is harmless. The reverse — an installation we
      // can't show consent for — is the case that must not happen.
      const res = await fetch('/api/github/consent', { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not record your consent.')
      }
      window.location.href = '/api/github/app/install'
    } catch (err) {
      setBusy(false)
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 72px' }}>
      <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, marginBottom: 10 }}>
        Before you connect GitHub
      </h1>
      <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.65, marginBottom: 22 }}>
        Here is what we do with access, in plain terms.
      </p>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '4px 22px' }}>
        <Row label="What we read" first>
          Dependency files, imports, file names and your own commits.
        </Row>
        <Row label="What we keep">
          Only the skills we find. We never copy your code or use it to train AI.
        </Row>
        <Row label="Private repos">
          Only the ones you pick. They are never named to anyone else.
        </Row>
        <Row label="Leaving out a repo">
          Switch any repo off in your Repositories list on Workmark and we will not read it. Switch it back on any time.
        </Row>
        <Row label="Stopping">
          Disconnect any time and we stop reading straight away.
        </Row>
      </div>

      {/* GitHub's screen is unfamiliar to most first-years, and choosing
          "Only select repositories" by mistake is the usual reason a scan
          finds nothing. */}
      <div style={{ marginTop: 22, padding: '16px 20px', borderRadius: R.lg, background: '#F4F1FF', border: '1px solid rgba(97,66,245,0.18)' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>On GitHub&apos;s next screen</p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.textSub, lineHeight: 1.75 }}>
          <li>Under <strong>Repository access</strong>, choose <strong>All repositories</strong>.</li>
          <li>Click <strong>Install</strong> (or <strong>Save</strong> if you have connected before).</li>
          <li>You come back here and pick anything you want left out.</li>
        </ol>
      </div>

      {alreadyConsented && (
        <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.6, marginTop: 16 }}>
          You&apos;ve agreed to this before. Continuing takes you straight to GitHub.
        </p>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer', marginTop: 22 }}>
        <input
          type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="dk-checkbox" style={{ marginTop: 2 }}
        />
        <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
          I agree to Workmark reading the repositories I select, as described in the{' '}
          <Link href="/legal/privacy" style={{ color: C.text }}>Privacy Policy</Link>.
        </span>
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <Button
          variant="accent" onClick={continueToGithub} disabled={!agreed || busy}
          busyLabel={busy ? 'One moment…' : null}
        >
          Agree and continue to GitHub
        </Button>
        <Link href="/student/dashboard" className="nb-btn nb-btn-quiet">Not now</Link>
      </div>
    </div>
  )
}
