'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'

// Local types — deliberately not sourced from src/lib/types.ts, which is
// still the pre-rebuild shape (Phase 1 task #16 rewrites it). This page
// only needs to prove the new pipeline works, not integrate with the old
// dashboard's type surface.
interface GithubConnection {
  installation_id: string
  github_login: string | null
  connected_at: string
}
interface RepoGrant {
  id: string
  repo_full_name: string
  granted_at: string
  is_private: boolean
  scan_enabled: boolean
}
interface SkillPrior {
  id: string
  skill_id: string
  source: string
  extracted_at: string
  skills: { canonical_name: string } | null
}
interface SkillEvidenceRow {
  id: string
  skill_id: string
  base: number
  difficulty_cleared: number
  verification_method: string
  created_at: string
  skills: { canonical_name: string } | null
  artifacts: { repo_full_name: string | null; deployment_url: string | null } | null
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Familiar', 2: 'Practiced', 3: 'Strong', 4: 'Advanced', 5: 'Expert' }

function levelLabel(n: number) {
  return LEVEL_NAMES[n] ?? `Level ${n}`
}

interface ReviewRequest {
  id: string
  url: string
  note: string
  status: string
  requested_at: string
  review_note: string | null
}

export default function GithubScanClient({ studentName, connection, grants, priors, evidence, reviewRequests }: {
  studentName: string | null
  connection: GithubConnection | null
  grants: RepoGrant[]
  priors: SkillPrior[]
  evidence: SkillEvidenceRow[]
  reviewRequests: ReviewRequest[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // Only holds repos the student has toggled in this session — the stored
  // value is read from `grants` otherwise, so a router.refresh() after a
  // sync flows straight through instead of being masked by stale state.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [reviewUrl, setReviewUrl] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  async function submitForReview() {
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/review-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: reviewUrl, note: reviewNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not submit.')
      toast('Submitted for review.', 'success')
      setReviewUrl(''); setReviewNote('')
      window.location.reload()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not submit.', 'error')
    } finally {
      setSubmittingReview(false)
    }
  }
  const syncedRef = useRef(false)

  // Grant rows can't be trusted for visibility on their own: rows created
  // before is_private existed all carry the column default, and a repo's
  // public/private state can change at any time without a webhook that
  // says so. Re-sync against GitHub on load so the picker shows what's
  // actually private BEFORE anything is scanned.
  useEffect(() => {
    if (!connection || syncedRef.current) return
    syncedRef.current = true
    setSyncing(true)
    fetch('/api/github/repos/sync', { method: 'POST' })
      .then((r) => r.json())
      .then((json) => { if (json?.changed > 0) router.refresh() })
      .catch(() => { /* picker still works off stored rows */ })
      .finally(() => setSyncing(false))
  }, [connection, router])

  async function toggleScanEnabled(grantId: string, next: boolean) {
    setTogglingId(grantId)
    setOverrides((prev) => ({ ...prev, [grantId]: next })) // optimistic
    const supabase = createClient()
    // RLS ("Students: manage own repo grants", for all) lets a student
    // update their own grant rows directly — this doesn't need to go
    // through a service-role API route. .select() so a write matching zero
    // rows (stale id, RLS mismatch) surfaces as a failure instead of a
    // silent no-op that leaves the checkbox on while the DB stays off.
    const { data, error } = await supabase
      .from('github_repo_grants')
      .update({ scan_enabled: next })
      .eq('id', grantId)
      .select('id')
    if (error || !data || data.length === 0) {
      setOverrides((prev) => {
        const revert = { ...prev }
        delete revert[grantId] // fall back to the stored value
        return revert
      })
      toast('Failed to update — please try again.', 'error')
    } else {
      router.refresh() // reconcile the checkbox with the persisted value
    }
    setTogglingId(null)
  }

  const publicGrants = grants.filter((g) => !g.is_private)
  const privateGrants = grants.filter((g) => g.is_private)

  async function runScan() {
    setScanning(true)
    try {
      const res = await fetch('/api/github/scan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed.')
      const evidenceCount = json.results.reduce((n: number, r: { evidenceWritten: unknown[] }) => n + r.evidenceWritten.length, 0)
      toast(`Scan complete — ${json.results.length} repo(s) processed, ${evidenceCount} evidence row(s) written or confirmed.`, 'success')
      window.location.reload()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Scan failed.', 'error')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={studentName ?? undefined} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            GitHub: Verification View
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Connect your repositories and scan them to build your verified skill record.
          </p>
        </div>

        {/* Connection status */}
        <Card hoverable={false} padding={24}>
          {connection ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.accentHover, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
                  <Icon name="github" size={18} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Connected as {connection.github_login ?? '(unknown)'}</p>
                  <p style={{ fontSize: 12, color: C.textFaint }}>{grants.length} repo{grants.length === 1 ? '' : 's'} granted</p>
                </div>
              </div>
              <button onClick={runScan} disabled={scanning} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                <Icon name="refresh" size={13} /> {scanning ? 'Scanning…' : 'Scan now'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 13, color: C.textMuted }}>Not connected yet.</p>
              <a href="/api/github/app/install" className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                <Icon name="github" size={13} /> Connect GitHub
              </a>
            </div>
          )}
        </Card>

        {/* Granted repos. Public repos are already world-readable, so
            they're scanned unconditionally. Private ones are the consent
            question — being granted access via GitHub's install picker
            isn't the same as saying "this is mine to share", and a
            private repo may well be an employer's IP. */}
        {grants.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Granted repos ({grants.length})</h2>
              {syncing && <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>syncing with GitHub…</span>}
            </div>

            {publicGrants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Public — always scanned ({publicGrants.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {publicGrants.map((g) => (
                    <span key={g.id} style={{ fontSize: 12, padding: '4px 10px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSub, fontFamily: F.mono }}>
                      {g.repo_full_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Private — you choose ({privateGrants.length})
              </p>
              {privateGrants.length === 0 ? (
                <p style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5 }}>No private repos shared with Workmark.</p>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
                    Off by default. Only enable repos you have the right to share — not an employer&apos;s private code.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {privateGrants.map((g) => {
                      const enabled = overrides[g.id] ?? g.scan_enabled
                      return (
                        <label
                          key={g.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                            padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                            cursor: togglingId === g.id ? 'wait' : 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={togglingId === g.id}
                              onChange={(e) => toggleScanEnabled(g.id, e.target.checked)}
                              className="dk-checkbox"
                            />
                            <span style={{ fontSize: 13, color: C.textSub, fontFamily: F.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {g.repo_full_name}
                            </span>
                          </div>
                          <span style={{
                            flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                            textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F.mono,
                            color: '#B45309', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)',
                          }}>
                            Private
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Evidence — grouped by repo, since the same skill legitimately
            gets one row per repo that demonstrates it (independent
            evidence, independent level), which reads as "duplicates"
            without knowing which repo each one came from. */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            Skill evidence ({evidence.length})
          </h2>
          {evidence.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textFaint }}>No evidence yet — connect GitHub and scan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from(
                evidence.reduce((byRepo, e) => {
                  const repo = e.artifacts?.repo_full_name ?? '(unknown repo)'
                  if (!byRepo.has(repo)) byRepo.set(repo, [])
                  byRepo.get(repo)!.push(e)
                  return byRepo
                }, new Map<string, SkillEvidenceRow[]>()),
              ).map(([repo, rows]) => (
                <Card key={repo} hoverable={false} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.mono }}>{repo}</span>
                    {rows[0]?.artifacts?.deployment_url ? (
                      <a href={rows[0].artifacts.deployment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.accent, fontFamily: F.mono }}>
                        {rows[0].verification_method} ↗
                      </a>
                    ) : repo !== '(unknown repo)' ? (
                      <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.accent, fontFamily: F.mono }}>
                        repo link ↗
                      </a>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {rows.map((e) => {
                      const name = e.skills?.canonical_name ?? e.skill_id
                      const c = tagColor(name)
                      return (
                        <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                          {name}
                          <span style={{ fontWeight: 400, opacity: 0.75 }}>{levelLabel(e.difficulty_cleared)}</span>
                        </span>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Human review — §3's fallback for work with no scannable repo */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Work without a repo</h2>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
            Design work, research, anything we can&apos;t read from code. Submit it and a person will look at it — slower than a scan, but it counts the same once approved.
          </p>

          {reviewRequests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {reviewRequests.map((r) => (
                <div key={r.id} style={{ padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontFamily: F.mono, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                      {r.url}
                    </a>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 999, fontFamily: F.mono,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: r.status === 'approved' ? '#15803D' : r.status === 'rejected' ? '#B91C1C' : C.textFaint,
                      background: r.status === 'approved' ? 'rgba(21,128,61,0.12)' : r.status === 'rejected' ? 'rgba(185,28,28,0.12)' : C.surface,
                      border: `1px solid ${r.status === 'approved' ? 'rgba(21,128,61,0.35)' : r.status === 'rejected' ? 'rgba(185,28,28,0.3)' : C.border}`,
                    }}>
                      {r.status}
                    </span>
                  </div>
                  {r.review_note && (
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{r.review_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!reviewRequests.some((r) => r.status === 'pending') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                className="dk-input" placeholder="https://link-to-your-work" aria-label="Link to the work"
              />
              <textarea
                value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3}
                className="dk-input" style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                placeholder="What is it, and what did you build? There's no commit history here, so this is all a reviewer has to go on."
                aria-label="Description"
              />
              <button
                onClick={submitForReview}
                disabled={submittingReview || !reviewUrl.trim() || reviewNote.trim().length < 30}
                className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex', alignSelf: 'flex-start' }}
              >
                {submittingReview ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          )}
        </section>

        {/* Skills detected in repos the student hasn't personally committed
            to. Shown only when there are any, and kept plain — no internal
            scoring vocabulary in the UI. */}
        {priors.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Detected but unverified
            </h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Found in your repositories, but not yet backed by your own commits — so they don&apos;t count toward your record yet.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {priors.map((p) => {
                const name = p.skills?.canonical_name ?? p.skill_id
                const c = tagColor(name)
                return (
                  <span key={p.id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono, opacity: 0.7 }}>
                    {name}
                  </span>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
