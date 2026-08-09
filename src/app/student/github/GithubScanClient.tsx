'use client'

import { useState } from 'react'
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

export default function GithubScanClient({ studentName, connection, grants, priors, evidence }: {
  studentName: string | null
  connection: GithubConnection | null
  grants: RepoGrant[]
  priors: SkillPrior[]
  evidence: SkillEvidenceRow[]
}) {
  const { toast } = useToast()
  const [scanning, setScanning] = useState(false)
  const [repoStates, setRepoStates] = useState<Record<string, boolean>>(
    () => Object.fromEntries(grants.map((g) => [g.id, g.scan_enabled])),
  )
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function toggleScanEnabled(grantId: string, next: boolean) {
    setTogglingId(grantId)
    const previous = repoStates[grantId]
    setRepoStates((prev) => ({ ...prev, [grantId]: next })) // optimistic
    const supabase = createClient()
    // RLS ("Students: manage own repo grants", for all) lets a student
    // update their own grant rows directly — this doesn't need to go
    // through a service-role API route.
    const { error } = await supabase.from('github_repo_grants').update({ scan_enabled: next }).eq('id', grantId)
    if (error) {
      setRepoStates((prev) => ({ ...prev, [grantId]: previous })) // revert
      toast('Failed to update — please try again.', 'error')
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

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={studentName ?? undefined} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            GitHub evidence engine — verification view
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Phase 1 debug page. The polished version of this lives on your public profile once that's built.
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

        {/* Granted repos — being granted via GitHub's install picker is not
            by itself consent to scan. Each repo needs an explicit opt-in
            here, particularly private ones (default off) which might be
            an employer's IP rather than the student's own to share. */}
        {grants.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Granted repos ({grants.length})
            </h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Pick which repos to actually scan. Private repos default to off — only enable ones you have the right to share (not an employer's private code, for example).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grants.map((g) => {
                const enabled = repoStates[g.id] ?? g.scan_enabled
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
                      color: g.is_private ? '#B45309' : C.textFaint,
                      background: g.is_private ? 'rgba(217,119,6,0.1)' : C.surface,
                      border: `1px solid ${g.is_private ? 'rgba(217,119,6,0.3)' : C.border}`,
                    }}>
                      {g.is_private ? 'Private' : 'Public'}
                    </span>
                  </label>
                )
              })}
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
                    ) : (
                      <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>{rows[0]?.verification_method}</span>
                    )}
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

        {/* Priors */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            Raw priors ({priors.length}) — displayed separately, never summed into tier_weight
          </h2>
          {priors.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textFaint }}>None yet.</p>
          ) : (
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
          )}
        </section>
      </main>
    </div>
  )
}
