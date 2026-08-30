'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Drawer from '@/components/ui/Drawer'
import { Bar } from '@/components/ui/Skeleton'
import { Icon } from '@/components/Icon'
import { Kicker } from '@/components/ui/Section'
import {
  CAREER_TRACKS, CAREER_TRACK_META, SKILL_LEVELS, SKILL_LEVEL_META,
  type CareerTrack, type SkillLevel,
} from '@/lib/agents/tracks'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'

export interface BriefRow {
  id: string
  title: string
  body: string
  targetSkillId: string | null
  targetSkillName: string | null
  targetRole: string | null
  difficulty: number | null
  skillLevel: SkillLevel | null
  careerTrack: CareerTrack | null
  repoFullName: string | null
  startedAt: string | null
  issuedAt: string
  completedAt: string | null
}

interface TaxonomyOption {
  id: string
  canonicalName: string
  alreadyEvidenced: boolean
}

interface GrantedRepo {
  repoFullName: string
  isPrivate: boolean
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'A weekend', 2: 'A few days', 3: 'A week or two', 4: 'Several weeks', 5: 'A month+',
}

/** What the generation is actually doing, in the order it does it. */
const GENERATING_STAGES = [
  'Reading your record…',
  'Looking at what you already have evidence in…',
  'Working out a project that fits your level…',
  'Writing the brief…',
  'Almost there…',
]

/**
 * Progress cue for the brief generation.
 *
 * The call is a single ~16k-token request with no streaming, so there is no
 * real progress to report — but "nothing is happening" and "this is taking
 * a few seconds" look identical without something on screen, and the honest
 * fix is to say what it's doing rather than fake a percentage. The stages
 * advance on a timer and stop at the last one instead of looping, so it
 * never claims to be further along than it can know.
 */
function GeneratingNote() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, GENERATING_STAGES.length - 1))
    }, 2600)
    return () => clearInterval(timer)
  }, [])

  return (
    <div role="status" aria-live="polite" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          aria-hidden="true"
          style={{
            width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${C.accentBorder}`, borderTopColor: C.accent,
            animation: 'nb-spin 720ms linear infinite',
          }}
        />
        <span style={{ fontSize: 13, color: C.textMuted }}>{GENERATING_STAGES[stage]}</span>
      </div>
      <Bar height={3} radius={R.pill} />
      <p style={{ fontSize: 12, color: C.textGhost }}>Usually 10–20 seconds. Don&apos;t refresh.</p>
    </div>
  )
}

export default function BriefsClient({ studentName, briefs, taxonomy, agentsAvailable, grantedRepos }: {
  studentName: string | null
  briefs: BriefRow[]
  taxonomy: TaxonomyOption[]
  agentsAvailable: boolean
  grantedRepos: GrantedRepo[]
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [skillId, setSkillId] = useState('')
  const [skillName, setSkillName] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate')
  const [careerTrack, setCareerTrack] = useState<CareerTrack | ''>('')
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // The brief a "Start this project" drawer is open for, if any.
  const [startingBrief, setStartingBrief] = useState<BriefRow | null>(null)
  const [repoChoice, setRepoChoice] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return taxonomy.filter((s) => s.canonicalName.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 8)
  }, [query, taxonomy])

  const open = briefs.filter((b) => !b.completedAt)
  const done = briefs.filter((b) => b.completedAt)

  async function generate() {
    if (!skillId) {
      toast('Pick a skill to build toward.', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/agents/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, targetRole, skillLevel, careerTrack: careerTrack || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not generate.')
      toast('Project idea ready.', 'success')
      setSkillId(''); setSkillName(''); setQuery('')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not generate.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function linkRepo() {
    if (!startingBrief || !repoChoice) return
    setBusyId(startingBrief.id)
    try {
      const res = await fetch(`/api/briefs/${startingBrief.id}/repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: repoChoice }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not link the repo.')
      toast(`Linked ${repoChoice}. Scanning is on for it — rescan whenever you push.`, 'success')
      setStartingBrief(null)
      setRepoChoice('')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not link the repo.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function unlinkRepo(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/briefs/${id}/repo`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not unlink.')
      toast('Unlinked. Any evidence the repo already produced stays on your record.', 'info')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not unlink.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function rescan(id: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/github/scan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not start a scan.')
      toast(
        json.alreadyRunning
          ? 'A scan is already running — watch it on the evidence source page.'
          : `Scanning ${json.totalSteps} repo(s) in the background. Your record updates as it goes.`,
        'info',
      )
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not start a scan.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function setCompleted(id: string, completed: boolean) {
    setBusyId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('project_briefs')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) toast('Could not update.', 'error')
    else router.refresh()
    setBusyId(null)
  }

  async function remove(id: string) {
    if (!confirm('Delete this project idea?')) return
    setBusyId(id)
    const supabase = createClient()
    const { error } = await supabase.from('project_briefs').delete().eq('id', id)
    if (error) toast('Could not delete.', 'error')
    else { toast('Deleted.', 'success'); router.refresh() }
    setBusyId(null)
  }

  function BriefCard({ b }: { b: BriefRow }) {
    const c = b.targetSkillName ? tagColor(b.targetSkillName) : null
    return (
      <Card hoverable={false} padding={19.5}>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, marginBottom: 5.5 }}>{b.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            {b.targetSkillName && c && (
              <span style={{ fontSize: 12, padding: '3px 9.5px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                {b.targetSkillName}
              </span>
            )}
            {b.skillLevel && (
              <span style={{ fontSize: 12, padding: '3px 9.5px', borderRadius: R.pill, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted }}>
                {SKILL_LEVEL_META[b.skillLevel].label}
              </span>
            )}
            <span style={{ fontSize: 12, color: C.textGhost }}>
              {[
                b.careerTrack ? CAREER_TRACK_META[b.careerTrack].label : null,
                b.difficulty ? DIFFICULTY_LABEL[b.difficulty] : null,
                new Date(b.issuedAt).toLocaleDateString(),
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14.5 }}>{b.body}</p>

        {b.repoFullName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: C.surfaceAlt, borderRadius: R.md, marginBottom: 12 }}>
            <Icon name="github" size={13.5} />
            <a
              href={`https://github.com/${b.repoFullName}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: C.textSub, fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {b.repoFullName}
            </a>
          </div>
        )}

        {/* Three states, not two. A brief starts as an idea with no repo;
            "I built this" was being offered on ideas suggested seconds
            earlier, which is the wrong verb at the wrong time. */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {!b.repoFullName && (
            <Button variant="ink" size="sm" onClick={() => { setStartingBrief(b); setRepoChoice('') }} disabled={busyId === b.id}>
              {b.completedAt ? 'Link the repo' : 'Start this project'}
            </Button>
          )}
          {b.repoFullName && (
            <>
              <Button variant="ink" size="sm" onClick={() => rescan(b.id)} disabled={busyId === b.id}>
                Rescan my work
              </Button>
              <Button variant="quiet" size="sm" onClick={() => unlinkRepo(b.id)} disabled={busyId === b.id}>Unlink repo</Button>
            </>
          )}
          {/* Shown once there's a repo — and also for briefs marked built
              before repo linking existed, so those rows keep their toggle
              instead of being stuck completed with no way back. */}
          {(b.repoFullName || b.completedAt) && (
            <Button variant="outline" size="sm" onClick={() => setCompleted(b.id, !b.completedAt)} disabled={busyId === b.id}>
              {b.completedAt ? 'Mark not built' : 'I built this'}
            </Button>
          )}
          <Button variant="quiet" size="sm" onClick={() => remove(b.id)} disabled={busyId === b.id}>Delete</Button>
        </div>
      </Card>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: 680, margin: '0 auto', padding: '30px 28px 72px' }}>
        <Link href="/me" style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>← Your record</Link>

        <div style={{ margin: '13px 0 21px' }}>
          <h1 style={{ fontFamily: F.display, fontSize: 25, fontWeight: 700, letterSpacing: '-0.03em', color: C.text, marginBottom: 7 }}>
            Project ideas
          </h1>
          <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6 }}>
            Private to you — never posted, never shown to anyone. Build one, link the repo, and it becomes verified evidence the same way any other project does.
          </p>
        </div>

        {agentsAvailable ? (
          <div className="nb-focal" style={{ padding: 21, marginBottom: 23 }}>
            <Kicker style={{ color: C.accentInk, marginBottom: 8.5 }}>Get an idea</Kicker>
            <p style={{ fontSize: 13.5, color: C.textMuted, marginBottom: 14.5, lineHeight: 1.5 }}>
              Pick a skill you want on your record. We&apos;ll suggest something concrete enough to actually finish.
            </p>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                value={skillId ? skillName : query}
                onChange={(e) => { setQuery(e.target.value); setSkillId(''); setSkillName('') }}
                className="dk-input"
                placeholder="Search skills — e.g. Rust, Postgres, React"
                aria-label="Target skill"
              />
              {!skillId && matches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'hidden', boxShadow: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.10)' }}>
                  {matches.map((s) => (
                    <button
                      key={s.id} type="button"
                      onClick={() => { setSkillId(s.id); setSkillName(s.canonicalName); setQuery('') }}
                      style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9.5px 14px', background: 'transparent', border: 'none', color: C.textSub, fontSize: 14, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                    >
                      {s.canonicalName}
                      {s.alreadyEvidenced && <span style={{ fontSize: 12, color: C.textGhost }}>already evidenced</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Level drives the shape of the brief more than anything else
                here — the same skill should produce a different project for
                a beginner than for someone working at research level. */}
            <div style={{ marginBottom: 14 }}>
              <Kicker style={{ marginBottom: 7 }}>Your level in {skillName || 'this skill'}</Kicker>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))', gap: 7 }}>
                {SKILL_LEVELS.map((lvl) => {
                  const active = skillLevel === lvl
                  return (
                    <button
                      key={lvl} type="button" onClick={() => setSkillLevel(lvl)}
                      aria-pressed={active}
                      style={{
                        textAlign: 'left', padding: '9px 11px', borderRadius: R.md, cursor: 'pointer', font: 'inherit',
                        background: active ? C.accentHover : C.surface,
                        border: `1px solid ${active ? C.accentBorder : C.border}`,
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? C.accentInk : C.textSub }}>
                        {SKILL_LEVEL_META[lvl].label}
                      </span>
                      <span style={{ display: 'block', fontSize: 11.5, color: C.textGhost, marginTop: 2, lineHeight: 1.4 }}>
                        {SKILL_LEVEL_META[lvl].hint}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Kicker style={{ marginBottom: 7 }}>Career track (optional)</Kicker>
              <select
                value={careerTrack}
                onChange={(e) => setCareerTrack(e.target.value as CareerTrack | '')}
                className="dk-select"
                aria-label="Career track"
              >
                <option value="">No particular track</option>
                {CAREER_TRACKS.map((t) => (
                  <option key={t} value={t}>{CAREER_TRACK_META[t].label}</option>
                ))}
              </select>
            </div>

            <input
              value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
              className="dk-input" style={{ marginBottom: 14 }}
              placeholder="Anything else to aim at (optional) — e.g. distributed systems at a startup"
              aria-label="Additional context"
            />

            <Button variant="accent" onClick={generate} disabled={!skillId || generating} busyLabel={generating ? 'Thinking…' : null}>
              Suggest a project
            </Button>

            {/* A 16k-token generation takes several seconds. Without this the
                page just sat there and the only feedback was the button's
                own label, which reads as a hang. */}
            {generating && <GeneratingNote />}
          </div>
        ) : (
          <Card hoverable={false} padding={19.5} style={{ marginBottom: 23 }}>
            <p style={{ fontSize: 14, color: C.textFaint }}>Project suggestions aren&apos;t configured on this deployment.</p>
          </Card>
        )}

        {open.length > 0 && (
          <div style={{ marginBottom: 29 }}>
            <Kicker style={{ marginBottom: 12 }}>To build · {open.length}</Kicker>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {open.map((b) => <BriefCard key={b.id} b={b} />)}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <Kicker style={{ marginBottom: 12 }}>Built · {done.length}</Kicker>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {done.map((b) => <BriefCard key={b.id} b={b} />)}
            </div>
          </div>
        )}

        {briefs.length === 0 && (
          <Card hoverable={false} padding={30}>
            <p style={{ fontSize: 15, color: C.textFaint, textAlign: 'center', lineHeight: 1.6 }}>
              No project ideas yet. If your record is thin, this is the fastest way to fix it — the projects here are sized to actually finish.
            </p>
          </Card>
        )}
      </main>

      <Drawer
        open={!!startingBrief}
        onClose={() => { if (!busyId) { setStartingBrief(null); setRepoChoice('') } }}
        title="Start this project"
        subtitle={startingBrief?.title}
        footer={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="accent" onClick={linkRepo} disabled={!repoChoice || !!busyId} busyLabel={busyId ? 'Linking…' : null}>
              Link this repo
            </Button>
            <Button variant="quiet" onClick={() => { setStartingBrief(null); setRepoChoice('') }} disabled={!!busyId}>Cancel</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <Kicker style={{ marginBottom: 7 }}>1 · Create the repo on GitHub</Kicker>
            <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.6, marginBottom: 11 }}>
              Make a repo for this project, then add it to the Workmark GitHub App so it can be scanned. It can be private — private repos are only ever scanned when you switch them on yourself.
            </p>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <a
                href={`https://github.com/new?name=${encodeURIComponent(suggestRepoName(startingBrief?.title ?? ''))}&description=${encodeURIComponent(startingBrief?.title ?? '')}`}
                target="_blank" rel="noopener noreferrer"
                className="nb-btn nb-btn-outline"
              >
                <Icon name="github" size={13.5} /> New repo on GitHub
              </a>
              <a href="/api/github/app/install" className="nb-btn nb-btn-quiet">Add it to Workmark</a>
            </div>
          </div>

          <div>
            <Kicker style={{ marginBottom: 7 }}>2 · Link it to this brief</Kicker>
            {grantedRepos.length === 0 ? (
              <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.6 }}>
                No connected repos yet. Create one above and add it to the GitHub App, then come back — it&apos;ll show up here.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.6, marginBottom: 11 }}>
                  Linking turns scanning on for this repo. As you push work to it, hit rescan and your record updates.
                </p>
                <select
                  value={repoChoice}
                  onChange={(e) => setRepoChoice(e.target.value)}
                  className="dk-select"
                  aria-label="Repo to link"
                >
                  <option value="">Choose a repo…</option>
                  {grantedRepos.map((r) => (
                    <option key={r.repoFullName} value={r.repoFullName}>
                      {r.repoFullName}{r.isPrivate ? ' (private)' : ''}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6 }}>
            Nothing here is posted or shown to anyone. The repo becomes evidence the same way any other linked repo does — through a scan of the commits you actually wrote.
          </p>
        </div>
      </Drawer>
    </div>
  )
}

/**
 * A repo name GitHub will accept, prefilled from the brief's title.
 * Only a suggestion — the student can type over it on GitHub's own form.
 */
function suggestRepoName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workmark-project'
}
