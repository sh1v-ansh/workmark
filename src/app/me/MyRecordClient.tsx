'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker, Stat } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
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

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        {/* Left third: the anchor — who, how much, and the controls you set
            once. Right two thirds: the content those numbers summarize. */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 26, alignItems: 'start' }} className="mob-1col">

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div>
              <h1 style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 6 }}>
                Your record
              </h1>
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
                Everything Workmark knows you can do, and where each piece came from. Only you see this full view.
              </p>
            </div>

            {trackRecord.closeOutRate !== null && (
              <Card hoverable={false} padding={17}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Stat value={`${Math.round(trackRecord.closeOutRate * 100)}%`} label="close-out rate" />
                  <div style={{ display: 'flex', gap: 22, borderTop: `1px solid ${C.borderFaint}`, paddingTop: 12 }}>
                    <Stat value={trackRecord.closed} label="completed" />
                    {trackRecord.abandoned > 0 && <Stat value={trackRecord.abandoned} label="abandoned" />}
                  </div>
                </div>
                <p style={{ fontSize: 11.5, color: C.textGhost, lineHeight: 1.45, marginTop: 11 }}>
                  Counts hidden engagements too — a percentage over a total nobody sees reveals nothing about which projects exist.
                </p>
              </Card>
            )}

            <Card hoverable={false} padding={17}>
              <Kicker style={{ marginBottom: 8 }}>Public profile</Kicker>
              <p style={{ fontSize: 12.5, color: C.textFaint, lineHeight: 1.45, marginBottom: 12 }}>
                {student.handle
                  ? 'Anyone with this link sees your verified skills and the work you chose to show.'
                  : 'Claim a handle for a shareable link. Until then, your record is private.'}
              </p>

              {student.handle && profileUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Link href={`/p/${student.handle}`} style={{ fontSize: 12.5, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
                    /p/{student.handle}
                  </Link>
                  <button
                    onClick={() => { navigator.clipboard.writeText(profileUrl); toast('Link copied.', 'success') }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                  >
                    <Icon name="link" size={11} /> Copy
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: C.textGhost }}>/p/</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="dk-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="your-handle"
                  aria-label="Profile handle"
                />
              </div>
              <div style={{ marginTop: 9 }}>
                <Button
                  variant="ink" size="sm" fullWidth
                  onClick={saveHandle}
                  disabled={!handle.trim() || handle === student.handle}
                  busyLabel={savingHandle ? 'Saving…' : null}
                >
                  {student.handle ? 'Change' : 'Claim'}
                </Button>
              </div>
              {student.handle && (
                <p style={{ fontSize: 11.5, color: state.caution, marginTop: 9, lineHeight: 1.45 }}>
                  Changing your handle breaks every link you&apos;ve already shared.
                </p>
              )}
            </Card>

            <Card hoverable={false} padding={14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/me/briefs" style={{ fontSize: 12.5, color: C.textSub, textDecoration: 'none' }}>Project ideas →</Link>
                <Link href="/me/file" style={{ fontSize: 12.5, color: C.textSub, textDecoration: 'none' }}>Your file &amp; disputes →</Link>
                <Link href="/student/github" style={{ fontSize: 12.5, color: C.textSub, textDecoration: 'none' }}>Evidence source &amp; rescan →</Link>
              </div>
            </Card>
          </div>

          <div>
            {/* Verified skills */}
            <div style={{ marginBottom: 28 }}>
              <Kicker style={{ marginBottom: 5 }}>Verified skills · {skills.length}</Kicker>
              <p style={{ fontSize: 12.5, color: C.textGhost, marginBottom: 11 }}>
                Open one to see which projects it came from. Levels above Strong need attestation, which isn&apos;t live yet.
              </p>
              {skills.length === 0 ? (
                <Card hoverable={false} padding={17}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 13, color: C.textMuted }}>Nothing yet — link your repositories and scan.</p>
                    <Button href="/student/github" variant="outline" size="sm">Link repos</Button>
                  </div>
                </Card>
              ) : (
                <Card hoverable={false} padding="3px 18px 6px">
                  {skills.map((s, i) => {
                    const expanded = expandedSkill === s.skillId
                    const from = sources.filter((src) => src.skillId === s.skillId)
                    return (
                      <div key={s.skillId} style={{ borderBottom: i < skills.length - 1 ? `1px solid ${C.borderFaint}` : 'none' }}>
                        <button
                          onClick={() => setExpandedSkill(expanded ? null : s.skillId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', textAlign: 'left', font: 'inherit' }}
                          aria-expanded={expanded}
                        >
                          <span style={{ flexGrow: 1, minWidth: 0 }}>
                            <span style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{s.name}</span>
                          </span>
                          <span style={{ fontSize: 12.5, color: C.textMuted, width: 78, flexShrink: 0 }}>{LEVEL_NAMES[s.bestLevel] ?? s.bestLevel}</span>
                          <span style={{ fontSize: 12, color: C.textGhost, width: 68, flexShrink: 0, textAlign: 'right' }}>{s.artifactCount} project{s.artifactCount === 1 ? '' : 's'}</span>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : undefined }}>
                            <path d="M4 6l4 4 4-4" stroke={C.textGhost} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {expanded && (
                          <div style={{ paddingBottom: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {from.map((src, j) => (
                              <div key={`${src.repoFullName}-${j}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: C.bg, borderRadius: R.md, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12.5, color: C.textSub }}>{src.repoFullName ?? 'Non-code work'}</span>
                                <span style={{ fontSize: 11.5, color: C.textGhost }}>
                                  {[TIER_LABEL[src.tier ?? ''] ?? src.tier, LEVEL_NAMES[src.level], src.verificationMethod].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card>
              )}
            </div>

            {/* Projects behind the record */}
            {byRepo.size > 0 && (
              <div style={{ marginBottom: 28 }}>
                <Kicker style={{ marginBottom: 11 }}>Projects · {byRepo.size}</Kicker>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} className="mob-1col">
                  {Array.from(byRepo.entries()).map(([repo, entries]) => (
                    <Card key={repo} hoverable={false} padding={14}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3, wordBreak: 'break-word' }}>{repo}</p>
                      <p style={{ fontSize: 11.5, color: C.textGhost, marginBottom: 9 }}>
                        {TIER_LABEL[entries[0]?.tier ?? ''] ?? entries[0]?.tier}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {entries.map((e, i) => {
                          const c = tagColor(e.skillName)
                          return (
                            <span key={`${e.skillId}-${i}`} style={{ fontSize: 11, padding: '3px 8px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                              {e.skillName}
                            </span>
                          )
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Engagements, including hidden — this is the private view */}
            {engagements.length > 0 && (
              <div>
                <Kicker style={{ marginBottom: 5 }}>Collaborations · {engagements.length}</Kicker>
                <p style={{ fontSize: 12.5, color: C.textGhost, marginBottom: 11 }}>
                  Change what each one shows publicly from the engagement page.
                </p>
                <Card hoverable={false} padding="3px 18px 6px">
                  {engagements.map((e, i) => (
                    <Link
                      key={e.id} href={`/engagements/${e.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '12px 0', borderBottom: i < engagements.length - 1 ? `1px solid ${C.borderFaint}` : 'none', textDecoration: 'none' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>{e.listingTitle ?? 'Untitled project'}</p>
                        <p style={{ fontSize: 12, color: C.textGhost }}>
                          {[e.posterDisplayName, STAGE_LABEL[e.stage as Stage] ?? e.stage].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Badge>{e.visibility}</Badge>
                    </Link>
                  ))}
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
