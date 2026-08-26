'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker, Stat } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { C, F, R } from '@/lib/theme/dark-tokens'
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
    /** The files this skill was found in, e.g. "docker-compose.yml, prisma/schema.prisma". */
    foundIn: string | null
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

// Deliberately plain. This is the one page in the app that earns its calm
// by being boring: no accent colour, no focal card, no personality — a
// document about your legal rights should read as sober.
function Section({ id, title, blurb, children }: { id: string; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 85, marginBottom: 35 }}>
      <Kicker style={{ marginBottom: 6 }}>{title}</Kicker>
      <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginBottom: 13.5, maxWidth: 540 }}>{blurb}</p>
      {children}
    </section>
  )
}

const INDEX = [
  { id: 'current', label: 'Current record' },
  { id: 'shared', label: 'Who has seen it' },
  { id: 'permissions', label: 'Permissions you gave' },
  { id: 'disputes', label: 'Disputes' },
]

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
  const openDisputes = data.disputes.filter((d) => !isResolved(d.status)).length
  const corrections = data.evidence.filter((e) => e.isCorrection).length

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={data.studentName ?? undefined} />

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        <Link href="/me" style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>← Your record</Link>

        <div style={{ margin: '13px 0 20px' }}>
          <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: C.text, marginBottom: 9 }}>
            Your file
          </h1>
          <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, maxWidth: 630 }}>
            Everything we hold about you, where each piece came from, and everyone we&apos;ve shared it with. If something here is wrong, dispute it — most are settled by rescanning the code within seconds.
          </p>
        </div>

        {/* Answers "is anything wrong with my file" before any reading. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 13, marginBottom: 30 }} className="mob-1col">
          <Card hoverable={false} padding={18}>
            <Stat value={data.disclosures.length} label={data.disclosures.length === 1 ? 'person has seen your record' : 'people have seen your record'} />
          </Card>
          <Card hoverable={false} padding={18}>
            <Stat value={openDisputes} label={openDisputes === 1 ? 'dispute currently open' : 'disputes currently open'} />
          </Card>
          <Card hoverable={false} padding={18}>
            <Stat value={corrections} label={corrections === 1 ? 'correction on your record' : 'corrections on your record'} />
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: 29, alignItems: 'start' }} className="mob-1col">

          <nav aria-label="Sections" className="mob-hide" style={{ position: 'sticky', top: 85, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {INDEX.map((item) => (
              <a key={item.id} href={`#${item.id}`} style={{ fontSize: 13.5, color: C.textMuted, textDecoration: 'none', padding: '7.5px 11.5px', borderRadius: R.sm }}>
                {item.label}
              </a>
            ))}
          </nav>

          <div style={{ maxWidth: 670 }}>

            {/* Current evidence, each disputable */}
            <Section id="current" title={`Current record · ${current.length}`} blurb="What your record says today. Each line came from a specific repository.">
              {current.length === 0 ? (
                <Card hoverable={false} padding={19.5}><p style={{ fontSize: 14, color: C.textFaint }}>Nothing on your record yet.</p></Card>
              ) : (
                <Card hoverable={false} padding="3.5px 18px 7px">
                  {current.map((e, i) => {
                    const c = tagColor(e.skillName)
                    const existing = disputesByEvidence.get(e.id)
                    return (
                      <div key={e.id} style={{ padding: '13.5px 0', borderBottom: i < current.length - 1 ? `1px solid ${C.borderFaint}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, padding: '3.5px 9.5px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                              {e.skillName}
                            </span>
                            <span style={{ fontSize: 13, color: C.textMuted }}>{LEVEL_NAMES[e.level] ?? e.level}</span>
                            {e.isCorrection && <Badge>corrected</Badge>}
                          </div>
                          {existing ? (
                            <span style={{ fontSize: 12, color: C.textGhost }}>{STATUS_LABEL[existing.status]}</span>
                          ) : (
                            <Button variant="quiet" size="sm" onClick={() => { setDisputingId(disputingId === e.id ? null : e.id); setDetail('') }}>
                              Dispute
                            </Button>
                          )}
                        </div>

                        <p style={{ fontSize: 12, color: C.textGhost, marginTop: 6.5 }}>
                          {[e.repoFullName, e.verificationMethod, e.source, new Date(e.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                        </p>

                        {/* The answer to "why does my record say this". Without
                            it the row asserts a skill and gives the student
                            nothing to check it against — which is also what a
                            dispute needs in order to be about anything. */}
                        {e.foundIn && (
                          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 4, lineHeight: 1.5 }}>
                            <span style={{ color: C.textGhost }}>Found in: </span>{e.foundIn}
                          </p>
                        )}

                        {existing?.resolutionNote && (
                          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8.5, lineHeight: 1.5, paddingTop: 8.5, borderTop: `1px solid ${C.borderFaint}` }}>
                            {existing.resolutionNote}
                          </p>
                        )}

                        {disputingId === e.id && (
                          <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${C.borderFaint}`, display: 'flex', flexDirection: 'column', gap: 9.5 }}>
                            <select value={category} onChange={(ev) => setCategory(ev.target.value as DisputeCategory)} className="dk-select" aria-label="What's wrong">
                              {DISPUTE_CATEGORIES.filter((cc) => cc.needsEvidence || cc.value === 'other').map((cc) => (
                                <option key={cc.value} value={cc.value}>{cc.label}</option>
                              ))}
                            </select>
                            <p style={{ fontSize: 12, color: C.textGhost, lineHeight: 1.5 }}>
                              {DISPUTE_CATEGORIES.find((cc) => cc.value === category)?.help}
                            </p>
                            <textarea
                              value={detail} onChange={(ev) => setDetail(ev.target.value)} rows={3}
                              className="dk-textarea" style={{ fontFamily: 'inherit', fontSize: 14 }}
                              placeholder="What's wrong with this?" aria-label="Dispute detail"
                            />
                            <div style={{ display: 'flex', gap: 9 }}>
                              <Button variant="ink" size="sm" onClick={() => fileDispute(e.id)} busyLabel={busy ? 'Filing…' : null}>File dispute</Button>
                              <Button variant="outline" size="sm" onClick={() => setDisputingId(null)} disabled={busy}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card>
              )}
            </Section>

            {/* Superseded / retracted history */}
            {history.length > 0 && (
              <Section id="history" title={`History · ${history.length}`} blurb="Values your record used to carry. Kept so you can see what changed and when — nothing is ever deleted.">
                <Card hoverable={false} padding="3.5px 18px 7px">
                  {history.map((e, i) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: i < history.length - 1 ? `1px solid ${C.borderFaint}` : 'none', flexWrap: 'wrap', opacity: 0.7 }}>
                      <span style={{ fontSize: 13, color: C.textMuted, textDecoration: 'line-through' }}>
                        {e.skillName} · {LEVEL_NAMES[e.level] ?? e.level}
                      </span>
                      <span style={{ fontSize: 12, color: C.textGhost }}>
                        {e.retracted ? 'retracted' : 'superseded'} · {new Date(e.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </Card>
              </Section>
            )}

            {/* Disclosures */}
            <Section id="shared" title={`Who has seen your record · ${data.disclosures.length}`} blurb="Every time your record was furnished to someone else, and exactly which values were sent.">
              {data.disclosures.length === 0 ? (
                <Card hoverable={false} padding={19.5}><p style={{ fontSize: 14, color: C.textFaint }}>Your record has never been shared with anyone.</p></Card>
              ) : (
                <Card hoverable={false} padding="3.5px 18px 7px">
                  {data.disclosures.map((d, i) => (
                    <div key={d.id} style={{ padding: '13.5px 0', borderBottom: i < data.disclosures.length - 1 ? `1px solid ${C.borderFaint}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>{d.recipientName}</p>
                          <p style={{ fontSize: 13, color: C.textGhost }}>
                            {new Date(d.disclosedAt).toLocaleString()} · {d.fieldsDisclosed.join(', ')}
                          </p>
                        </div>
                        <Button variant="quiet" size="sm" onClick={() => setExpandedDisclosure(expandedDisclosure === d.id ? null : d.id)}>
                          {expandedDisclosure === d.id ? 'Hide' : 'See exactly what was sent'}
                        </Button>
                      </div>
                      {expandedDisclosure === d.id && (
                        <pre style={{ marginTop: 11, padding: 13, background: C.bg, borderRadius: R.md, fontSize: 12, color: C.textMuted, overflowX: 'auto', lineHeight: 1.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                          {JSON.stringify(d.payloadSnapshot, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </Section>

            {/* Consents */}
            <Section id="permissions" title={`Permissions you gave · ${data.consents.length}`} blurb="Revoking stops a permission being used for anything new. It can't un-send what was already shared, and we won't pretend otherwise.">
              {data.consents.length === 0 ? (
                <Card hoverable={false} padding={19.5}><p style={{ fontSize: 14, color: C.textFaint }}>None yet.</p></Card>
              ) : (
                <Card hoverable={false} padding="3.5px 18px 7px">
                  {data.consents.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '12.5px 0', borderBottom: i < data.consents.length - 1 ? `1px solid ${C.borderFaint}` : 'none', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: 14, color: C.textSub }}>{c.scope}</p>
                        <p style={{ fontSize: 13, color: C.textGhost }}>
                          {c.textVersion} · granted {new Date(c.grantedAt).toLocaleDateString()}
                          {c.revokedAt ? ` · revoked ${new Date(c.revokedAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      {!c.revokedAt && (
                        <Button variant="quiet" size="sm" onClick={() => revokeConsent(c.id)} disabled={busy}>Revoke</Button>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </Section>

            {/* Disputes */}
            <Section id="disputes" title={`Disputes · ${data.disputes.length}`} blurb="We have 30 days to reinvestigate. Most are settled in seconds because your record is computed from code we can simply re-read.">
              {data.disputes.length === 0 ? (
                <Card hoverable={false} padding={19.5}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, color: C.textFaint }}>You haven&apos;t disputed anything.</p>
                    <Button variant="outline" size="sm" onClick={() => { setDisputingId('general'); setCategory('other'); setDetail('') }}>
                      Dispute something else
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card hoverable={false} padding="3.5px 18px 7px">
                  {data.disputes.map((d, i) => {
                    const days = daysRemaining(d.dueAt)
                    return (
                      <div key={d.id} style={{ padding: '13.5px 0', borderBottom: i < data.disputes.length - 1 ? `1px solid ${C.borderFaint}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                            {DISPUTE_CATEGORIES.find((cc) => cc.value === d.category)?.label ?? d.category}
                          </p>
                          <span style={{ fontSize: 12, color: isResolved(d.status) ? C.textGhost : C.accent, fontWeight: 600 }}>
                            {STATUS_LABEL[d.status]}
                          </span>
                        </div>
                        <p style={{ fontSize: 13.5, color: C.textMuted, marginTop: 5.5, lineHeight: 1.5 }}>{d.detail}</p>
                        <p style={{ fontSize: 12, color: days < 0 && !isResolved(d.status) ? '#B91C1C' : C.textGhost, marginTop: 9 }}>
                          Filed {new Date(d.filedAt).toLocaleDateString()}
                          {isResolved(d.status)
                            ? d.resolvedAt ? ` · resolved ${new Date(d.resolvedAt).toLocaleDateString()}` : ''
                            : days < 0 ? ` · overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}` : ` · ${days} day${days === 1 ? '' : 's'} left to reinvestigate`}
                        </p>
                        {d.resolutionNote && (
                          <p style={{ fontSize: 13, color: C.textSub, marginTop: 8.5, lineHeight: 1.5, paddingTop: 8.5, borderTop: `1px solid ${C.borderFaint}` }}>
                            {d.resolutionNote}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </Card>
              )}
            </Section>

            {/* General dispute form */}
            {disputingId === 'general' && (
              <Card hoverable={false} padding={21}>
                <Kicker style={{ marginBottom: 11 }}>File a dispute</Kicker>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={category} onChange={(e) => setCategory(e.target.value as DisputeCategory)} className="dk-select" aria-label="What's wrong">
                    {DISPUTE_CATEGORIES.filter((c) => !c.needsEvidence).map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: C.textGhost, lineHeight: 1.5 }}>
                    {DISPUTE_CATEGORIES.find((c) => c.value === category)?.help}
                  </p>
                  <textarea
                    value={detail} onChange={(e) => setDetail(e.target.value)} rows={4}
                    className="dk-textarea" style={{ fontFamily: 'inherit', fontSize: 14 }}
                    placeholder="Describe the problem." aria-label="Dispute detail"
                  />
                  <div style={{ display: 'flex', gap: 9 }}>
                    <Button variant="ink" size="sm" onClick={() => fileDispute(null)} busyLabel={busy ? 'Filing…' : null}>File dispute</Button>
                    <Button variant="outline" size="sm" onClick={() => setDisputingId(null)} disabled={busy}>Cancel</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
