'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker, Stat } from '@/components/ui/Section'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C, F, state } from '@/lib/theme/dark-tokens'
import type { StudentRecord } from '@/lib/profile/record'
import { STAGE_LABEL, type Stage } from '@/lib/engagements/lifecycle'
import RescanButton from '@/components/RescanButton'
import SearchableBox from '@/components/ui/SearchableBox'
import SkillChip, { PlainChip } from '@/components/skills/SkillChip'
import LevelBar, { countLevels } from '@/components/skills/LevelBar'
import SkillEvidenceModal from '@/components/skills/SkillEvidenceModal'
import { SELF_EVIDENCED_CAP } from '@/lib/skills/level-names'
import { LAYOUT } from '@/lib/theme/layout'

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


const TIER_LABEL: Record<string, string> = {
  tier_0: 'Solo project',
  tier_0_5: 'Multi-contributor project',
  listing_driven: 'Collaboration on Workmark',
}

/**
 * Verification methods were rendering as their raw database values —
 * 'repo_link', 'human_review'. These are read by students disputing their
 * own record, so they have to be words.
 */
/** Strongest first. The order here is the order on the page. */
const SKILL_GROUPS = [
  { key: 'advanced', label: 'Advanced' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'beginner', label: 'Beginner' },
] as const

function groupOf(level: number): (typeof SKILL_GROUPS)[number]['key'] {
  if (level >= SELF_EVIDENCED_CAP) return 'advanced'
  if (level === 2) return 'intermediate'
  return 'beginner'
}

const VERIFICATION_LABEL: Record<string, string> = {
  repo_link: 'Link',
  deployment: 'Deployed',
  package: 'Published package',
  ci: 'CI',
  human_review: 'Reviewed by a person',
  attested: 'Confirmed by a collaborator',
}

export default function MyRecordClient({ record, sources, suggestedHandle, githubConnected, lastScannedAt }: {
  record: StudentRecord
  sources: EvidenceSource[]
  suggestedHandle: string
  githubConnected: boolean
  lastScannedAt: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { student, skills, engagements, trackRecord } = record

  const [handle, setHandle] = useState(student.handle ?? suggestedHandle)
  const [editingHandle, setEditingHandle] = useState(false)
  const [savingHandle, setSavingHandle] = useState(false)
  const [openSkill, setOpenSkill] = useState<string | null>(null)
  const [skillQuery, setSkillQuery] = useState('')
  const [repoQuery, setRepoQuery] = useState('')

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
  const byRepo = useMemo(() => {
    const map = new Map<string, EvidenceSource[]>()
    for (const s of sources) {
      const key = s.repoFullName ?? '(no repo)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [sources])

  const levelCounts = useMemo(() => countLevels(skills), [skills])

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    if (!q) return skills
    return skills.filter((s) => s.name.toLowerCase().includes(q))
  }, [skills, skillQuery])

  // Searching projects also searches the skills inside them, because "which
  // project was my Docker one" is the question people actually have and the
  // repository name rarely answers it.
  const filteredRepos = useMemo(() => {
    const entries = Array.from(byRepo.entries())
    const q = repoQuery.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(([repo, items]) =>
      repo.toLowerCase().includes(q) || items.some((i) => i.skillName.toLowerCase().includes(q)),
    )
  }, [byRepo, repoQuery])

  // Whichever skill the modal is showing, with every piece of evidence
  // behind it. Built here rather than in the modal so the modal stays a
  // presentation of data it was handed.
  const openSkillDetail = useMemo(() => {
    if (!openSkill) return null
    const skill = skills.find((s) => s.skillId === openSkill)
    if (!skill) return null
    return {
      skillId: skill.skillId,
      name: skill.name,
      bestLevel: skill.bestLevel,
      evidence: sources
        .filter((src) => src.skillId === openSkill)
        .map((src) => ({
          repoFullName: src.repoFullName,
          tier: src.tier,
          level: src.level,
          verificationMethod: src.verificationMethod,
        }))
        .sort((a, b) => b.level - a.level),
    }
  }, [openSkill, skills, sources])

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        {/* Left third: the anchor — who, how much, and the controls you set
            once. Right two thirds: the content those numbers summarize. */}
        <div style={{ display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 29, alignItems: 'start' }} className="mob-1col">

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14.5 }}>
            <div>
              <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 7 }}>
                Your record
              </h1>
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>
                Everything Workmark knows you can do, and where each piece came from. Only you see this full view.
              </p>
            </div>

            {trackRecord.closeOutRate !== null && (
              <Card hoverable={false} padding={19.5}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Stat value={`${Math.round(trackRecord.closeOutRate * 100)}%`} label="close-out rate" />
                  <div style={{ display: 'flex', gap: 25, borderTop: `1px solid ${C.borderFaint}`, paddingTop: 14 }}>
                    <Stat value={trackRecord.closed} label="completed" />
                    {trackRecord.abandoned > 0 && <Stat value={trackRecord.abandoned} label="abandoned" />}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: C.textGhost, lineHeight: 1.5, marginTop: 12.5 }}>
                  Counts hidden engagements too — a percentage over a total nobody sees reveals nothing about which projects exist.
                </p>
              </Card>
            )}

            <Card hoverable={false} padding={19.5}>
              <Kicker style={{ marginBottom: 9 }}>Public profile</Kicker>
              <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.5, marginBottom: 13 }}>
                {student.handle
                  ? 'Anyone with this link sees your verified skills and the work you chose to show.'
                  : 'Claim a handle for a shareable link. Until then, your record is private.'}
              </p>

              {student.handle && profileUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8.5, marginBottom: 13, flexWrap: 'wrap' }}>
                  <Link href={`/p/${student.handle}`} style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
                    /p/{student.handle}
                  </Link>
                  <button
                    onClick={() => { navigator.clipboard.writeText(profileUrl); toast('Link copied.', 'success') }}
                    aria-label="Copy profile link"
                    title="Copy link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5.5, fontSize: 12, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                  >
                    <Icon name="link" size={11.5} />
                  </button>
                  {!editingHandle && (
                    <button
                      onClick={() => setEditingHandle(true)}
                      style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}
                    >
                      Edit handle
                    </button>
                  )}
                </div>
              )}

              {(!student.handle || editingHandle) && (
                <>
                  <div style={{ display: 'flex', gap: 7.5, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: C.textGhost }}>/p/</span>
                    <input
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="dk-input"
                      style={{ flex: 1, minWidth: 0 }}
                      placeholder="your-handle"
                      aria-label="Profile handle"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 7.5, marginTop: 9.5 }}>
                    <Button
                      variant="ink" size="sm" fullWidth
                      onClick={saveHandle}
                      disabled={!handle.trim() || handle === student.handle}
                      busyLabel={savingHandle ? 'Saving…' : null}
                    >
                      {student.handle ? 'Change' : 'Claim'}
                    </Button>
                    {student.handle && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setEditingHandle(false); setHandle(student.handle ?? '') }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  {student.handle && (
                    <p style={{ fontSize: 12, color: state.caution, marginTop: 9.5, lineHeight: 1.5 }}>
                      Changing your handle breaks every link you&apos;ve already shared.
                    </p>
                  )}
                </>
              )}
            </Card>

            {/* Keeping the record current is an action, so it looks like one.
                It was a text link reading "Evidence source & rescan →" in a
                stack of three identical text links — the one thing on the
                panel that did something was dressed exactly like the two
                that went somewhere. */}
            <Card hoverable={false} padding={19.5}>
              <Kicker style={{ marginBottom: 9 }}>Keeping this current</Kicker>
              <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.5, marginBottom: 13 }}>
                {githubConnected
                  ? 'A rescan reads your repositories again and picks up anything you have built since.'
                  : 'Connect GitHub and we read the code you have already written.'}
              </p>
              <RescanButton
                githubConnected={githubConnected}
                lastScannedAt={lastScannedAt}
                variant="ink"
                size="sm"
                fullWidth
              />
              {githubConnected && (
                <Link
                  href="/student/github"
                  style={{ display: 'inline-block', fontSize: 13, color: C.textMuted, textDecoration: 'none', marginTop: 12 }}
                >
                  Choose which repositories →
                </Link>
              )}
            </Card>

            {/* Two places, both of which belong to the student rather than to
                this page — so they stay links, and stay together. */}
            <Card hoverable={false} padding="4px 19.5px">
              {[
                { href: '/me/briefs', title: 'Project ideas', sub: 'Something to build next' },
                { href: '/me/file', title: 'Your file & disputes', sub: 'Everything on record, and how to challenge it' },
              ].map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '14px 0', textDecoration: 'none',
                    borderBottom: i === 0 ? `1px solid ${C.borderFaint}` : 'none',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{item.title}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: C.textGhost, lineHeight: 1.45 }}>{item.sub}</span>
                  </span>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
                    <path d="M6 3.5L10.5 8L6 12.5" stroke={C.textGhost} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>

            {/* ── Skills ────────────────────────────────────────────────────
                The focal card: this is what the page is. It gets the violet
                edge and the light in the corner, and nothing else on the
                screen does — two focal cards and neither is focal. */}
            <div>
              <Kicker style={{ marginBottom: 11, paddingLeft: 20.5 }}>Your skills · {skills.length}</Kicker>

              {skills.length === 0 ? (
                /* Text only. There used to be a "Link repos" button here as
                   well as the one in the panel to the left, going to the same
                   page under a different name — which reads as two different
                   things to do rather than one. The panel keeps the button;
                   this says what will fill the space. */
                <Card hoverable={false} padding={19.5}>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
                    {githubConnected
                      ? 'Nothing yet. Run a scan and the skills your repositories prove will appear here.'
                      : 'Nothing yet. Connect GitHub and the skills your repositories prove will appear here.'}
                  </p>
                </Card>
              ) : (
                <Card focal hoverable={false} padding="20px 21px 18px">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 15 }}>
                    <div>
                      <span style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, lineHeight: 1 }}>
                        {skills.length}
                      </span>
                      <span style={{ fontSize: 13.5, color: C.textMuted, marginLeft: 9 }}>
                        {skills.length === 1 ? 'skill on your record' : 'skills on your record'}
                      </span>
                    </div>
                    <span style={{ fontSize: 12.5, color: C.textGhost, paddingTop: 6 }}>
                      Click any skill to see where it came from
                    </span>
                  </div>

                  <div style={{ marginBottom: 17 }}>
                    <LevelBar counts={levelCounts} />
                  </div>

                  <SearchableBox
                    label="Search your skills"
                    query={skillQuery}
                    onQuery={setSkillQuery}
                    placeholder="Search skills…"
                    count={filteredSkills.length}
                    total={skills.length}
                    searchable={skills.length > 8}
                    maxHeight={296}
                    emptyMessage="No skill on your record matches that."
                  >
                    {/* Grouped strongest first, so the answer to "what is
                        this person good at" is the first thing under the
                        bar rather than something you scroll for. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                      {SKILL_GROUPS.map((group) => {
                        const inGroup = filteredSkills.filter((s) => groupOf(s.bestLevel) === group.key)
                        if (inGroup.length === 0) return null
                        return (
                          <div key={group.key}>
                            <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.075em', textTransform: 'uppercase', color: C.textGhost, marginBottom: 8 }}>
                              {group.label} · {inGroup.length}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {inGroup.map((s) => (
                                <SkillChip
                                  key={s.skillId}
                                  name={s.name}
                                  level={s.bestLevel}
                                  showLevel={false}
                                  onClick={() => setOpenSkill(s.skillId)}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </SearchableBox>
                </Card>
              )}
            </div>

            {/* ── Projects ──────────────────────────────────────────────────
                Searchable and capped. This list used to be a two-column grid
                of every repository, so the page got taller the more work
                someone had done and everything below it moved further away —
                exactly backwards. */}
            {byRepo.size > 0 && (
              <div>
                <Kicker style={{ marginBottom: 11, paddingLeft: 20.5 }}>Projects · {byRepo.size}</Kicker>
                <Card hoverable={false} padding="17px 19px 15px">
                  <SearchableBox
                    label="Search your projects"
                    query={repoQuery}
                    onQuery={setRepoQuery}
                    placeholder="Search projects and the skills in them…"
                    count={filteredRepos.length}
                    total={byRepo.size}
                    searchable={byRepo.size > 5}
                    maxHeight={356}
                    emptyMessage="No project matches that."
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {filteredRepos.map(([repo, entries], i) => (
                        <div
                          key={repo}
                          style={{
                            padding: i === 0 ? '0 2px 13px' : '13px 2px',
                            borderTop: i === 0 ? 'none' : `1px solid ${C.borderFaint}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.text, wordBreak: 'break-word' }}>{repo}</span>
                            <span style={{ fontSize: 12, color: C.textGhost, whiteSpace: 'nowrap' }}>
                              {TIER_LABEL[entries[0]?.tier ?? ''] ?? entries[0]?.tier}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {entries.map((e, j) => (
                              <PlainChip
                                key={`${e.skillId}-${j}`}
                                name={e.skillName}
                                onClick={() => setOpenSkill(e.skillId)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SearchableBox>
                </Card>
              </div>
            )}

            {/* Engagements, including hidden — this is the private view */}
            {engagements.length > 0 && (
              <div>
                <Kicker style={{ marginBottom: 5.5, paddingLeft: 20.5 }}>Collaborations · {engagements.length}</Kicker>
                <p style={{ fontSize: 13, color: C.textGhost, marginBottom: 12 }}>
                  Change what each one shows publicly from the engagement page.
                </p>
                <Card hoverable={false} padding="3.5px 20px 7px">
                  {engagements.map((e, i) => (
                    <Link
                      key={e.id} href={`/engagements/${e.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderBottom: i < engagements.length - 1 ? `1px solid ${C.borderFaint}` : 'none', textDecoration: 'none' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>{e.listingTitle ?? 'Untitled project'}</p>
                        <p style={{ fontSize: 13, color: C.textGhost }}>
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

      <SkillEvidenceModal skill={openSkillDetail} onClose={() => setOpenSkill(null)} />
    </div>
  )
}
