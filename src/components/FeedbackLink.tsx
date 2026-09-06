'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Drawer from '@/components/ui/Drawer'
import Button from '@/components/ui/Button'
import { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { useSession } from '@/components/SessionProvider'
import { C, R } from '@/lib/theme/dark-tokens'

type Kind = 'bug' | 'feature'

/**
 * Report a bug, or ask for something.
 *
 * These are two different acts and used to be one button. "Report a bug or
 * suggest something" opened a drawer that then asked which — so telling us
 * what you wish existed was reachable only by first agreeing to file a
 * report, and the invitation was hidden behind the word "bug". Almost
 * nobody makes it through a door labelled with someone else's problem.
 *
 * They are two entry points now with two different tones. Reporting is
 * businesslike, because the person doing it is annoyed and wants it over.
 * Suggesting is warm, because that person is doing us a favour and has no
 * reason to bother.
 *
 * Still a link rather than a floating widget: used rarely, and a permanent
 * button in the corner of every page is noise the other 99% of the time.
 * Opens a Drawer rather than navigating, because where you were is often
 * the thing being reported on.
 */
const COPY: Record<Kind, {
  trigger: string
  title: string
  subtitle: string
  titleLabel: string
  titlePlaceholder: string
  bodyLabel: string
  bodyPlaceholder: string
  send: string
}> = {
  bug: {
    trigger: 'Report a bug',
    title: 'Report a bug',
    subtitle: 'Goes straight to us, and we read every one.',
    titleLabel: 'In one line',
    titlePlaceholder: 'Scan button does nothing',
    bodyLabel: 'What happened, and what you expected',
    bodyPlaceholder: 'I clicked Scan and the count stayed at 0. I expected it to start.',
    send: 'Send report',
  },
  feature: {
    trigger: 'Suggest something',
    title: 'What should Workmark do?',
    subtitle: 'Workmark is early, and a good part of what is in it exists because someone asked. Half an idea is fine — we would rather have it than not.',
    titleLabel: 'The idea, in one line',
    titlePlaceholder: 'Let me filter students by university',
    bodyLabel: 'What would you do with it?',
    bodyPlaceholder: 'I want to find people at my own university to work with, so we can meet in person.',
    send: 'Send it',
  },
}

export default function FeedbackLink({
  kind: fixedKind,
  style,
}: {
  /** Opens straight into this kind and hides the picker. */
  kind?: Kind
  style?: React.CSSProperties
}) {
  const pathname = usePathname()
  const { signedIn } = useSession()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [pickedKind, setPickedKind] = useState<Kind>('bug')
  const kind = fixedKind ?? pickedKind
  const copy = COPY[kind]
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
        {copy.trigger}
      </button>

      <Drawer
        open={open}
        onClose={() => { if (!busy) setOpen(false) }}
        title={copy.title}
        subtitle={copy.subtitle}
        footer={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="accent" onClick={send} disabled={busy || !title.trim() || !body.trim()}
              busyLabel={busy ? 'Sending…' : null}>
              {copy.send}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Only when nobody has already said which. Both navbar entries
              pass a kind, so in practice this is the fallback for a caller
              that has not decided. */}
          {!fixedKind && (
            <div style={{ display: 'flex', gap: 7 }}>
              {(['bug', 'feature'] as const).map((k) => (
                <button
                  key={k} type="button" onClick={() => setPickedKind(k)}
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
          )}

          <div>
            <Kicker style={{ marginBottom: 6 }}>{copy.titleLabel}</Kicker>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="dk-input"
              placeholder={copy.titlePlaceholder}
              aria-label="Summary"
            />
          </div>

          <div>
            <Kicker style={{ marginBottom: 6 }}>{copy.bodyLabel}</Kicker>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              rows={6} className="dk-textarea"
              style={{ fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.6 }}
              placeholder={copy.bodyPlaceholder}
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
