'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { C, F } from '@/lib/theme/dark-tokens'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import type { VerifiedWorkRecord, Milestone, IssueFlag } from '@/lib/types'
import { complexityBand } from '@/lib/complexity'

interface Props {
  record: VerifiedWorkRecord
  milestones: Milestone[]
  flags: IssueFlag[]
  viewerRole: 'student' | 'poster'
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TierBadge({ tier }: { tier: 1 | 2 | null }) {
  if (tier == null) return null
  const label = tier === 1 ? 'Tier 1 · Employer Verified' : 'Tier 2 · Faculty Verified'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 10px', background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono, letterSpacing: '0.04em' }}>
      ✓ {label}
    </span>
  )
}

export default function RecordDetailClient({ record, milestones, flags, viewerRole }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [summary, setSummary] = useState(record.summary_final ?? record.summary_draft ?? '')
  const [savingSummary, setSavingSummary] = useState(false)
  const [approving, setApproving] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagText, setFlagText] = useState('')
  const [flagging, setFlagging] = useState(false)
  const [newMilestone, setNewMilestone] = useState({ title: '', due_date: '' })

  const locked = !!record.locked_at

  async function saveSummary() {
    if (!summary.trim()) return
    setSavingSummary(true)
    try {
      const res = await fetch('/api/records/summary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, summary }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed.')
      toast('Summary saved. Both parties must re-approve to lock the record.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Save failed.', 'error')
    } finally {
      setSavingSummary(false)
    }
  }

  async function approve() {
    setApproving(true)
    try {
      const res = await fetch('/api/records/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Approve failed.')
      toast(json.locked ? 'Record locked and mutually verified.' : 'Approved. Waiting for the poster to attest.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Approve failed.', 'error')
    } finally {
      setApproving(false)
    }
  }

  async function submitFlag() {
    if (!flagText.trim()) return
    setFlagging(true)
    try {
      const { error } = await supabase.from('issue_flags').insert({
        record_id: record.id,
        flagged_by_role: viewerRole,
        description: flagText.trim(),
      })
      if (error) throw error
      toast('Issue flagged. It is private to Workmark and will be surfaced at close-out.', 'info')
      setFlagOpen(false)
      setFlagText('')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Flag failed.', 'error')
    } finally {
      setFlagging(false)
    }
  }

  async function addMilestone() {
    if (!newMilestone.title.trim()) return
    try {
      const { error } = await supabase.from('milestones').insert({
        record_id: record.id,
        title: newMilestone.title.trim(),
        due_date: newMilestone.due_date || null,
        status: 'upcoming',
      })
      if (error) throw error
      setNewMilestone({ title: '', due_date: '' })
      toast('Milestone added.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed.', 'error')
    }
  }

  async function flipMilestone(m: Milestone, status: Milestone['status']) {
    try {
      const { error } = await supabase.from('milestones').update({ status }).eq('id', m.id)
      if (error) throw error
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error')
    }
  }

  const band = complexityBand(record.complexity_score)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role={viewerRole === 'student' ? 'student' : record.poster_type === 'company' ? 'company' : 'faculty'} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div>
          <Link href={viewerRole === 'student' ? '/student/dashboard' : record.poster_type === 'company' ? '/company/dashboard' : '/faculty/dashboard'}
            style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {record.project_title ?? 'Verified work record'}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <TierBadge tier={record.tier} />
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.textFaint }}>
              {record.poster_display_name} · {fmtDate(record.start_date)} → {fmtDate(record.end_date)}
            </span>
          </div>
        </div>

        {/* Structural facts (Layer 1) */}
        <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24 }}>
          <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Structural facts (auto-captured)
          </h2>
          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Fact label="Organization" value={record.poster_display_name ?? '—'} />
            <Fact label="Duration" value={`${fmtDate(record.start_date)} → ${fmtDate(record.end_date)}`} />
            <Fact label="Verification status" value={record.verification_status} />
            <Fact label="Complexity" value={band ? band.replace('-', ' ') : 'not yet scored'} />
          </div>
          {(record.skills_used?.length ?? 0) > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Skills used
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {record.skills_used!.map((s) => (
                  <span key={s} style={{ fontSize: 11, padding: '3px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: F.mono }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Co-written summary (Layer 2) */}
        <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Engagement summary
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {record.student_approved_at && (
                <span style={{ fontSize: 10, padding: '2px 8px', background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono, letterSpacing: '0.04em' }}>Student ✓</span>
              )}
              {record.poster_approved_at && (
                <span style={{ fontSize: 10, padding: '2px 8px', background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono, letterSpacing: '0.04em' }}>Poster ✓</span>
              )}
              {locked && (
                <span style={{ fontSize: 10, padding: '2px 8px', background: C.accent, color: '#FFFFFF', fontFamily: F.mono, letterSpacing: '0.04em', fontWeight: 500 }}>LOCKED</span>
              )}
            </div>
          </div>
          {locked ? (
            <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{record.summary_final ?? record.summary_draft}</p>
          ) : (
            <>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={5}
                className="dk-textarea"
                placeholder="Draft summary — either party can edit until both approve."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12 }}>
                <button onClick={saveSummary} disabled={savingSummary}
                  style={{ padding: '9px 18px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: savingSummary ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {savingSummary ? 'Saving…' : 'Save summary'}
                </button>
                {viewerRole === 'student' ? (
                  <button onClick={approve} disabled={approving}
                    style={{ padding: '9px 18px', background: C.accent, border: 'none', color: '#FFFFFF', fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: approving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {approving ? 'Approving…' : record.student_approved_at ? 'Approved ✓' : 'Approve summary'}
                  </button>
                ) : (
                  <Link href={`/records/${record.id}/attest`}
                    style={{ padding: '9px 18px', background: C.accent, color: '#FFFFFF', fontFamily: F.mono, fontSize: 12, fontWeight: 500, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Attest & approve →
                  </Link>
                )}
              </div>
            </>
          )}
        </section>

        {/* Attestation (Layer 2 part b) — read-only display of the 6Q answers */}
        {record.poster_approved_at && (
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24 }}>
            <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Employer attestation
            </h2>
            <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <Fact label="Deliverables completed" value={record.deliverables_status ?? '—'} />
              <Fact label="Would engage again" value={record.would_engage_again == null ? '—' : record.would_engage_again ? 'Yes' : 'No'} />
              <Fact label="Independence" value={record.independence_level?.replace(/_/g, ' ') ?? '—'} />
              <Fact label="Communication" value={record.communication_level?.replace(/_/g, ' ') ?? '—'} />
              <Fact label="Problem-solving" value={record.problem_solving_level?.replace(/_/g, ' ') ?? '—'} />
              <Fact label="Outcome" value={record.outcome ?? '—'} />
            </div>
          </section>
        )}

        {/* Milestones (Stage 3 safety net, spec §6.3) */}
        {!locked && (
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Milestones
              </h2>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.textGhost }}>Safety net, not surveillance</span>
            </div>
            {milestones.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {milestones.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '10px 14px' }}>
                    <div>
                      <p style={{ fontSize: 13, color: C.textSub, marginBottom: 2 }}>{m.title}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Due {fmtDate(m.due_date)} · {m.status.replace(/_/g, ' ')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {m.status !== 'on_track' && (
                        <button onClick={() => flipMilestone(m, 'on_track')} style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, cursor: 'pointer' }}>On track</button>
                      )}
                      {m.status !== 'issue_flagged' && (
                        <button onClick={() => flipMilestone(m, 'issue_flagged')} style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid rgba(248,113,113,0.35)', color: '#DC2626', fontFamily: F.mono, cursor: 'pointer' }}>Issue</button>
                      )}
                      {m.status !== 'completed' && (
                        <button onClick={() => flipMilestone(m, 'completed')} style={{ fontSize: 10, padding: '4px 8px', background: C.accent, border: 'none', color: '#FFFFFF', fontFamily: F.mono, cursor: 'pointer' }}>Done</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newMilestone.title} onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                placeholder="Milestone title (e.g. First draft delivered)" className="dk-input" />
              <input type="date" value={newMilestone.due_date} onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                className="dk-input" style={{ maxWidth: 160 }} />
              <button onClick={addMilestone} style={{ padding: '0 16px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: 'pointer' }}>Add</button>
            </div>
          </section>
        )}

        {/* Issue flags — private to record participants */}
        {!locked && (
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Issue flags</h2>
              <button onClick={() => setFlagOpen((v) => !v)} style={{ fontSize: 11, padding: '5px 10px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, cursor: 'pointer' }}>
                {flagOpen ? 'Cancel' : '+ Flag an issue'}
              </button>
            </div>
            {flagOpen && (
              <div style={{ marginBottom: 12 }}>
                <textarea value={flagText} onChange={(e) => setFlagText(e.target.value)} rows={3} className="dk-textarea" placeholder="Brief description. Visible only to Workmark and the other party." />
                <button onClick={submitFlag} disabled={flagging} style={{ marginTop: 8, padding: '8px 16px', background: C.accent, border: 'none', color: '#FFFFFF', fontFamily: F.mono, fontSize: 12, cursor: flagging ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {flagging ? 'Submitting…' : 'Submit flag'}
                </button>
              </div>
            )}
            {flags.length === 0 ? (
              <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>No flags. This section stays private to Workmark and record participants.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {flags.map((f) => (
                  <div key={f.id} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 12 }}>
                    <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: 4 }}>Flagged by {f.flagged_by_role} · {fmtDate(f.created_at)}</p>
                    <p style={{ fontSize: 13, color: C.textSub }}>{f.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, color: C.textSub }}>{value}</p>
    </div>
  )
}
