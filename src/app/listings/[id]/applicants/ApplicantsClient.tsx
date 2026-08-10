'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import type { FitTier } from '@/lib/matching/fit'
import { FitBadge } from '../../ListingsClient'
import MessageThread from './MessageThread'

export interface ApplicantRow {
  id: string
  studentId: string
  fullName: string
  university: string | null
  major: string | null
  graduationYear: number | null
  githubUsername: string | null
  status: string
  responseText: string | null
  fitTier: FitTier | null
  rankScore: number | null
  perSkill: { skillId: string; requiredLevel: number; depth: number; present: boolean }[]
  missingCount: number
  createdAt: string
  studentEmail: string | null
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  accepted: { color: '#15803D', bg: 'rgba(21,128,61,0.12)', border: 'rgba(21,128,61,0.35)' },
  shortlisted: { color: '#0369A1', bg: 'rgba(3,105,161,0.12)', border: 'rgba(3,105,161,0.35)' },
  rejected: { color: '#B91C1C', bg: 'rgba(185,28,28,0.12)', border: 'rgba(185,28,28,0.3)' },
  withdrawn: { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
  submitted: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
}

export default function ApplicantsClient({ listing, applicants, currentUserId, posterName }: {
  listing: { id: string; title: string | null; status: string }
  applicants: ApplicantRow[]
  currentUserId: string
  posterName: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  async function setStatus(applicationId: string, status: string) {
    setBusyId(applicationId)
    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update.')
      toast(json.warning ?? `Application ${status}.`, json.warning ? 'info' : 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not update.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function markFilled() {
    setClosing(true)
    const supabase = createClient()
    // Poster-scoped RLS update policy on listings covers this directly.
    const { error } = await supabase.from('listings').update({ status: 'filled' }).eq('id', listing.id)
    if (error) toast('Could not update the project.', 'error')
    else { toast('Project marked as filled.', 'success'); router.refresh() }
    setClosing(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={posterName ?? undefined} />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link href={`/listings/${listing.id}`} style={{ fontSize: 12, fontFamily: F.mono, color: C.textFaint, textDecoration: 'none' }}>
          ← Back to project
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Applicants ({applicants.length})
            </h1>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {listing.title ?? 'Untitled project'} — ranked by depth in the skills you asked for.
            </p>
          </div>
          {listing.status === 'open' && (
            <button onClick={markFilled} disabled={closing} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
              {closing ? 'Closing…' : 'Mark as filled'}
            </button>
          )}
        </div>

        {applicants.length === 0 ? (
          <Card hoverable={false} padding={32}>
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>No applications yet.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applicants.map((a, i) => {
              const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.submitted
              const expanded = expandedId === a.id
              return (
                <Card key={a.id} hoverable={false} padding={20}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>#{i + 1}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{a.fullName}</p>
                        <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                          {[a.major, a.university, a.graduationYear ? `'${String(a.graduationYear).slice(2)}` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {a.fitTier && <FitBadge tier={a.fitTier} missingCount={a.missingCount} />}
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: st.color, background: st.bg, border: `1px solid ${st.border}`, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {a.status}
                      </span>
                    </div>
                  </div>

                  {/* Per-skill evidence, exactly as disclosed at apply time */}
                  {a.perSkill.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {a.perSkill.map((s) => {
                        const c = tagColor(s.skillId)
                        return (
                          <span key={s.skillId} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 9px', borderRadius: 999,
                            fontFamily: F.mono,
                            background: s.present ? c.bg : 'transparent',
                            border: `1px solid ${s.present ? c.border : C.border}`,
                            color: s.present ? c.text : C.textFaint,
                            opacity: s.present ? 1 : 0.65,
                          }}>
                            {s.skillId}
                            <span style={{ opacity: 0.75 }}>{s.present ? s.depth.toFixed(1) : 'none'}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {a.responseText && (
                    <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                      {a.responseText}
                    </p>
                  )}

                  {a.status === 'accepted' && a.studentEmail && (
                    <div style={{ padding: '10px 14px', background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.25)', borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>
                        Contact: <a href={`mailto:${a.studentEmail}`} style={{ color: C.accent, textDecoration: 'none' }}>{a.studentEmail}</a>
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {a.status !== 'accepted' && a.status !== 'withdrawn' && (
                      <>
                        <button onClick={() => setStatus(a.id, 'accepted')} disabled={busyId === a.id} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                          <Icon name="check" size={12} /> Accept
                        </button>
                        {a.status !== 'shortlisted' && (
                          <button onClick={() => setStatus(a.id, 'shortlisted')} disabled={busyId === a.id} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                            <Icon name="star" size={12} /> Shortlist
                          </button>
                        )}
                        {a.status !== 'rejected' && (
                          <button onClick={() => setStatus(a.id, 'rejected')} disabled={busyId === a.id} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                            Decline
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                      className="wm-btn wm-btn-secondary wm-btn-sm"
                      style={{ display: 'inline-flex' }}
                    >
                      <Icon name="message" size={12} /> {expanded ? 'Hide messages' : 'Messages'}
                    </button>
                    {a.githubUsername && (
                      <a href={`https://github.com/${a.githubUsername}`} target="_blank" rel="noopener noreferrer" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                        <Icon name="github" size={12} /> GitHub
                      </a>
                    )}
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                      <MessageThread
                        applicationId={a.id}
                        currentUserId={currentUserId}
                        preAccept={a.status === 'submitted'}
                      />
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
