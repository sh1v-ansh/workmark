'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { allowedTransitions, canCloseOut, isTerminal, STAGE_LABEL, type Stage } from '@/lib/engagements/lifecycle'

export interface EngagementData {
  id: string
  listingId: string
  listingTitle: string
  listingBrief: string | null
  stage: Stage
  description: string | null
  agreedByStudentAt: string | null
  agreedByPosterAt: string | null
  visibility: string
  openedAt: string
  submittedAt: string | null
  closedAt: string | null
  abandonedAt: string | null
  role: 'student' | 'poster'
  myName: string | null
  counterpartName: string | null
  counterpartGithub: string | null
  counterpartEmail: string | null
  scannableRepos: string[]
  evidence: { skillId: string; name: string; level: number }[]
  outcome: { posterSatisfaction: number | null; wouldRehire: boolean | null; hiredBeyondEngagement: boolean } | null
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Familiar', 2: 'Practiced', 3: 'Strong', 4: 'Advanced', 5: 'Expert' }
const STAGE_ORDER: Stage[] = ['accepted', 'in_progress', 'submitted', 'closed']
const SHORT_STAGE: Record<string, string> = {
  accepted: 'Accepted',
  in_progress: 'In progress',
  submitted: 'Submitted',
  closed: 'Closed out',
}

/**
 * Progress through four fixed steps is an inherently horizontal fact. It
 * was previously written as a word in a badge, which made the reader hold
 * the sequence in their head to know where they were.
 */
function Stepper({ current }: { current: Stage }) {
  const idx = STAGE_ORDER.indexOf(current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      {STAGE_ORDER.map((s, i) => {
        const done = idx > i
        const now = idx === i
        const color = done ? state.positive : now ? C.accent : C.border
        const bg = done ? state.positiveBg : now ? '#EDE9FF' : 'transparent'
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 9, flexGrow: i === STAGE_ORDER.length - 1 ? 0 : 1, minWidth: 0 }}>
            <span
              style={{
                width: 24, height: 24, borderRadius: 999, flexShrink: 0,
                background: bg, border: `2px solid ${color}`,
                color: done || now ? color : C.textGhost,
                fontFamily: F.display, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span style={{ fontSize: 13, fontWeight: now ? 700 : 500, color: done || now ? C.text : C.textGhost, whiteSpace: 'nowrap' }}>
              {SHORT_STAGE[s]}
            </span>
            {i < STAGE_ORDER.length - 1 && (
              <div style={{ flexGrow: 1, height: 2, background: done ? state.positive : C.border, margin: '0 6px', minWidth: 12 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function EngagementClient({ data }: { data: EngagementData }) {
  const router = useRouter()
  const { toast } = useToast()

  const [description, setDescription] = useState(data.description ?? '')
  const [repo, setRepo] = useState('')
  const [busy, setBusy] = useState(false)
  const [satisfaction, setSatisfaction] = useState(data.outcome?.posterSatisfaction ?? 0)
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(data.outcome?.wouldRehire ?? null)

  const isPoster = data.role === 'poster'
  const terminal = isTerminal(data.stage)
  const descriptionDirty = description.trim() !== (data.description ?? '').trim()
  const myAgreement = isPoster ? data.agreedByPosterAt : data.agreedByStudentAt
  const theirAgreement = isPoster ? data.agreedByStudentAt : data.agreedByPosterAt
  const closeGate = canCloseOut({
    stage: data.stage,
    description: data.description,
    description_agreed_by_student_at: data.agreedByStudentAt,
    description_agreed_by_poster_at: data.agreedByPosterAt,
  })

  async function patch(body: Record<string, unknown>, successMessage: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/engagements/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update.')
      toast(successMessage, 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not update.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function closeOut() {
    setBusy(true)
    try {
      const res = await fetch(`/api/engagements/${data.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: repo || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not close out.')
      toast(
        json.skipped
          ? `Closed out. The repo was skipped: ${json.skipReason}`
          : `Closed out — ${json.evidenceWritten} skill${json.evidenceWritten === 1 ? '' : 's'} added to their record.`,
        'success',
      )
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not close out.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveOutcome() {
    setBusy(true)
    try {
      const res = await fetch(`/api/engagements/${data.id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterSatisfaction: satisfaction || undefined,
          wouldRehire: wouldRehire ?? undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save.')
      toast('Thanks — outcome recorded.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const nextStages = allowedTransitions(data.stage, data.role).filter((s) => s !== 'abandoned')
  const canAbandon = allowedTransitions(data.stage, data.role).includes('abandoned')

  // The headline is the question actually being asked of you, where there
  // is one. A title tells you which engagement you opened; it does not tell
  // you why the page is showing you anything.
  const awaitingMyAgreement = !terminal && !myAgreement && !!data.description?.trim() && !descriptionDirty
  const headline = data.stage === 'abandoned'
    ? 'This engagement was abandoned.'
    : data.stage === 'closed'
      ? 'This is on the record now.'
      : awaitingMyAgreement
        ? 'Do you agree this is what happened?'
        : data.listingTitle

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={data.myName ?? undefined} />

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        <Link href="/student/dashboard" style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>← Home</Link>

        <div style={{ margin: '13px 0 20px' }}>
          <h1 style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: C.text, marginBottom: 7 }}>
            {headline}
          </h1>
          <p style={{ fontSize: 15, color: C.textMuted }}>
            {headline === data.listingTitle ? '' : `${data.listingTitle} · `}
            {isPoster ? `with ${data.counterpartName ?? 'a student'}` : `posted by ${data.counterpartName ?? 'a student'}`}
            {' · opened '}{new Date(data.openedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Where you are, at a glance */}
        <Card hoverable={false} padding="16.5px 22px" style={{ marginBottom: 18 }}>
          {data.stage === 'abandoned' ? (
            <p style={{ fontSize: 14.5, color: state.caution }}>
              Abandoned{data.abandonedAt ? ` on ${new Date(data.abandonedAt).toLocaleDateString()}` : ''}. This is permanent and shows on the track record for both sides.
            </p>
          ) : (
            <Stepper current={data.stage} />
          )}
        </Card>

        {/* Two thirds: the task. One third: settings and reference, visibly
            lighter so the eye never mistakes the rail for the subject. */}
        <div className="nb-split">

          <div>
            <Card hoverable={false} padding={24}>
              <Kicker style={{ marginBottom: 9 }}>What the work was</Kicker>
              <p style={{ fontSize: 14, color: C.textFaint, lineHeight: 1.55, marginBottom: 16, maxWidth: 540 }}>
                This is the text that goes on {isPoster ? "the student's" : 'your'} record permanently. Both of you have to agree to it, and either of you editing it clears both signatures.
              </p>

              {terminal ? (
                <p style={{ fontSize: 16, color: C.textSub, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                  {data.description || <span style={{ color: C.textGhost }}>No description was agreed.</span>}
                </p>
              ) : (
                <>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="dk-textarea"
                    style={{ fontFamily: 'inherit', lineHeight: 1.7, fontSize: 15.5 }}
                    placeholder="What was built, what they owned, what shipped."
                    aria-label="Work description"
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16.5, padding: '12.5px 16.5px', background: theirAgreement ? state.positiveBg : C.bg, borderRadius: R.md, margin: '16px 0', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8.5, fontSize: 14, fontWeight: 600, color: theirAgreement ? state.positive : C.textMuted }}>
                      {theirAgreement && (
                        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M5 10.2l3.2 3.2L15 6.6" stroke={state.positive} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {theirAgreement
                        ? `${data.counterpartName ?? 'They'} agreed`
                        : `${data.counterpartName ?? 'They'} haven't agreed yet`}
                    </span>
                    <span style={{ width: 1, height: 17, background: C.border }} />
                    <span style={{ fontSize: 14, color: myAgreement ? state.positive : C.textMuted, fontWeight: myAgreement ? 600 : 400 }}>
                      {myAgreement ? 'You agreed' : "You haven't yet"}
                    </span>
                  </div>

                  {descriptionDirty && (
                    <p style={{ fontSize: 13.5, color: state.caution, lineHeight: 1.55, marginBottom: 13 }}>
                      Saving this edit clears both agreements — an agreement is to specific wording, not to the idea.
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {descriptionDirty && (
                      <Button variant="ink" onClick={() => patch({ description }, 'Description saved — both agreements reset.')} disabled={busy}>
                        Save changes
                      </Button>
                    )}
                    {!descriptionDirty && !myAgreement && description.trim() && (
                      <Button variant="ink" onClick={() => patch({ agreeToDescription: true }, 'You agreed to the description.')} disabled={busy}>
                        Yes, this is accurate
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>

            {(nextStages.length > 0 || canAbandon) && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {nextStages.map((s) => (
                  <Button
                    key={s} variant="outline" size="sm" disabled={busy}
                    onClick={() => patch({ stage: s }, `Moved to ${STAGE_LABEL[s].toLowerCase()}.`)}
                  >
                    {s === 'in_progress' && data.stage === 'submitted' ? 'Send back for more work' : `Mark ${STAGE_LABEL[s].toLowerCase()}`}
                  </Button>
                ))}
                {canAbandon && (
                  <Button
                    variant="quiet" size="sm" disabled={busy}
                    onClick={() => { if (confirm('Abandon this engagement? This is permanent and shows on the track record for both sides.')) patch({ stage: 'abandoned' }, 'Engagement abandoned.') }}
                  >
                    Abandon
                  </Button>
                )}
              </div>
            )}

            {/* Outcome (poster, post-close) */}
            {isPoster && data.stage === 'closed' && (
              <Card hoverable={false} padding={23} style={{ marginTop: 14 }}>
                <Kicker style={{ marginBottom: 9 }}>How did it go?</Kicker>
                <p style={{ fontSize: 14, color: C.textFaint, lineHeight: 1.55, marginBottom: 16, maxWidth: 500 }}>
                  This does not change their skill levels — those come from the code. It helps us understand which matches actually work.
                </p>
                <div style={{ display: 'flex', gap: 6.5, marginBottom: 14.5 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n} onClick={() => setSatisfaction(n)} aria-label={`${n} out of 5`} aria-pressed={satisfaction === n}
                      style={{
                        width: 38, height: 38, borderRadius: R.md, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 600,
                        background: satisfaction >= n ? '#EDE9FF' : C.bg,
                        border: `1.5px solid ${satisfaction >= n ? C.accentBorder : C.border}`,
                        color: satisfaction >= n ? C.accentInk : C.textFaint,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8.5, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[{ v: true, label: 'Would work with them again' }, { v: false, label: 'Would not' }].map(({ v, label }) => (
                    <button
                      key={String(v)} onClick={() => setWouldRehire(v)} aria-pressed={wouldRehire === v}
                      style={{
                        padding: '8px 14.5px', borderRadius: R.md, cursor: 'pointer', font: 'inherit', fontSize: 13.5, fontWeight: 500,
                        background: wouldRehire === v ? '#EDE9FF' : C.bg,
                        border: `1.5px solid ${wouldRehire === v ? C.accentBorder : C.border}`,
                        color: wouldRehire === v ? C.accentInk : C.textMuted,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button variant="ink" size="sm" onClick={saveOutcome} disabled={busy || (!satisfaction && wouldRehire === null)}>
                  {data.outcome ? 'Update' : 'Submit'}
                </Button>
              </Card>
            )}
          </div>

          {/* Rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {isPoster && !terminal && (
              <Card hoverable={false} padding={19.5}>
                <Kicker style={{ marginBottom: 9 }}>Close out</Kicker>
                <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55, marginBottom: 13 }}>
                  Adds verified skills to their record from the repository the work lives in. Only repositories they have enabled appear here.
                </p>
                {data.scannableRepos.length > 0 ? (
                  <select value={repo} onChange={(e) => setRepo(e.target.value)} className="dk-select" style={{ marginBottom: 13 }} aria-label="Repo the work lives in">
                    <option value="">No repo (design, research, other non-code work)</option>
                    {data.scannableRepos.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginBottom: 13 }}>
                    They have not enabled any repositories. You can still close out — it just won&apos;t add skill evidence.
                  </p>
                )}
                <Button variant="ink" size="sm" fullWidth onClick={closeOut} disabled={busy || !closeGate.ok} busyLabel={busy ? 'Closing…' : null}>
                  Close out
                </Button>
                {!closeGate.ok && (
                  <p style={{ fontSize: 13, color: C.textFaint, marginTop: 10, lineHeight: 1.5 }}>{closeGate.reason}</p>
                )}
              </Card>
            )}

            {data.evidence.length > 0 && (
              <Card hoverable={false} padding={19.5}>
                <Kicker style={{ marginBottom: 11 }}>Added to {isPoster ? 'their' : 'your'} record</Kicker>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.evidence.map((e) => (
                    <span key={e.skillId} style={{ fontSize: 13, fontWeight: 600, color: C.accentInk, background: '#EDE9FF', borderRadius: R.sm, padding: '5.5px 11px' }}>
                      {e.name} · {LEVEL_NAMES[e.level] ?? e.level}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginTop: 11 }}>
                  Tagged as collaboration, not solo work.
                </p>
              </Card>
            )}

            {data.counterpartEmail && (
              <Card hoverable={false} padding={19.5}>
                <Kicker style={{ marginBottom: 9 }}>Contact</Kicker>
                <a href={`mailto:${data.counterpartEmail}`} style={{ fontSize: 14, color: C.accent, textDecoration: 'none', wordBreak: 'break-all' }}>
                  {data.counterpartEmail}
                </a>
                {data.counterpartGithub && (
                  <div style={{ marginTop: 9 }}>
                    <a
                      href={`https://github.com/${data.counterpartGithub}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6.5, fontSize: 13.5, color: C.textMuted, textDecoration: 'none' }}
                    >
                      <Icon name="github" size={13.5} /> {data.counterpartGithub}
                    </a>
                  </div>
                )}
              </Card>
            )}

            {!isPoster && (
              <Card hoverable={false} padding={19.5}>
                <Kicker style={{ marginBottom: 9 }}>Who can see this</Kicker>
                <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55, marginBottom: 13 }}>
                  Hidden engagements still count toward your skills. Your total engagement count is never displayed, so nobody can tell anything was hidden.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7.5 }}>
                  {([
                    { v: 'full', label: 'Public', desc: 'Shows the project and who posted it.' },
                    { v: 'redacted', label: 'Redacted', desc: 'Displays only that the work happened.' },
                    { v: 'hidden', label: 'Hidden', desc: 'Not on your profile at all.' },
                  ]).map(({ v, label, desc }) => (
                    <label
                      key={v}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 9.5, padding: '10px 13px',
                        background: data.visibility === v ? '#EDE9FF' : C.bg,
                        border: `1px solid ${data.visibility === v ? '#D9D0F5' : 'transparent'}`,
                        borderRadius: R.md, cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio" name="visibility" checked={data.visibility === v} disabled={busy}
                        onChange={() => patch({ visibility: v }, 'Visibility updated.')}
                        style={{ marginTop: 3, accentColor: C.accent }}
                      />
                      <span>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{label}</span>
                        <span style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.45 }}>{desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Card>
            )}

            {terminal && data.stage === 'closed' && (
              <Card hoverable={false} padding={19.5}>
                <Badge tone="positive">Closed out</Badge>
                <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55, marginTop: 11 }}>
                  {data.closedAt ? `Finished on ${new Date(data.closedAt).toLocaleDateString()}.` : 'Finished.'} Neither side can change the description now.
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
