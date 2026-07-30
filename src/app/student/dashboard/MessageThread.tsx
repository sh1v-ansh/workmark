'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import type { ApplicationMessage } from '@/lib/types'

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * A small conversation thread on a pending (or accepted) application — lets
 * either side ask a clarifying question before committing. RLS already
 * scopes read/write to the two participants, so this talks to Supabase
 * directly rather than through an API route.
 */
export default function MessageThread({ applicationId, currentUserId, otherPartyLabel }: {
  applicationId: string
  currentUserId: string
  otherPartyLabel: string
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ApplicationMessage[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open || messages !== null) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('application_messages')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setMessages((data ?? []) as ApplicationMessage[])
        setLoading(false)
      })
  }, [open, messages, applicationId])

  async function handleSend() {
    const body = draft.trim()
    if (!body) return
    setSending(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('application_messages')
        .insert({ application_id: applicationId, sender_id: currentUserId, body })
        .select()
        .single()
      if (error) throw error
      setMessages((prev) => [...(prev ?? []), data as ApplicationMessage])
      setDraft('')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not send message.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10 }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 11, fontFamily: F.mono, color: C.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}>
        {open ? '▲ Hide messages' : `▼ Message ${otherPartyLabel}`}
      </button>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>Loading…</p>
          ) : messages && messages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {messages.map((m) => {
                const mine = m.sender_id === currentUserId
                return (
                  <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{ background: mine ? C.accentHover : C.bg, border: `1px solid ${mine ? C.accentBorder : C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                      <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                    </div>
                    <p style={{ fontSize: 10, color: C.textGhost, fontFamily: F.mono, marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                      {mine ? 'You' : otherPartyLabel} · {fmtTime(m.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>No messages yet — ask a question before deciding.</p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSend() }}
              placeholder="Write a message…"
              className="dk-input"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button onClick={handleSend} disabled={sending || !draft.trim()}
              style={{ padding: '0 16px', background: draft.trim() ? C.accent : C.surfaceAlt, color: draft.trim() ? '#FFFFFF' : C.textFaint, border: 'none', fontFamily: F.mono, fontSize: 12, cursor: draft.trim() ? 'pointer' : 'not-allowed' }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
