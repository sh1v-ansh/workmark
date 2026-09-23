'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import { levelName as levelLabel } from '@/lib/skills/level-names'
import { LAYOUT } from '@/lib/theme/layout'
import UnclaimedEmails, { type UnclaimedEmailRow } from './UnclaimedEmails'
import GithubConnectNotice from '@/components/GithubConnectNotice'

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
  primary_language: string | null
  rank_reason: string | null
  rank_score: number | null
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



interface ReviewRequest {
  id: string
  url: string
  note: string
  status: string
  requested_at: string
  review_note: string | null
}

const REVIEW_TONE = { approved: 'positive', rejected: 'neutral', pending: 'info' } as const

/**
 * A serverless timeout does not return JSON — it returns an HTML or plain
 * text gateway error. Calling res.json() on that throws a parse error, and
 * the student sees "Unexpected token '<'" instead of being told the scan
 * ran out of time. Translate it into something true and actionable.
 */
async function readJson(res: Response) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (res.status === 504 || res.status === 502 || /timeout/i.test(text)) {
      throw new Error('The scan ran longer than the server allows and was cut off. Anything already scanned was saved — run it again to continue.')
    }
    throw new Error(`Unexpected response from the server (${res.status}).`)
  }
}

interface JobStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
  detail?: string | null
}

interface JobView {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  steps: JobStep[]
  total_steps: number
  completed_steps: number
  result: { total?: number; failed?: number } | null
  error: string | null
}

export default function GithubScanClient({ studentName, connection, grants, priors, evidence, reviewRequests, unclaimedEmails, activeJobId, lastJob }: {
  studentName: string | null
  connection: GithubConnection | null
  grants: RepoGrant[]
  priors: SkillPrior[]
  evidence: SkillEvidenceRow[]
  reviewRequests: ReviewRequest[]
  unclaimedEmails: UnclaimedEmailRow[]
  activeJobId: string | null
  /** The last scan that finished, so its per-repo results survive a reload. */
  lastJob: JobView | null
}) {
  const { toast } = useToast()
  const router = useRouter()

  /**
   * Which of the three jobs this page does is on screen.
   *
   * ── Why this page needed splitting ──────────────────────────────────────
   * It was one column with four stacked sections: every repository with a
   * switch, every skill grouped by repo, the form for work that has no
   * repository, and a list of unverified skills. With thirty-three repos the
   * first section alone was most of a screen, so the form for submitting
   * design or research work — the thing a student with no scannable code
   * needs — sat below several hundred pixels of settings they had already
   * dealt with once.
   *
   * These are three different jobs at three different frequencies: choosing
   * what may be read is done once, reading the results is done often, and
   * submitting other work is an action. Stacking them made the rarest one
   * cheapest to reach.
   *
   * ── Why it opens where it does ──────────────────────────────────────────
   * On the results, once there are any. Somebody who has scanned comes back
   * to see what came out; somebody who has not has nothing to look at and
   * needs the repository list.
   */
  const [tab, setTab] = useState<'repos' | 'evidence' | 'other'>(
    evidence.length > 0 ? 'evidence' : 'repos',
  )

  // Just back from connecting: the repositories are the next thing, whatever
  // the default would otherwise be. Read after mount, like the notice, so
  // the page does not need a Suspense boundary for one flag.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('gh_connected')) setTab('repos')
  }, [])

  /** Narrows a long repository list. Thirty-three rows needs it; three hundred demands it. */
  const [repoQuery, setRepoQuery] = useState('')
  const [repoFilter, setRepoFilter] = useState<'all' | 'on' | 'off'>('all')

  const [scanning, setScanning] = useState(false)
  const [jobId, setJobId] = useState<string | null>(activeJobId)
  // Seeded with the last finished scan, so its per-repo results are on
  // screen after a reload rather than only in the visit that ran it.
  const [job, setJob] = useState<JobView | null>(lastJob)
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
      const json = await readJson(res)
      if (!res.ok) throw new Error(json?.error ?? 'Could not submit.')
      toast('Submitted for review.', 'success')
      setReviewUrl(''); setReviewNote('')
      router.refresh()
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
      // scan_choice as well as scan_enabled: the flag alone gets recomputed
      // by the next sync, so without recording that this was a person's
      // decision, turning a repo off lasted until the page reloaded.
      .update({ scan_enabled: next, scan_choice: next ? 'on' : 'off' })
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

  // Poll whichever scan job is in flight — one queued just now, or one that
  // was already running when this page loaded. The scan happens on the
  // server one repo at a time, so this is the only thing that knows how far
  // it has got; without it the student is back to staring at a spinner.
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    setScanning(true)

    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
        const json = await readJson(res)
        if (!res.ok) throw new Error(json?.error ?? 'Lost track of the scan.')
        if (cancelled) return
        const next = json.job as JobView
        setJob(next)
        if (next.status === 'succeeded' || next.status === 'failed' || next.status === 'cancelled') {
          const failed = next.result?.failed ?? 0
          const total = next.result?.total ?? next.total_steps
          toast(
            next.status === 'cancelled'
              ? 'Scan stopped.'
              : next.status === 'failed'
              ? next.error ?? 'The scan could not read any of your repos — try again in a minute.'
              : failed > 0
                ? `Scan complete — ${total - failed} of ${total} repo(s) read. ${failed} failed and can be retried.`
                : `Scan complete — ${total} repo(s) read.`,
            next.status === 'failed' ? 'error' : next.status === 'cancelled' ? 'info' : failed > 0 ? 'info' : 'success',
          )
          setScanning(false)
          setJobId(null)
          // Re-render the server component so the new evidence appears,
          // without a full reload (which would tear down the toast above
          // before it could be read).
          router.refresh()
          return
        }
      } catch {
        // A single failed poll is not a failed scan — the job keeps running
        // server-side regardless. Stay quiet and try again on the next tick.
      }
      if (!cancelled) timer = setTimeout(tick, 2500)
    }

    let timer = setTimeout(tick, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [jobId, router, toast])

  async function stopScan() {
    if (!confirm('Stop this scan? Repos already read stay on your record; the rest are discarded.')) return
    try {
      const res = await fetch('/api/github/scan', { method: 'DELETE' })
      const json = await readJson(res)
      if (!res.ok) throw new Error(json?.error ?? 'Could not stop it.')
      toast(json.message, 'info')
      setJobId(null)
      setScanning(false)
      setJob(null)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not stop it.', 'error')
    }
  }

  async function runScan() {
    setScanning(true)
    setJob(null)
    try {
      const res = await fetch('/api/github/scan', { method: 'POST' })
      const json = await readJson(res)
      if (!res.ok) throw new Error(json?.error ?? 'Scan failed.')
      // The request only queues the work — the effect above takes it from
      // here. Nothing is awaited on this path, so the student is free to
      // navigate away; the scan finishes without them.
      setJobId(json.jobId)
      toast(
        json.alreadyRunning
          ? 'A scan is already running — showing its progress.'
          : `Scanning ${json.totalSteps} repo(s) in the background. You can leave this page.`,
        'info',
      )
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Scan failed.', 'error')
      setScanning(false)
    }
  }

  const currentStepLabel = job?.steps.find((s) => s.status === 'pending' || s.status === 'running')?.label ?? null

  const evidenceByRepo = Array.from(
    evidence.reduce((byRepo, e) => {
      const repo = e.artifacts?.repo_full_name ?? '(unknown repo)'
      if (!byRepo.has(repo)) byRepo.set(repo, [])
      byRepo.get(repo)!.push(e)
      return byRepo
    }, new Map<string, SkillEvidenceRow[]>()),
  )

  const hasPending = reviewRequests.some((r) => r.status === 'pending')

  const isOn = (g: RepoGrant) => overrides[g.id] ?? g.scan_enabled
  const enabledCount = grants.filter(isOn).length

  // Search first, then the on/off filter. A student looking for one repo by
  // name does not want it hidden because it happens to be switched off.
  const visibleGrants = grants.filter((g) => {
    const q = repoQuery.trim().toLowerCase()
    if (q && !g.repo_full_name.toLowerCase().includes(q)) return false
    if (repoFilter === 'on') return isOn(g)
    if (repoFilter === 'off') return !isOn(g)
    return true
  })

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        <div style={{ marginBottom: 18 }}>
          {/* The old heading was "Choose what we may read", which named one
              of the three things this page does and made the other two look
              like they belonged somewhere else. */}
          <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 9 }}>
            Your work
          </h1>
          <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, maxWidth: 630 }}>
            Everything on your record comes from code you wrote, or from work a person checked. You choose which repositories Workmark may read, and each scan is the current answer: switch a repository off and its skills come off your record at the next scan.
          </p>
        </div>

        {/* Above the tabs, because it is the answer to the question
            somebody arrives with — "why is my work not showing up" — and
            that thought does not belong to one tab. */}
        <GithubConnectNotice />
        <UnclaimedEmails rows={unclaimedEmails} />

        <div className="wm-tabs" role="tablist" style={{ marginBottom: 20 }}>
          {([
            ['evidence', `Your skills${evidence.length > 0 ? ` · ${evidence.length}` : ''}`],
            ['repos', `Repositories${grants.length > 0 ? ` · ${enabledCount}/${grants.length}` : ''}`],
            ['other', 'Work without code'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`wm-tab${tab === key ? ' wm-tab-on' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <UnclaimedEmails rows={unclaimedEmails} />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 22, alignItems: 'start' }} className="mob-1col">

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Granted repos. Public repos are already world-readable, so
                they're scanned unconditionally. Private ones are the consent
                question — being granted access via GitHub's install picker
                isn't the same as saying "this is mine to share", and a
                private repo may well be an employer's IP. Combined into one
                list, ordered public-first, because the visibility badge
                already tells the story per row. */}
            {tab === 'repos' && grants.length === 0 && (
              <Card hoverable={false} padding={19.5}>
                <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 5 }}>
                  No repositories yet
                </p>
                <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 15, maxWidth: '58ch' }}>
                  {connection
                    ? 'GitHub is connected but has not shared any repositories with Workmark. Open the GitHub app settings and pick which ones it may see.'
                    : 'Connect GitHub and choose which repositories Workmark may read. Nothing is read until you say so.'}
                </p>
                <Button href={connection ? 'https://github.com/settings/installations' : '/student/github/consent'} variant="ink" size="sm">
                  {connection ? 'Choose repositories on GitHub' : 'Connect GitHub'}
                </Button>
              </Card>
            )}

            {tab === 'repos' && grants.length > 0 && (
              <div>
                {/* Said first, not last. This used to be a paragraph below
                    the list, which on a thirty-three repo account meant the
                    one sentence explaining the privacy rule was off the
                    bottom of the screen while the switches were on it. */}
                <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 13, maxWidth: 620 }}>
                  Private repositories are off until you turn them on — only enable ones you have
                  the right to share, never an employer&apos;s code. Public ones are ranked and the
                  most useful are on by default. Your choice always wins.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input
                    value={repoQuery}
                    onChange={(e) => setRepoQuery(e.target.value)}
                    className="dk-input"
                    placeholder="Find a repository…"
                    aria-label="Find a repository"
                    style={{ flex: '1 1 220px', maxWidth: 320 }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([['all', 'All'], ['on', 'On'], ['off', 'Off']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRepoFilter(key)}
                        aria-pressed={repoFilter === key}
                        className={`wm-pill${repoFilter === key ? ' wm-pill-on' : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: C.textGhost, marginLeft: 'auto' }}>
                    {syncing ? 'syncing with GitHub…' : `${enabledCount} of ${grants.length} enabled`}
                  </span>
                </div>

                <Card hoverable={false} padding="3.5px 18px 7px">
                  {visibleGrants.length === 0 && (
                    <p style={{ fontSize: 13.5, color: C.textMuted, padding: '14px 0' }}>
                      No repositories match that.
                    </p>
                  )}
                  {visibleGrants.map((g, i) => {
                    // Every repo gets a real switch now. Public ones used to
                    // read "Always scanned", which stopped being true when
                    // ranking started deciding what's on by default — and
                    // someone with 300 repos needs to be able to say which
                    // ones matter.
                    const enabled = overrides[g.id] ?? g.scan_enabled
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '12.5px 0', borderBottom: i < visibleGrants.length - 1 ? `1px solid ${C.borderFaint}` : 'none' }}>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8.5, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.repo_full_name}</span>
                            <Badge tone={g.is_private ? 'caution' : 'neutral'}>{g.is_private ? 'Private' : 'Public'}</Badge>
                            {g.primary_language && <span style={{ fontSize: 12, color: C.textGhost }}>{g.primary_language}</span>}
                          </div>
                          {/* Why this repo is on or off. The override is what
                              makes a default cut fair, so the reason has to
                              be visible rather than tucked away. */}
                          {g.rank_reason && (
                            <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.45 }}>{g.rank_reason}</p>
                          )}
                        </div>
                        <button
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Scan ${g.repo_full_name}`}
                          disabled={togglingId === g.id}
                          onClick={() => toggleScanEnabled(g.id, !enabled)}
                          style={{
                            flexShrink: 0, width: 37, height: 22, borderRadius: 999, position: 'relative', border: 'none',
                            cursor: togglingId === g.id ? 'wait' : 'pointer',
                            background: enabled ? C.accent : C.border,
                            transition: 'background 0.15s',
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: 3, left: enabled ? 18.5 : 3, width: 16, height: 16, borderRadius: 999,
                            background: '#fff', transition: 'left 0.15s',
                          }} />
                        </button>
                      </div>
                    )
                  })}
                </Card>
              </div>
            )}

            {/* Evidence — grouped by repo, since the same skill legitimately
                gets one row per repo that demonstrates it (independent
                evidence, independent level), which reads as "duplicates"
                without knowing which repo each one came from. */}
            {tab === 'evidence' && (
            <div>
              <Kicker style={{ marginBottom: 12 }}>Skill evidence · {evidence.length}</Kicker>
              {evidence.length === 0 ? (
                <Card hoverable={false} padding={19.5}>
                  <p style={{ fontSize: 14, color: C.textMuted }}>No evidence yet — connect GitHub and scan.</p>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {evidenceByRepo.map(([repo, rows]) => (
                    <Card key={repo} hoverable={false} padding={16}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, wordBreak: 'break-word' }}>{repo}</span>
                        {rows[0]?.artifacts?.deployment_url ? (
                          <a href={rows[0].artifacts.deployment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                            {rows[0].verification_method} ↗
                          </a>
                        ) : repo !== '(unknown repo)' ? (
                          <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                            repo link ↗
                          </a>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6.5 }}>
                        {rows.map((e) => {
                          const name = e.skills?.canonical_name ?? e.skill_id
                          const c = tagColor(name)
                          return (
                            <span key={e.id} style={{ fontSize: 12, fontWeight: 600, padding: '3.5px 9.5px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
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
            )}

            {/* Human review — §3's fallback for work with no scannable repo.
                Its own tab now. It used to sit under every repository and
                every skill, which put the one route available to a student
                with no scannable code at the very bottom of the page. */}
            {tab === 'other' && (
            <div>
              <Kicker style={{ marginBottom: 5.5 }}>Work without a repo</Kicker>
              <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginBottom: 13, maxWidth: 540 }}>
                Design work, research, anything we can&apos;t read from code. Submit it and a person will look at it — slower than a scan, but it counts the same once approved.
              </p>

              {reviewRequests.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7.5, marginBottom: hasPending ? 0 : 15 }}>
                  {reviewRequests.map((r) => (
                    <Card key={r.id} hoverable={false} padding="11px 14.5px">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                          {r.url}
                        </a>
                        <Badge tone={REVIEW_TONE[r.status as keyof typeof REVIEW_TONE] ?? 'neutral'}>{r.status}</Badge>
                      </div>
                      {r.review_note && (
                        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8.5, lineHeight: 1.5 }}>{r.review_note}</p>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {!hasPending && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8.5, marginTop: reviewRequests.length > 0 ? 13 : 0 }}>
                  <input
                    value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                    className="dk-input" placeholder="https://link-to-your-work" aria-label="Link to the work"
                  />
                  <textarea
                    value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3}
                    className="dk-textarea" style={{ fontFamily: 'inherit', fontSize: 14 }}
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
            )}

            {/* Skills detected in repos the student hasn't personally
                committed to. Shown only when there are any, and kept plain
                — no internal scoring vocabulary in the UI. */}
            {tab === 'evidence' && priors.length > 0 && (
              <div>
                <Kicker style={{ marginBottom: 5.5 }}>Detected but unverified</Kicker>
                <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginBottom: 11, maxWidth: 540 }}>
                  Found in your repositories, but not yet backed by your own commits — so these don&apos;t count toward your record yet.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5.5 }}>
                  {priors.map((p) => {
                    const name = p.skills?.canonical_name ?? p.skill_id
                    const c = tagColor(name)
                    return (
                      <span key={p.id} style={{ fontSize: 12, padding: '3px 8.5px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text, opacity: 0.7 }}>
                        {name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14.5 }}>
            <Card hoverable={false} padding={19.5}>
              {connection ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10.5, marginBottom: 14.5 }}>
                    <div style={{ width: 35, height: 35, borderRadius: R.md, background: '#EDE9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}>
                      <Icon name="github" size={17} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Connected as {connection.github_login ?? '(unknown)'}
                      </p>
                      <p style={{ fontSize: 13, color: C.textFaint }}>{grants.length} repo{grants.length === 1 ? '' : 's'} granted</p>
                    </div>
                  </div>
                  <Button variant="ink" size="sm" fullWidth onClick={runScan} busyLabel={scanning ? 'Scanning…' : null}>
                    Scan now
                  </Button>
                  {scanning && (
                    <div style={{ marginTop: 12 }}>
                      {/* Named progress, not a spinner: a scan can take minutes,
                          and "3 of 7 · acme/api" is the difference between
                          waiting and wondering whether it's stuck. */}
                      <div style={{ height: 4, borderRadius: R.pill, background: C.border, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${job && job.total_steps > 0 ? Math.round((job.completed_steps / job.total_steps) * 100) : 4}%`,
                            background: C.accent,
                            transition: 'width 400ms ease',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: 12.5, color: C.textFaint, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job
                          ? `${job.completed_steps} of ${job.total_steps}${currentStepLabel ? ` · ${currentStepLabel}` : ''}`
                          : 'Queueing…'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 3 }}>
                        <p style={{ fontSize: 12.5, color: C.textFaint }}>
                          Runs in the background — you can leave this page.
                        </p>
                        <button
                          type="button"
                          onClick={stopScan}
                          style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12.5, color: C.textFaint, textDecoration: 'underline', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  )}
                  {/* What each repository actually produced.
                      The step results were written and never rendered, so
                      "the rescan changed nothing" was a sentence nobody
                      could check — including me, for three rounds. A repo
                      that recorded nine skills, one that had no commits we
                      could attribute, and one GitHub cut us off partway
                      through all looked identical from out here. */}
                  {job && job.steps.some((st) => st.detail) && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${C.borderFaint}`, paddingTop: 12 }}>
                      <Kicker style={{ marginBottom: 8 }}>Last scan</Kicker>
                      <div style={{ display: 'grid', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
                        {job.steps.filter((st) => st.detail).map((st) => (
                          <div key={st.id}>
                            <p style={{ fontSize: 12.5, fontWeight: 600, color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {st.label}
                            </p>
                            <p style={{
                              fontSize: 12.5, lineHeight: 1.45,
                              color: st.status === 'failed' ? '#B91C1C' : C.textGhost,
                            }}>
                              {st.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 13 }}>Not connected yet.</p>
                  <a href="/api/github/app/install" className="nb-btn nb-btn-ink" style={{ width: '100%' }}>
                    <Icon name="github" size={13.5} /> Connect GitHub
                  </a>
                </>
              )}
            </Card>

            <Card hoverable={false} padding={19.5}>
              <Kicker style={{ marginBottom: 9 }}>What a scan reads</Kicker>
              <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.6 }}>
                Only commits attributed to your GitHub identity. Forks with no commits of yours are skipped. We look at what the code does, not how much of it there is.
              </p>
            </Card>

            <div style={{ background: state.cautionBg, borderRadius: R.md, padding: '12px 15px' }}>
              <p style={{ fontSize: 13, color: '#6B3A0A', lineHeight: 1.5 }}>
                Only enable a private repository if you have the right to share it.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
