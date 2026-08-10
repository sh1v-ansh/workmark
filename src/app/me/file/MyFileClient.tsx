'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import {
  DISPUTE_CATEGORIES, STATUS_LABEL, isResolved, daysRemaining,
  type DisputeCategory, type DisputeStatus,
} from '@/lib/fcra/disputes'

export interface FileData {
  studentName: string | null
  evidence: {
    id: string
    skillId: string
    skillName: string
    level: number
    base: number
    tierWeight: number | null
    verificationMethod: string
    repoFullName: string | null
    tier: string | null
    source: string | null
    createdAt: string
    supersededByCorrection: boolean
    isCorrection: boolean
    retracted: boolean
  }[]
  disclosures: {
    id: string
    recipientName: string
    fieldsDisclosed: string[]
    payloadSnapshot: unknown
    disclosedAt: string
  }[]
  consents: { id: string; scope: string; textVersion: string; grantedAt: string; revokedAt: string | null }[]
  disputes: {
    id: string
    evidenceId: string | null
    category: DisputeCategory
    detail: string
    status: DisputeStatus
    filedAt: string
    dueAt: string
    resolvedAt: string | null
    resolutionNote: string | null
  }[]
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Familiar', 2: 'Practiced', 3: 'Strong', 4: 'Advanced', 5: 'Expert' }

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>{blurb}</p>
      {children}
    </section>
  )
}

export default function MyFileClient({ data }: { data: FileData }) {
  const router = useRouter()
  const { toast } = useToast()
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const [category, setCategory] = useState<DisputeCategory>('inaccurate_level')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedDisclosure, setExpandedDisclosure] = useState<string | null>(null)

  const disputesByEvidence = new Map<string, FileData['disputes'][number]>()
  for (const d of data.disputes) if (d.evidenceId) disputesByEvidence.set(d.evidenceId, d)

  async function fileDispute(evidenceId: string | null) {
    if (!detail.trim()) {
      toast('Describe the problem so we know what to check.', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, detail, evidenceId: evidenceId ?? undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not file.')
      toast(json.message ?? 'Dispute filed.', 'success')
      setDisputingId(null)
      setDetail('')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revokeConsent(consentId: string) {
    if (!confirm('Revoke this consent? Anything already shared stays shared — this stops it being used for anything new.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/consents/${consentId}/revoke`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not revoke.')
      toast('Consent revoked.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not revoke.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const current = data.evidence.filter((e) => !e.supersededByCorrection && !e.retracted)
  const history = data.evidence.filter((e) => e.supersededByCorrection || e.retracted)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={data.studentName ?? undefined} />

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <Link href="/me" style={{ fontSize: 12, fontFamily: F.mono, color: C.textFaint, textDecoration: 'none' }}>
            ← Your record
          </Link>
          <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, margin: '12px 0 6px', letterSpacing: '-0.02em' }}>
            Your file
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            Everything we hold about you, where each piece came from, and everyone we&apos;ve shared it with. If something here is wrong, dispute it — most disputes are settled by rescanning the code within seconds.
          </p>
        </div>

        {/* Current evidence, each disputable */}
        <Section
          title={`Current record (${current.length})`}
          blurb="What your record says today. Each line came from a specific repository."
        >
          {current.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 13, color: C.textFaint }}>Nothing on your record yet.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {current.map((e) => {
                const c = tagColor(e.skillName)
                const existing = disputesByEvidence.get(e.id)
                return (
                  <Card key={e.id} hoverable={false} padding={16}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                          {e.skillName}
                        </span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{LEVEL_NAMES[e.level] ?? e.level}</span>
                        {e.isCorrection && (
                          <span style={{ fontSize: 10, color: C.textFaint, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>corrected</span>
                        )}
                      </div>
                      {existing ? (
                        <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>{STATUS_LABEL[existing.status]}</span>
                      ) : (
                        <button onClick={() => { setDisputingId(disputingId === e.id ? null : e.id); setDetail('') }} style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, background: 'none', border: `1px solid ${C.border}`, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                          Dispute
                        </button>
                      )}
                    </div>

                    <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 8 }}>
                      {[e.repoFullName, e.verificationMethod, e.source, new Date(e.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                    </p>

                    {existing?.resolutionNote && (
                      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 1.5, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        {existing.resolutionNote}
                      </p>
                    )}

                    {disputingId === e.id && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <select value={category} onChange={(ev) => setCategory(ev.target.value as DisputeCategory)} className="dk-select" aria-label="What's wrong">
                          {DISPUTE_CATEGORIES.filter((c) => c.needsEvidence || c.value === 'other').map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.5 }}>
                          {DISPUTE_CATEGORIES.find((c) => c.value === category)?.help}
                        </p>
                        <textarea
                          value={detail} onChange={(ev) => setDetail(ev.target.value)} rows={3}
                          className="dk-input" style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                          placeholder="What's wrong with this?" aria-label="Dispute detail"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => fileDispute(e.id)} disabled={busy} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                            {busy ? 'Filing…' : 'File dispute'}
                          </button>
                          <button onClick={() => setDisputingId(null)} disabled={busy} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </Section>

        {/* Superseded / retracted history */}
        {history.length > 0 && (
          <Section
            title={`History (${history.length})`}
            blurb="Values your record used to carry. Kept so you can see what changed and when — nothing is ever deleted."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, flexWrap: 'wrap', opacity: 0.75 }}>
                  <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.mono, textDecoration: 'line-through' }}>
                    {e.skillName} · {LEVEL_NAMES[e.level] ?? e.level}
                  </span>
                  <span style={{ fontSize: 10, color: C.textFaint, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {e.retracted ? 'retracted' : 'superseded'} · {new Date(e.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Disclosures */}
        <Section
          title={`Shared with (${data.disclosures.length})`}
          blurb="Every time your record was furnished to someone else, and exactly which values were sent."
        >
          {data.disclosures.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 13, color: C.textFaint }}>Your record has never been shared with anyone.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.disclosures.map((d) => (
                <Card key={d.id} hoverable={false} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.recipientName}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {new Date(d.disclosedAt).toLocaleString()} · {d.fieldsDisclosed.join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedDisclosure(expandedDisclosure === d.id ? null : d.id)}
                      style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, background: 'none', border: `1px solid ${C.border}`, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}
                    >
                      {expandedDisclosure === d.id ? 'Hide' : 'See exactly what was sent'}
                    </button>
                  </div>
                  {expandedDisclosure === d.id && (
                    <pre style={{ marginTop: 12, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.textMuted, fontFamily: F.mono, overflowX: 'auto', lineHeight: 1.5 }}>
                      {JSON.stringify(d.payloadSnapshot, null, 2)}
                    </pre>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* Consents */}
        <Section
          title={`Permissions you gave (${data.consents.length})`}
          blurb="Revoking stops a permission being used for anything new. It can't un-send what was already shared, and we won't pretend otherwise."
        >
          {data.consents.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 13, color: C.textFaint }}>None yet.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.consents.map((c) => (
                <Card key={c.id} hoverable={false} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.mono }}>{c.scope}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {c.textVersion} · granted {new Date(c.grantedAt).toLocaleDateString()}
                        {c.revokedAt ? ` · revoked ${new Date(c.revokedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    {!c.revokedAt && (
                      <button onClick={() => revokeConsent(c.id)} disabled={busy} style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, background: 'none', border: `1px solid ${C.border}`, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                        Revoke
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* Disputes */}
        <Section
          title={`Disputes (${data.disputes.length})`}
          blurb="We have 30 days to reinvestigate. Most are settled in seconds because your record is computed from code we can simply re-read."
        >
          {data.disputes.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 13, color: C.textFaint }}>You haven&apos;t disputed anything.</p>
                <button onClick={() => { setDisputingId('general'); setCategory('other'); setDetail('') }} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  <Icon name="edit" size={12} /> Dispute something else
                </button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.disputes.map((d) => {
                const days = daysRemaining(d.dueAt)
                return (
                  <Card key={d.id} hoverable={false} padding={16}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        {DISPUTE_CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}
                      </p>
                      <span style={{ fontSize: 11, color: isResolved(d.status) ? C.textFaint : C.accent, fontFamily: F.mono }}>
                        {STATUS_LABEL[d.status]}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>{d.detail}</p>
                    <p style={{ fontSize: 11, color: days < 0 && !isResolved(d.status) ? '#B91C1C' : C.textFaint, fontFamily: F.mono, marginTop: 8 }}>
                      Filed {new Date(d.filedAt).toLocaleDateString()}
                      {isResolved(d.status)
                        ? d.resolvedAt ? ` · resolved ${new Date(d.resolvedAt).toLocaleDateString()}` : ''
                        : days < 0 ? ` · overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}` : ` · ${days} day${days === 1 ? '' : 's'} left to reinvestigate`}
                    </p>
                    {d.resolutionNote && (
                      <p style={{ fontSize: 12, color: C.textSub, marginTop: 8, lineHeight: 1.5, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        {d.resolutionNote}
                      </p>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </Section>

        {/* General dispute form */}
        {disputingId === 'general' && (
          <Card hoverable={false} padding={20}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>File a dispute</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={category} onChange={(e) => setCategory(e.target.value as DisputeCategory)} className="dk-select" aria-label="What's wrong">
                {DISPUTE_CATEGORIES.filter((c) => !c.needsEvidence).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.5 }}>
                {DISPUTE_CATEGORIES.find((c) => c.value === category)?.help}
              </p>
              <textarea
                value={detail} onChange={(e) => setDetail(e.target.value)} rows={4}
                className="dk-input" style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                placeholder="Describe the problem." aria-label="Dispute detail"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => fileDispute(null)} disabled={busy} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  {busy ? 'Filing…' : 'File dispute'}
                </button>
                <button onClick={() => setDisputingId(null)} disabled={busy} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
