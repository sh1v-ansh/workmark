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
import type { StudentRecord } from '@/lib/profile/record'
import { STAGE_LABEL, type Stage } from '@/lib/engagements/lifecycle'

interface EvidenceSource {
  skillId: string
  skillName: string
  level: number
  repoFullName: string | null
  tier: string | null
  deploymentUrl: string | null
  verificationMethod: string
  fromEngagement: boolean
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Familiar', 2: 'Practiced', 3: 'Strong', 4: 'Advanced', 5: 'Expert' }
const TIER_LABEL: Record<string, string> = {
  tier_0: 'Solo project',
  tier_0_5: 'Multi-contributor project',
  listing_driven: 'Collaboration on Workmark',
}

export default function MyRecordClient({ record, sources, suggestedHandle }: {
  record: StudentRecord
  sources: EvidenceSource[]
  suggestedHandle: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { student, skills, engagements, trackRecord } = record

  const [handle, setHandle] = useState(student.handle ?? suggestedHandle)
  const [savingHandle, setSavingHandle] = useState(false)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)

  const profileUrl = student.handle
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/p/${student.handle}`
    : null

  async function saveHandle() {
    setSavingHandle(true)
    try {
      const res = await fetch('/api/profile/handle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save.')
      toast('Your public profile is live.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setSavingHandle(false)
    }
  }

  // Group evidence by repo so the "where did this come from" answer is
  // per-project rather than a flat list that repeats skill names.
  const byRepo = new Map<string, EvidenceSource[]>()
  for (const s of sources) {
    const key = s.repoFullName ?? '(no repo)'
    if (!byRepo.has(key)) byRepo.set(key, [])
    byRepo.get(key)!.push(s)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={student.fullName ?? undefined} />

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
            Your record
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            Everything Workmark knows you can do, and where each piece came from. This is the full, unredacted view — only you see it.
          </p>
        </div>

        {/* Public profile / handle */}
        <Card hoverable={false} padding={24}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Public profile</h2>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/me/briefs" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
                Project ideas →
              </Link>
              <Link href="/me/file" style={{ fontSize: 12, fontFamily: F.mono, color: C.accent, textDecoration: 'none' }}>
                Your file &amp; disputes →
              </Link>
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.5 }}>
            {student.handle
              ? 'Anyone with this link can see your verified skills and the work you chose to show. Nothing else.'
              : 'Claim a handle to get a shareable link to your verified record. Until you do, your record is private.'}
          </p>

          {student.handle && profileUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <Link href={`/p/${student.handle}`} style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontFamily: F.mono }}>
                /p/{student.handle}
              </Link>
              <button
                onClick={() => { navigator.clipboard.writeText(profileUrl); toast('Link copied.', 'success') }}
                className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}
              >
                <Icon name="link" size={12} /> Copy link
              </button>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: C.textFaint, fontFamily: F.mono }}>/p/</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="dk-input"
              style={{ flex: 1, minWidth: 180, fontFamily: F.mono }}
              placeholder="your-handle"
              aria-label="Profile handle"
            />
            <button onClick={saveHandle} disabled={savingHandle || !handle.trim() || handle === student.handle} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              {savingHandle ? 'Saving…' : student.handle ? 'Change' : 'Claim'}
            </button>
          </div>
          {student.handle && (
            <p style={{ fontSize: 11, color: '#B45309', marginTop: 8, lineHeight: 1.5 }}>
              Changing your handle breaks every link you&apos;ve already shared.
            </p>
          )}
        </Card>

        {/* Track record */}
        {trackRecord.closeOutRate !== null && (
          <Card hoverable={false} padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{Math.round(trackRecord.closeOutRate * 100)}%</p>
                <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>close-out rate</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{trackRecord.closed}</p>
                <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>completed</p>
              </div>
              {trackRecord.abandoned > 0 && (
                <div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: C.textMuted, fontFamily: F.mono }}>{trackRecord.abandoned}</p>
                  <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>abandoned</p>
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: C.textFaint, marginTop: 12, lineHeight: 1.5 }}>
              Your rate counts hidden engagements too — a percentage over a total nobody sees reveals nothing about which projects exist.
            </p>
          </Card>
        )}

        {/* Verified skills */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Verified skills ({skills.length})</h2>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
            Click one to see which projects it came from. Levels above Strong need attestation from faculty or an employer, which isn&apos;t live yet.
          </p>
          {skills.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 13, color: C.textFaint }}>Nothing yet — link your repos and scan.</p>
                <Link href="/student/github" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                  <Icon name="github" size={12} /> Link repos
                </Link>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skills.map((s) => {
                const c = tagColor(s.name)
                const expanded = expandedSkill === s.skillId
                const from = sources.filter((src) => src.skillId === s.skillId)
                return (
                  <Card key={s.skillId} hoverable={false} padding={14}>
                    <button
                      onClick={() => setExpandedSkill(expanded ? null : s.skillId)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flexWrap: 'wrap' }}
                      aria-expanded={expanded}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                          {s.name}
                        </span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{LEVEL_NAMES[s.bestLevel] ?? s.bestLevel}</span>
                      </span>
                      <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {s.artifactCount} project{s.artifactCount === 1 ? '' : 's'} {expanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {expanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {from.map((src, i) => (
                          <div key={`${src.repoFullName}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>
                              {src.repoFullName ?? 'Non-code work'}
                            </span>
                            <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                              {[TIER_LABEL[src.tier ?? ''] ?? src.tier, LEVEL_NAMES[src.level], src.verificationMethod].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Projects behind the record */}
        {byRepo.size > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Projects ({byRepo.size})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from(byRepo.entries()).map(([repo, entries]) => (
                <Card key={repo} hoverable={false} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.mono }}>{repo}</span>
                    <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                      {TIER_LABEL[entries[0]?.tier ?? ''] ?? entries[0]?.tier}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {entries.map((e, i) => {
                      const c = tagColor(e.skillName)
                      return (
                        <span key={`${e.skillId}-${i}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                          {e.skillName}
                        </span>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Engagements, including hidden — this is the private view */}
        {engagements.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Collaborations ({engagements.length})</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Change what each one shows publicly from the engagement page.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {engagements.map((e) => (
                <Card key={e.id} href={`/engagements/${e.id}`} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.listingTitle ?? 'Untitled project'}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {[e.posterDisplayName, STAGE_LABEL[e.stage as Stage] ?? e.stage].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {e.visibility}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
