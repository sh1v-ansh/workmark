'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
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

const REVIEW_TONE = { approved: 'positive', rejected: 'neutral', pending: 'info' } as const

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

  const evidenceByRepo = Array.from(
    evidence.reduce((byRepo, e) => {
      const repo = e.artifacts?.repo_full_name ?? '(unknown repo)'
      if (!byRepo.has(repo)) byRepo.set(repo, [])
      byRepo.get(repo)!.push(e)
      return byRepo
    }, new Map<string, SkillEvidenceRow[]>()),
  )

  const hasPending = reviewRequests.some((r) => r.status === 'pending')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={studentName ?? undefined} />

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 8 }}>
            Choose what we may read
          </h1>
          <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, maxWidth: 600 }}>
            Every skill on your record comes from one of these repositories. Turn one off and it stops being scanned — anything already on your record stays, because the record is append-only.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }} className="mob-1col">

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Granted repos. Public repos are already world-readable, so
                they're scanned unconditionally. Private ones are the consent
                question — being granted access via GitHub's install picker
                isn't the same as saying "this is mine to share", and a
                private repo may well be an employer's IP. Combined into one
                list, ordered public-first, because the visibility badge
                already tells the story per row. */}
            {grants.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                  <Kicker>Your repositories</Kicker>
                  <span style={{ fontSize: 12.5, color: C.textGhost }}>
                    {syncing ? 'syncing with GitHub…' : `${grants.filter((g) => (overrides[g.id] ?? g.scan_enabled) || !g.is_private).length} of ${grants.length} enabled`}
                  </span>
                </div>
                <Card hoverable={false} padding="3px 16px 6px">
                  {grants.map((g, i) => {
                    const enabled = g.is_private ? (overrides[g.id] ?? g.scan_enabled) : true
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < grants.length - 1 ? `1px solid ${C.borderFaint}` : 'none' }}>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.repo_full_name}</span>
                            <Badge tone={g.is_private ? 'caution' : 'neutral'}>{g.is_private ? 'Private' : 'Public'}</Badge>
                          </div>
                        </div>
                        {g.is_private ? (
                          <button
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`Scan ${g.repo_full_name}`}
                            disabled={togglingId === g.id}
                            onClick={() => toggleScanEnabled(g.id, !enabled)}
                            style={{
                              flexShrink: 0, width: 34, height: 20, borderRadius: 999, position: 'relative', border: 'none',
                              cursor: togglingId === g.id ? 'wait' : 'pointer',
                              background: enabled ? C.accent : C.border,
                              transition: 'background 0.15s',
                            }}
                          >
                            <span style={{
                              position: 'absolute', top: 2.5, left: enabled ? 17 : 2.5, width: 15, height: 15, borderRadius: 999,
                              background: '#fff', transition: 'left 0.15s',
                            }} />
                          </button>
                        ) : (
                          <span style={{ flexShrink: 0, fontSize: 12, color: C.textGhost }}>Always scanned</span>
                        )}
                      </div>
                    )
                  })}
                </Card>
                <p style={{ fontSize: 12, color: C.textGhost, lineHeight: 1.45, marginTop: 9 }}>
                  Private repos are off by default. Only enable ones you have the right to share — not an employer&apos;s code.
                </p>
              </div>
            )}

            {/* Evidence — grouped by repo, since the same skill legitimately
                gets one row per repo that demonstrates it (independent
                evidence, independent level), which reads as "duplicates"
                without knowing which repo each one came from. */}
            <div>
              <Kicker style={{ marginBottom: 11 }}>Skill evidence · {evidence.length}</Kicker>
              {evidence.length === 0 ? (
                <Card hoverable={false} padding={17}>
                  <p style={{ fontSize: 13, color: C.textMuted }}>No evidence yet — connect GitHub and scan.</p>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {evidenceByRepo.map(([repo, rows]) => (
                    <Card key={repo} hoverable={false} padding={14}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, wordBreak: 'break-word' }}>{repo}</span>
                        {rows[0]?.artifacts?.deployment_url ? (
                          <a href={rows[0].artifacts.deployment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                            {rows[0].verification_method} ↗
                          </a>
                        ) : repo !== '(unknown repo)' ? (
                          <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                            repo link ↗
                          </a>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {rows.map((e) => {
                          const name = e.skills?.canonical_name ?? e.skill_id
                          const c = tagColor(name)
                          return (
                            <span key={e.id} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                              {name} <span style={{ fontWeight: 400, opacity: 0.75 }}>{levelLabel(e.difficulty_cleared)}</span>
                            </span>
                          )
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Human review — §3's fallback for work with no scannable repo */}
            <div>
              <Kicker style={{ marginBottom: 5 }}>Work without a repo</Kicker>
              <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.45, marginBottom: 12, maxWidth: 520 }}>
                Design work, research, anything we can&apos;t read from code. Submit it and a person will look at it — slower than a scan, but it counts the same once approved.
              </p>

              {reviewRequests.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: hasPending ? 0 : 14 }}>
                  {reviewRequests.map((r) => (
                    <Card key={r.id} hoverable={false} padding="10px 13px">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: C.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                          {r.url}
                        </a>
                        <Badge tone={REVIEW_TONE[r.status as keyof typeof REVIEW_TONE] ?? 'neutral'}>{r.status}</Badge>
                      </div>
                      {r.review_note && (
                        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 1.45 }}>{r.review_note}</p>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {!hasPending && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: reviewRequests.length > 0 ? 12 : 0 }}>
                  <input
                    value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                    className="dk-input" placeholder="https://link-to-your-work" aria-label="Link to the work"
                  />
                  <textarea
                    value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3}
                    className="dk-textarea" style={{ fontFamily: 'inherit', fontSize: 13 }}
                    placeholder="What is it, and what did you build? There's no commit history here, so this is all a reviewer has to go on."
                    aria-label="Description"
                  />
                  <div style={{ alignSelf: 'flex-start' }}>
                    <Button
                      variant="outline" size="sm"
                      onClick={submitForReview}
                      disabled={!reviewUrl.trim() || reviewNote.trim().length < 30}
                      busyLabel={submittingReview ? 'Submitting…' : null}
                    >
                      Submit for review
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Skills detected in repos the student hasn't personally
                committed to. Shown only when there are any, and kept plain
                — no internal scoring vocabulary in the UI. */}
            {priors.length > 0 && (
              <div>
                <Kicker style={{ marginBottom: 5 }}>Detected but unverified</Kicker>
                <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.45, marginBottom: 10, maxWidth: 520 }}>
                  Found in your repositories, but not yet backed by your own commits — so these don&apos;t count toward your record yet.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {priors.map((p) => {
                    const name = p.skills?.canonical_name ?? p.skill_id
                    const c = tagColor(name)
                    return (
                      <span key={p.id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text, opacity: 0.7 }}>
                        {name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <Card hoverable={false} padding={17}>
              {connection ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                    <div style={{ width: 32, height: 32, borderRadius: R.md, background: '#EDE9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}>
                      <Icon name="github" size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Connected as {connection.github_login ?? '(unknown)'}
                      </p>
                      <p style={{ fontSize: 12, color: C.textFaint }}>{grants.length} repo{grants.length === 1 ? '' : 's'} granted</p>
                    </div>
                  </div>
                  <Button variant="ink" size="sm" fullWidth onClick={runScan} busyLabel={scanning ? 'Scanning…' : null}>
                    Scan now
                  </Button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>Not connected yet.</p>
                  <a href="/api/github/app/install" className="nb-btn nb-btn-ink" style={{ width: '100%' }}>
                    <Icon name="github" size={13} /> Connect GitHub
                  </a>
                </>
              )}
            </Card>

            <Card hoverable={false} padding={17}>
              <Kicker style={{ marginBottom: 8 }}>What a scan reads</Kicker>
              <p style={{ fontSize: 12.5, color: C.textFaint, lineHeight: 1.55 }}>
                Only commits attributed to your GitHub identity. Forks with no commits of yours are skipped. We look at what the code does, not how much of it there is.
              </p>
            </Card>

            <div style={{ background: state.cautionBg, borderRadius: R.md, padding: '11px 14px' }}>
              <p style={{ fontSize: 12, color: '#6B3A0A', lineHeight: 1.45 }}>
                Only enable a private repository if you have the right to share it.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
