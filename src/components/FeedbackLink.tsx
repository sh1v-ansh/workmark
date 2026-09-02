'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Drawer from '@/components/ui/Drawer'
import Button from '@/components/ui/Button'
import { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { useSession } from '@/components/SessionProvider'
import { C, R } from '@/lib/theme/dark-tokens'

/**
 * Report a bug or ask for something.
 *
 * A link rather than a floating widget: this is used rarely, and a permanent
 * button in the corner of every page is noise the other 99% of the time.
 *
 * Opens the same Drawer the rest of the product uses, so reporting doesn't
 * throw away where you were — which matters, because where you were is the
 * thing being reported on.
 */
export default function FeedbackLink({ style }: { style?: React.CSSProperties }) {
  const pathname = usePathname()
  const { signedIn } = useSession()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'bug' | 'feature'>('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  // Nothing to file against without an account, and the insert policy is
  // scoped to the reporter anyway.
  if (!signedIn) return null

  async function send() {
    setBusy(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, title, body,
          // Captured rather than asked for — see the API route.
          pageUrl: typeof window !== 'undefined' ? window.location.href : pathname,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not send.')
      toast(json.message, 'success')
      setOpen(false); setTitle(''); setBody('')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not send.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none', border: 'none', padding: 0, font: 'inherit',
          fontSize: 13, color: C.textFaint, cursor: 'pointer', ...style,
        }}
      >
        Report a bug or suggest something
      </button>

      <Drawer
        open={open}
        onClose={() => { if (!busy) setOpen(false) }}
        title={kind === 'bug' ? 'Report a bug' : 'Suggest something'}
        subtitle="Goes straight to us."
        footer={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="accent" onClick={send} disabled={busy || !title.trim() || !body.trim()}
              busyLabel={busy ? 'Sending…' : null}>
              Send
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['bug', 'feature'] as const).map((k) => (
              <button
                key={k} type="button" onClick={() => setKind(k)}
                aria-pressed={kind === k}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: R.md, cursor: 'pointer', font: 'inherit',
                  fontSize: 14, fontWeight: 600,
                  background: kind === k ? C.accentHover : C.surface,
                  border: `1px solid ${kind === k ? C.accentBorder : C.border}`,
                  color: kind === k ? C.accentInk : C.textSub,
                }}
              >
                {k === 'bug' ? 'Something is broken' : 'I want something'}
              </button>
            ))}
          </div>

          <div>
            <Kicker style={{ marginBottom: 6 }}>In one line</Kicker>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="dk-input"
              placeholder={kind === 'bug' ? 'Scan button does nothing' : 'Let me filter by university'}
              aria-label="Summary"
            />
          </div>

          <div>
            <Kicker style={{ marginBottom: 6 }}>
              {kind === 'bug' ? 'What happened, and what you expected' : 'What would you do with it?'}
            </Kicker>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              rows={6} className="dk-textarea"
              style={{ fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.6 }}
              placeholder={kind === 'bug'
                ? 'I clicked Scan and the count stayed at 0. I expected it to start.'
                : 'I want to find people at my own university to work with.'}
            />
          </div>

          <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.55 }}>
            We&apos;ll also see the page you were on and which browser you&apos;re using. Nothing else.
          </p>
        </div>
      </Drawer>
    </>
  )
}
