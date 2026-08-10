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

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={data.myName ?? undefined} />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link href="/student/dashboard" style={{ fontSize: 12, fontFamily: F.mono, color: C.textFaint, textDecoration: 'none' }}>
          ← Dashboard
        </Link>

        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.25 }}>
            {data.listingTitle}
          </h1>
          <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
            {isPoster ? `Working with ${data.counterpartName ?? 'a student'}` : `Posted by ${data.counterpartName ?? 'a student'}`}
            {' · opened '}{new Date(data.openedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Stage tracker */}
        <Card hoverable={false} padding={20}>
          {data.stage === 'abandoned' ? (
            <p style={{ fontSize: 13, color: '#B45309', fontFamily: F.mono }}>
              Abandoned{data.abandonedAt ? ` on ${new Date(data.abandonedAt).toLocaleDateString()}` : ''}.
            </p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
              {STAGE_ORDER.map((s, i) => {
                const reached = STAGE_ORDER.indexOf(data.stage) >= i
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === STAGE_ORDER.length - 1 ? 'none' : 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                      fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: reached ? C.accentHover : C.surfaceAlt,
                      border: `1px solid ${reached ? C.accentBorder : C.border}`,
                      color: reached ? C.accent : C.textFaint,
                    }}>
                      {STAGE_LABEL[s]}
                    </span>
                    {i < STAGE_ORDER.length - 1 && (
                      <div style={{ flex: 1, height: 1, background: STAGE_ORDER.indexOf(data.stage) > i ? C.accent : C.border, margin: '0 6px', minWidth: 8 }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {(nextStages.length > 0 || canAbandon) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {nextStages.map((s) => (
                <button key={s} onClick={() => patch({ stage: s }, `Moved to ${STAGE_LABEL[s].toLowerCase()}.`)} disabled={busy} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  {s === 'in_progress' && data.stage === 'submitted' ? 'Send back for more work' : `Mark ${STAGE_LABEL[s].toLowerCase()}`}
                </button>
              ))}
              {canAbandon && (
                <button
                  onClick={() => { if (confirm('Abandon this engagement? This is permanent and shows on the track record for both sides.')) patch({ stage: 'abandoned' }, 'Engagement abandoned.') }}
                  disabled={busy} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}
                >
                  Abandon
                </button>
              )}
            </div>
          )}
        </Card>

        {/* Contact */}
        {data.counterpartEmail && (
          <Card hoverable={false} padding={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>Contact</span>
              <a href={`mailto:${data.counterpartEmail}`} style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontFamily: F.mono }}>
                {data.counterpartEmail}
              </a>
              {data.counterpartGithub && (
                <a href={`https://github.com/${data.counterpartGithub}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none', fontFamily: F.mono }}>
                  <Icon name="github" size={12} /> {data.counterpartGithub}
                </a>
              )}
            </div>
          </Card>
        )}

        {/* Agreed description */}
        <Card hoverable={false} padding={24}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>What the work was</h2>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.5 }}>
            Both of you have to agree to this before close-out. It becomes part of {isPoster ? "the student's" : 'your'} permanent record, so neither side can write it alone.
          </p>

          {terminal ? (
            <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {data.description || <span style={{ color: C.textFaint }}>No description was agreed.</span>}
            </p>
          ) : (
            <>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="dk-input"
                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                placeholder="What was built, what they owned, what shipped."
                aria-label="Work description"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {descriptionDirty && (
                  <button onClick={() => patch({ description }, 'Description saved — both agreements reset.')} disabled={busy} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                    Save changes
                  </button>
                )}
                {!descriptionDirty && !myAgreement && description.trim() && (
                  <button onClick={() => patch({ agreeToDescription: true }, 'You agreed to the description.')} disabled={busy} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                    <Icon name="check" size={12} /> I agree to this
                  </button>
                )}
                <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                  {myAgreement ? 'You agreed' : 'You have not agreed'}
                  {' · '}
                  {theirAgreement ? 'They agreed' : 'They have not agreed'}
                </span>
              </div>
              {descriptionDirty && (
                <p style={{ fontSize: 11, color: '#B45309', marginTop: 8, lineHeight: 1.5 }}>
                  Saving an edit clears both agreements — an agreement is to specific wording.
                </p>
              )}
            </>
          )}
        </Card>

        {/* Close-out (poster only) */}
        {isPoster && !terminal && (
          <Card hoverable={false} padding={24}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Close out</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.5 }}>
              Closing out adds verified skills to their record from the repo the work lives in. Only repos they&apos;ve shared and enabled for scanning appear here.
            </p>

            {data.scannableRepos.length > 0 ? (
              <select value={repo} onChange={(e) => setRepo(e.target.value)} className="dk-select" style={{ marginBottom: 12 }} aria-label="Repo the work lives in">
                <option value="">No repo (design, research, or other non-code work)</option>
                {data.scannableRepos.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            ) : (
              <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
                They haven&apos;t enabled any repos for scanning. You can still close out — it just won&apos;t add skill evidence.
              </p>
            )}

            <button onClick={closeOut} disabled={busy || !closeGate.ok} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              <Icon name="check" size={12} /> {busy ? 'Closing…' : 'Close out'}
            </button>
            {!closeGate.ok && (
              <p style={{ fontSize: 12, color: C.textFaint, marginTop: 10, lineHeight: 1.5 }}>{closeGate.reason}</p>
            )}
          </Card>
        )}

        {/* Evidence minted */}
        {data.evidence.length > 0 && (
          <Card hoverable={false} padding={24}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
              Skills this added to {isPoster ? 'their' : 'your'} record
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.evidence.map((e) => {
                const c = tagColor(e.name)
                return (
                  <span key={e.skillId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                    {e.name}
                    <span style={{ fontWeight: 400, opacity: 0.75 }}>{LEVEL_NAMES[e.level] ?? e.level}</span>
                  </span>
                )
              })}
            </div>
          </Card>
        )}

        {/* Outcome (poster, post-close) */}
        {isPoster && data.stage === 'closed' && (
          <Card hoverable={false} padding={24}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>How did it go?</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.5 }}>
              This does not change their skill levels — those come from the code. It helps us understand which matches actually work.
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n} onClick={() => setSatisfaction(n)} aria-label={`${n} out of 5`} aria-pressed={satisfaction === n}
                  style={{ width: 38, height: 38, borderRadius: 8, cursor: 'pointer', fontFamily: F.mono, fontSize: 13, background: satisfaction >= n ? C.accentHover : C.surfaceAlt, border: `1px solid ${satisfaction >= n ? C.accentBorder : C.border}`, color: satisfaction >= n ? C.accent : C.textFaint }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {[{ v: true, label: 'Would work with them again' }, { v: false, label: 'Would not' }].map(({ v, label }) => (
                <button
                  key={String(v)} onClick={() => setWouldRehire(v)} aria-pressed={wouldRehire === v}
                  style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: F.mono, fontSize: 12, background: wouldRehire === v ? C.accentHover : C.surfaceAlt, border: `1px solid ${wouldRehire === v ? C.accentBorder : C.border}`, color: wouldRehire === v ? C.accent : C.textMuted }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={saveOutcome} disabled={busy || (!satisfaction && wouldRehire === null)} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              {data.outcome ? 'Update' : 'Submit'}
            </button>
          </Card>
        )}

        {/* Visibility (student only) */}
        {!isPoster && (
          <Card hoverable={false} padding={24}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>How this shows on your record</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.5 }}>
              Hidden engagements still count toward your skills and track record. Your total engagement count is never displayed, so nobody can tell anything was hidden.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { v: 'full', label: 'Full', desc: 'Shows normally, with the project and who posted it.' },
                { v: 'redacted', label: 'Redacted', desc: 'Counts toward your skills, but displays as a confidential engagement.' },
                { v: 'hidden', label: 'Hidden', desc: "Doesn't display at all. Still counts toward your skills." },
              ]).map(({ v, label, desc }) => (
                <label key={v} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${data.visibility === v ? C.accentBorder : C.border}`, borderRadius: 8, cursor: 'pointer' }}>
                  <input
                    type="radio" name="visibility" checked={data.visibility === v} disabled={busy}
                    onChange={() => patch({ visibility: v }, 'Visibility updated.')}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
                    <span style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5 }}>{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
