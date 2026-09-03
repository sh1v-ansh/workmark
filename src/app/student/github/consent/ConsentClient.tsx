'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { C, F, R } from '@/lib/theme/dark-tokens'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 16, padding: '13px 0', borderTop: `1px solid ${C.borderFaint}` }} className="mob-1col">
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
      <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: C.text, marginBottom: 10 }}>
        Before you connect GitHub
      </h1>
      <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.65, marginBottom: 26 }}>
        GitHub&apos;s next screen will ask for &ldquo;read access to code and metadata&rdquo;.
        That&apos;s true but it doesn&apos;t say what we do with it, so here it is in plain terms.
        You pick which repositories — it does not have to be all of them.
      </p>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '6px 22px 18px' }}>
        <Row label="What we read">
          Dependency and config files (<code style={{ fontFamily: F.mono, fontSize: 12.5 }}>package.json</code>,{' '}
          <code style={{ fontFamily: F.mono, fontSize: 12.5 }}>requirements.txt</code>, Dockerfiles and
          the like), the import lines at the top of your files, file names and sizes, and commit
          dates and messages on commits you authored.
        </Row>
        <Row label="What we don&rsquo;t keep">
          Your source code. We read files to work out what you used and how the project is built;
          we store the conclusions, not the code. Nothing you write is copied into Workmark and
          nothing is used to train a model.
        </Row>
        <Row label="What it produces">
          A skill record — which technologies you&rsquo;ve genuinely used, at roughly what depth,
          with the repository and commits that show it. This is what people see when you apply,
          and it&rsquo;s the whole reason the account is worth having.
        </Row>
        <Row label="Private repositories">
          Only the ones you choose on the next screen. Their names appear in your own scan history;
          a private repo is never named to anyone else, and its evidence is only shown as the
          skill, never the repository.
        </Row>
        <Row label="Turning it off">
          Disconnect any time from your GitHub settings page or from GitHub itself, and we stop
          reading immediately. Ask us and we&rsquo;ll delete the record it built —{' '}
          <a href="mailto:support@workmark.org" style={{ color: C.text }}>support@workmark.org</a>.
        </Row>
      </div>

      {alreadyConsented && (
        <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.6, marginTop: 16 }}>
          You&apos;ve agreed to this before. Continuing just takes you back to GitHub to pick
          repositories.
        </p>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer', marginTop: 24 }}>
        <input
          type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="dk-checkbox" style={{ marginTop: 2 }}
        />
        <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
          I&apos;ve read this and I agree to Workmark analysing the repositories I select, as
          described in the{' '}
          <Link href="/legal/privacy" style={{ color: C.text }}>Privacy Policy</Link>.
        </span>
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <Button
          variant="accent" onClick={continueToGithub} disabled={!agreed || busy}
          busyLabel={busy ? 'One moment…' : null}
        >
          Agree and continue to GitHub
        </Button>
        <Link href="/student/dashboard" className="nb-btn nb-btn-quiet">Not now</Link>
      </div>

      <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6, marginTop: 20 }}>
        Saying no is fine. Your account works without it — you just won&apos;t have a verified
        record, which is most of what Workmark does.
      </p>
    </div>
  )
}
