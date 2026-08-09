'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
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

        {/* Granted repos */}
        {grants.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Granted repos</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grants.map((g) => (
                <div key={g.id} style={{ padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.textSub, fontFamily: F.mono }}>
                  {g.repo_full_name}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evidence */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            Skill evidence ({evidence.length})
          </h2>
          {evidence.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textFaint }}>No evidence yet — connect GitHub and scan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evidence.map((e) => {
                const name = e.skills?.canonical_name ?? e.skill_id
                const c = tagColor(name)
                return (
                  <Card key={e.id} hoverable={false} padding={16}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                          {name}
                        </span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{levelLabel(e.difficulty_cleared)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        <span>base {e.base}</span>
                        <span>{e.verification_method}</span>
                      </div>
                    </div>
                  </Card>
                )
              })}
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
