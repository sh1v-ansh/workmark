'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { C, F } from '@/lib/theme/dark-tokens'
import { useToast } from '@/components/Toast'
import { LogoMark } from '@/app/landing/LogoMark'
import type { VerifiedWorkRecord } from '@/lib/types'

interface Props {
  record: VerifiedWorkRecord
}

type Deliverables = 'yes' | 'partial' | 'no'
type Independence = 'independent' | 'some_guidance' | 'frequent_checkins'
type Communication = 'proactive' | 'responsive' | 'needed_followup'
type ProblemSolving = 'proposed_solutions' | 'described_problems' | 'got_stuck'
type Outcome = 'completed' | 'partial' | 'terminated'

export default function AttestClient({ record }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [techs, setTechs] = useState<string[]>(record.technologies_used ?? record.skills_used ?? [])
  const [newTech, setNewTech] = useState('')
  const [deliverables, setDeliverables] = useState<Deliverables | ''>(record.deliverables_status ?? '')
  const [wouldEngage, setWouldEngage] = useState<boolean | null>(record.would_engage_again)
  const [independence, setIndependence] = useState<Independence | ''>(record.independence_level ?? '')
  const [communication, setCommunication] = useState<Communication | ''>(record.communication_level ?? '')
  const [problemSolving, setProblemSolving] = useState<ProblemSolving | ''>(record.problem_solving_level ?? '')
  const [outcome, setOutcome] = useState<Outcome | ''>((record.outcome as Outcome) ?? '')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = !!deliverables && wouldEngage !== null && !!independence && !!communication && !!problemSolving && !!outcome

  function addTech() {
    const t = newTech.trim()
    if (t && !techs.includes(t)) setTechs([...techs, t])
    setNewTech('')
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/records/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          technologies_used: techs,
          deliverables_status: deliverables,
          would_engage_again: wouldEngage,
          independence_level: independence,
          communication_level: communication,
          problem_solving_level: problemSolving,
          outcome,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submit failed.')
      toast(json.locked ? 'Attestation complete. Record locked as mutually verified.' : 'Attestation saved. Waiting for the student to approve the summary.', 'success')
      router.push(`/records/${record.id}`)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Submit failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Link href={`/records/${record.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
        <LogoMark size={22} />
        <span style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>workmark</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 620 }}>
        <p style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
          Six-question attestation · under 2 minutes
        </p>
        <h1 style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Attest to this engagement
        </h1>
        <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
          You are confirming what happened on <strong style={{ color: C.text }}>{record.project_title ?? 'this project'}</strong>. Every response is a factual confirmation, not a review.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Question label="1. Technologies used">
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={newTech} onChange={(e) => setNewTech(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTech() } }}
                placeholder="Add a technology (Enter)"
                className="dk-input" />
              <button type="button" onClick={addTech} style={{ padding: '0 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 11, cursor: 'pointer' }}>Add</button>
            </div>
            {techs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {techs.map((t) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSub, fontFamily: F.mono }}>
                    {t}
                    <button type="button" onClick={() => setTechs(techs.filter((x) => x !== t))} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </Question>

          <Question label="2. Deliverables completed">
            <Radios<Deliverables> name="deliverables" value={deliverables} onChange={setDeliverables}
              options={[['yes', 'Yes'], ['partial', 'Partially'], ['no', 'No']]} />
          </Question>

          <Question label="3. Would you engage this student again?">
            <div style={{ display: 'flex', gap: 8 }}>
              {[[true, 'Yes'], [false, 'No']].map(([v, l]) => (
                <button key={String(v)} type="button" onClick={() => setWouldEngage(v as boolean)}
                  style={{ padding: '10px 18px', border: `1px solid ${wouldEngage === v ? C.accent : C.border}`,
                    background: wouldEngage === v ? C.accentHover : C.surfaceAlt,
                    color: wouldEngage === v ? C.accent : C.textMuted,
                    fontFamily: F.mono, fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {l as string}
                </button>
              ))}
            </div>
          </Question>

          <Question label="4. Independence level">
            <Radios<Independence> name="independence" value={independence} onChange={setIndependence}
              options={[['independent', 'Independent'], ['some_guidance', 'Some guidance'], ['frequent_checkins', 'Frequent check-ins']]} />
          </Question>

          <Question label="5. Communication">
            <Radios<Communication> name="communication" value={communication} onChange={setCommunication}
              options={[['proactive', 'Proactive'], ['responsive', 'Responsive'], ['needed_followup', 'Needed follow-up']]} />
          </Question>

          <Question label="6. Problem-solving">
            <Radios<ProblemSolving> name="problem_solving" value={problemSolving} onChange={setProblemSolving}
              options={[['proposed_solutions', 'Proposed solutions'], ['described_problems', 'Described problems'], ['got_stuck', 'Got stuck']]} />
          </Question>

          <Question label="Engagement outcome">
            <Radios<Outcome> name="outcome" value={outcome} onChange={setOutcome}
              options={[['completed', 'Completed'], ['partial', 'Partially completed'], ['terminated', 'Terminated early']]} />
          </Question>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, gap: 12 }}>
          <Link href={`/records/${record.id}`} style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>← Back to record</Link>
          <button onClick={submit} disabled={!canSubmit || submitting}
            style={{ padding: '12px 28px', background: canSubmit && !submitting ? C.accent : C.surfaceAlt, border: 'none', color: canSubmit && !submitting ? '#FFFFFF' : C.textFaint, fontFamily: F.mono, fontSize: 13, fontWeight: 500, cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {submitting ? 'Submitting…' : 'Submit attestation →'}
          </button>
        </div>
      </div>
    </main>
  )
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>{label}</p>
      {children}
    </div>
  )
}

function Radios<T extends string>({ name, value, onChange, options }: {
  name: string; value: T | ''; onChange: (v: T) => void; options: [T, string][]
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          style={{ padding: '10px 16px', border: `1px solid ${value === v ? C.accent : C.border}`,
            background: value === v ? C.accentHover : C.surfaceAlt,
            color: value === v ? C.accent : C.textMuted,
            fontFamily: 'var(--font-mono), IBM Plex Mono, Menlo, monospace', fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em' }}>
          {label}
        </button>
      ))}
      {/* Hidden radio group for accessibility/form semantics */}
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
