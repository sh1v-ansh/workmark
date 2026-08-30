'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { FIT_TIER_TONE } from '@/lib/theme/fitTier'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'
import MessageThread from './MessageThread'
import { LAYOUT } from '@/lib/theme/layout'

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
  claimedSkills: string[]
  confidence: number | null
  missingCount: number
  createdAt: string
  studentEmail: string | null
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  accepted:    { label: 'Accepted',    tone: 'positive' },
  shortlisted: { label: 'Shortlisted', tone: 'info' },
  rejected:    { label: 'Declined',    tone: 'neutral' },
  withdrawn:   { label: 'Withdrawn',   tone: 'neutral' },
  submitted:   { label: 'New',         tone: 'neutral' },
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function relativeDays(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** One of the three numbers that carry the whole comparison. */
function Metric({ value, caption, tone }: { value: React.ReactNode; caption: string; tone?: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: R.md, padding: '13.5px 15.5px' }}>
      <div style={{ fontFamily: F.display, fontSize: 23, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: tone ?? C.text }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: C.textFaint, marginTop: 4 }}>{caption}</div>
    </div>
  )
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
  const [closing, setClosing] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(applicants[0]?.id ?? null)

  const selected = applicants.find((a) => a.id === selectedId) ?? applicants[0] ?? null
  const selectedIndex = selected ? applicants.findIndex((a) => a.id === selected.id) : -1

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

  const evidencedCount = selected ? selected.perSkill.filter((s) => s.present).length : 0

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        <Link href={`/listings/${listing.id}`} style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>
          ← {listing.title ?? 'Untitled project'}
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, margin: '13px 0 20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: C.text }}>
              {applicants.length === 0 ? 'No applicants yet' : `${applicants.length} applicant${applicants.length === 1 ? '' : 's'}`}
            </h1>
            {applicants.length > 0 && (
              <p style={{ fontSize: 15, color: C.textMuted, marginTop: 5.5 }}>
                Ordered by how much of what you asked for their code actually shows.
              </p>
            )}
          </div>
          {listing.status === 'open' && (
            <Button variant="outline" size="sm" onClick={markFilled} busyLabel={closing ? 'Closing…' : null}>
              Mark as filled
            </Button>
          )}
        </div>

        {applicants.length === 0 || !selected ? (
          <Card hoverable={false} padding={36}>
            <p style={{ fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
              Nobody has applied yet. Students see this project in Find work, ranked by how much of it their record already covers.
            </p>
          </Card>
        ) : (
          // Master / detail. The list stays put while the detail swaps, so
          // comparing two people is a click rather than a scroll and a
          // memory test. This is the one shape where a second column is
          // unambiguous: one side is what you pick from, the other is what
          // you picked.
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 330px) minmax(0, 1fr)', gap: 22, alignItems: 'start' }} className="mob-1col">

            <Card hoverable={false} padding={8}>
              {applicants.map((a) => {
                const on = a.id === selected.id
                const st = STATUS[a.status] ?? STATUS.submitted
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedId(a.id); setShowMessages(false) }}
                    aria-current={on ? 'true' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                      padding: '13px 14px', borderRadius: R.md, cursor: 'pointer', font: 'inherit',
                      background: on ? '#EDE9FF' : 'transparent',
                      border: `1px solid ${on ? '#D9D0F5' : 'transparent'}`,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{
                      width: 32, height: 32, borderRadius: R.md, flexShrink: 0,
                      background: on ? C.surface : C.surfaceAlt, color: C.textSub,
                      fontFamily: F.display, fontSize: 11.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {initials(a.fullName)}
                    </span>
                    <span style={{ flexGrow: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.fullName}
                      </span>
                      <span style={{ display: 'block', fontSize: 13, color: C.textGhost, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[a.major, a.university].filter(Boolean).join(' · ') || 'No details given'}
                      </span>
                    </span>
                    {a.status !== 'submitted' && <Badge tone={st.tone}>{st.label}</Badge>}
                  </button>
                )
              })}
            </Card>

            <Card hoverable={false} padding={23}>
              {/* Head */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 19, paddingBottom: 18, borderBottom: `1px solid ${C.borderFaint}`, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontFamily: F.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: C.text, marginBottom: 4.5 }}>
                    {selected.fullName}
                  </h2>
                  <p style={{ fontSize: 14, color: C.textMuted }}>
                    {[
                      [selected.major, selected.university].filter(Boolean).join(' · ') || null,
                      selected.graduationYear ? `graduating ${selected.graduationYear}` : null,
                      `applied ${relativeDays(selected.createdAt)}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {selected.status !== 'accepted' && selected.status !== 'withdrawn' && (
                    <>
                      {selected.status !== 'rejected' && (
                        <Button variant="quiet" size="sm" onClick={() => setStatus(selected.id, 'rejected')} disabled={busyId === selected.id}>
                          Decline
                        </Button>
                      )}
                      {selected.status !== 'shortlisted' && (
                        <Button variant="outline" size="sm" onClick={() => setStatus(selected.id, 'shortlisted')} disabled={busyId === selected.id}>
                          Shortlist
                        </Button>
                      )}
                      <Button variant="ink" size="sm" onClick={() => setStatus(selected.id, 'accepted')} disabled={busyId === selected.id}>
                        Accept
                      </Button>
                    </>
                  )}
                  {selected.status === 'accepted' && <Badge tone="positive">Accepted</Badge>}
                </div>
              </div>

              {/* The three numbers that are the whole pitch of the product */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 13, marginBottom: 22 }} className="mob-1col">
                <Metric
                  value={`${evidencedCount}/${selected.perSkill.length}`}
                  caption="of your skills their code shows"
                />
                <Metric
                  value={selected.confidence === null ? '—' : `${Math.round(selected.confidence * 100)}%`}
                  caption="backed by a project we watched run"
                />
                <Metric
                  value={`#${selectedIndex + 1}`}
                  caption={`of ${applicants.length} by evidence`}
                />
              </div>

              {selected.fitTier && (
                <div style={{ marginBottom: 22 }}>
                  <Badge tone={FIT_TIER_TONE[selected.fitTier]}>{FIT_TIER_LABEL[selected.fitTier]}</Badge>
                  {selected.missingCount > 0 && (
                    <span style={{ fontSize: 13, color: C.textGhost, marginLeft: 9.5 }}>
                      no evidence in {selected.missingCount} skill{selected.missingCount === 1 ? '' : 's'} you asked for
                    </span>
                  )}
                </div>
              )}

              {/* Per-skill evidence, exactly as disclosed at apply time. A
                  claimed skill with no evidence is shown as claimed rather
                  than hidden — the applicant said it, and you are entitled
                  to weigh that yourself. */}
              {selected.perSkill.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <Kicker style={{ marginBottom: 10 }}>What their code shows</Kicker>
                  <div>
                    {selected.perSkill.map((s, i) => {
                      const claimedOnly = !s.present && selected.claimedSkills.includes(s.skillId)
                      return (
                        <div
                          key={s.skillId}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 13,
                            padding: '11px 0',
                            borderBottom: i < selected.perSkill.length - 1 ? `1px solid ${C.borderFaint}` : 'none',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10.5, minWidth: 0 }}>
                            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                              <circle cx="10" cy="10" r="9" fill={s.present ? state.positiveBg : state.cautionBg} />
                              {s.present ? (
                                <path d="M6 10.2l2.6 2.6L14 7.4" stroke={state.positive} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                              ) : (
                                <path d="M10 5.6v5.2M10 13.8v.6" stroke={state.caution} strokeWidth="1.9" strokeLinecap="round" />
                              )}
                            </svg>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>{s.skillId}</span>
                              <span style={{ display: 'block', fontSize: 13, color: s.present ? state.positive : state.caution }}>
                                {s.present
                                  ? `evidenced · depth ${s.depth.toFixed(1)}`
                                  : claimedOnly
                                    ? 'they claimed it, nothing in their record backs it'
                                    : 'no evidence, and they did not claim it'}
                              </span>
                            </span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.textGhost, whiteSpace: 'nowrap' }}>
                            {s.requiredLevel >= 4 ? 'Essential' : s.requiredLevel >= 2 ? 'Useful' : 'Bonus'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {selected.responseText && (
                <div style={{ marginBottom: 22 }}>
                  <Kicker style={{ marginBottom: 10 }}>In their words</Kicker>
                  <div style={{ background: C.bg, borderRadius: R.md, padding: '16.5px 18.5px', fontSize: 15, lineHeight: 1.65, color: C.textSub, whiteSpace: 'pre-wrap' }}>
                    {selected.responseText}
                  </div>
                </div>
              )}

              {selected.status === 'accepted' && selected.studentEmail && (
                <div style={{ background: state.positiveBg, borderRadius: R.md, padding: '13px 16.5px', marginBottom: 20 }}>
                  <p style={{ fontSize: 14, color: '#0E4F2E' }}>
                    Contact:{' '}
                    <a href={`mailto:${selected.studentEmail}`} style={{ color: state.positive, fontWeight: 600, textDecoration: 'underline' }}>
                      {selected.studentEmail}
                    </a>
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button variant="outline" size="sm" onClick={() => setShowMessages((v) => !v)}>
                  {showMessages ? 'Hide messages' : 'Messages'}
                </Button>
                {selected.githubUsername && (
                  <a
                    href={`https://github.com/${selected.githubUsername}`}
                    target="_blank" rel="noopener noreferrer"
                    className="nb-btn nb-btn-outline nb-btn-sm"
                  >
                    <Icon name="github" size={13} /> {selected.githubUsername}
                  </a>
                )}
              </div>

              {showMessages && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.borderFaint}` }}>
                  <MessageThread
                    applicationId={selected.id}
                    currentUserId={currentUserId}
                    preAccept={selected.status === 'submitted'}
                  />
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
