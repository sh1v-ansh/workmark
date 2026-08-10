'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'

const MAX_CHARS = 500
const PRE_ACCEPT_LIMIT = 3

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
}

/**
 * Pre-accept Q&A, capped so it can't become the overwhelm the product
 * exists to eliminate: 500 chars per message (a table CHECK), and 3
 * messages per side until the application is accepted (an RLS policy).
 *
 * Both caps are enforced in the database, not here — this component only
 * mirrors them in the UI so the limit is visible before someone types
 * into a message that will be rejected.
 */
export default function MessageThread({ applicationId, currentUserId, preAccept }: {
  applicationId: string
  currentUserId: string
  preAccept: boolean
}) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('application_messages')
      .select('id, sender_id, body, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
    if (error) console.error('[MessageThread] load failed:', error)
    setMessages(data ?? [])
    setLoading(false)
  }, [applicationId])

  useEffect(() => { load() }, [load])

  const sentByMe = messages.filter((m) => m.sender_id === currentUserId).length
  const remaining = PRE_ACCEPT_LIMIT - sentByMe
  const capped = preAccept && remaining <= 0

  async function send() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('application_messages')
      .insert({ application_id: applicationId, sender_id: currentUserId, body: trimmed })
    if (error) {
      // The RLS message cap surfaces as a policy violation, not a friendly
      // error — translate it rather than showing raw Postgres text.
      toast(
        error.code === '42501'
          ? `You've used all ${PRE_ACCEPT_LIMIT} messages before acceptance.`
          : 'Could not send the message.',
        'error',
      )
    } else {
      setBody('')
      await load()
    }
    setSending(false)
  }

  if (loading) {
    return <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>Loading messages…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {messages.length === 0 ? (
        <p style={{ fontSize: 12, color: C.textFaint }}>No messages yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
          {messages.map((m) => {
            const mine = m.sender_id === currentUserId
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: mine ? C.accentHover : C.surfaceAlt,
                  border: `1px solid ${mine ? C.accentBorder : C.border}`,
                }}
              >
                <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                <p style={{ fontSize: 10, color: C.textFaint, fontFamily: F.mono, marginTop: 4 }}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {capped ? (
        <p style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5 }}>
          You&apos;ve used all {PRE_ACCEPT_LIMIT} pre-acceptance messages. Messaging opens up fully once the application is accepted.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_CHARS))}
            rows={2}
            className="dk-input"
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
            placeholder="Ask a clarifying question…"
            aria-label="Message"
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: C.textFaint, fontFamily: F.mono }}>
              {body.length}/{MAX_CHARS}
              {preAccept && ` · ${remaining} message${remaining === 1 ? '' : 's'} left before acceptance`}
            </span>
            <button onClick={send} disabled={sending || !body.trim()} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
