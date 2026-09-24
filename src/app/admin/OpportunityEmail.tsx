'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { C } from '@/lib/theme/dark-tokens'

/**
 * Compose and send an opportunity email. "Send test to me" first, always;
 * the send-to-everyone button asks for confirmation with the count.
 */
export default function OpportunityEmail({ optedIn }: { optedIn: number }) {
  const { toast } = useToast()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [busy, setBusy] = useState<'test' | 'all' | null>(null)

  async function send(mode: 'test' | 'all') {
    if (mode === 'all' && !confirm(`Send this to ${optedIn} opted-in student${optedIn === 1 ? '' : 's'}?`)) return
    setBusy(mode)
    try {
      const res = await fetch('/api/admin/opportunity-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, subject, body, linkUrl, linkLabel }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not send.')
      toast(mode === 'test' ? 'Test sent to you. Check your inbox.' : `Sent ${json.sent} of ${json.total}${json.failed ? `, ${json.failed} failed` : ''}.`, 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not send.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6 }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 13, color: C.textMuted }}>
        Goes only to students who opted in ({optedIn} right now). Every email carries your mailing address and a one-click unsubscribe.
      </p>
      <div>
        <label htmlFor="opp-subject" style={label}>Subject</label>
        <input id="opp-subject" className="dk-input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="3 hackathons this month that fit your skills" />
      </div>
      <div>
        <label htmlFor="opp-body" style={label}>Message</label>
        <textarea id="opp-body" className="dk-textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: 'inherit', fontSize: 14 }} />
      </div>
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div>
          <label htmlFor="opp-link" style={label}>Link (optional)</label>
          <input id="opp-link" className="dk-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/listings or https://…" />
        </div>
        <div>
          <label htmlFor="opp-link-label" style={label}>Button text</label>
          <input id="opp-link-label" className="dk-input" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="See it on Workmark" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={() => send('test')} busyLabel={busy === 'test' ? 'Sending…' : null}>Send test to me</Button>
        <Button variant="accent" size="sm" onClick={() => send('all')} disabled={optedIn === 0 || !!busy} busyLabel={busy === 'all' ? 'Sending…' : null}>Send to everyone opted in</Button>
      </div>
    </div>
  )
}
