'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { C, T } from '@/lib/theme/dark-tokens'

/**
 * Send one real email, and say what actually happened.
 *
 * Mail is the one part of this product that cannot be tested by looking at
 * it: every send is best-effort and returns a boolean nobody reads, so
 * "notifications aren't working" has always been a guess. The key, the
 * sender address, the DNS records and the template are four separate things
 * that break the same silent way.
 *
 * The result is shown in full, including Resend's own error body, because
 * "Resend returned 403, the domain is not verified" is the whole reason to
 * press the button. A toast saying "Something went wrong" would be the one
 * useless outcome.
 */
export default function TestEmailButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function send() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/test-email', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setResult(res.ok
        ? {
            ok: true,
            message: `Sent to ${data.to} as ${data.from}. Check where it landed — `
              + 'inbox, Promotions or Spam is the thing worth knowing.'
              + (data.marketingBlocked ? ` Marketing mail is still blocked: ${data.marketingBlocked}` : ''),
          }
        : { ok: false, message: data.error ?? `The request failed with ${res.status}.` })
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'The request failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={send} busyLabel={busy ? 'Sending…' : null}>
        Send myself a test email
      </Button>

      {result && (
        <p style={{
          fontSize: T.meta,
          lineHeight: 1.6,
          marginTop: 10,
          color: result.ok ? '#14663D' : '#A32218',
          // Resend's error bodies are JSON and long. Wrapping beats a line
          // that runs off the side of the panel with the reason in it.
          wordBreak: 'break-word',
        }}>
          {result.message}
        </p>
      )}

      <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.6, marginTop: 8 }}>
        Goes to your own address, through the real sending path, ignoring your
        notification preferences.
      </p>
    </div>
  )
}
