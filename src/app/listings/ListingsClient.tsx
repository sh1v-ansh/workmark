'use client'

import React from 'react'

import SkillTag from '@/components/skills/SkillTag'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { FIT_TIER_TONE } from '@/lib/theme/fitTier'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'
import { LAYOUT } from '@/lib/theme/layout'
import AiProjectCard, { type AiProjectCardData } from '@/components/briefs/AiProjectCard'
import { Icon } from '@/components/Icon'
import MultiSelect from '@/components/ui/MultiSelect'
import PeopleTab from './PeopleTab'
import type { PersonCard, InvitableProject } from '@/lib/listings/people'
import { LISTING_KINDS, KIND_LABEL, type ListingKind } from '@/lib/listings/kinds'

export interface ListingCardData {
  id: string
  kind: string
  title: string | null
  brief: string | null
  posterDisplayName: string | null
  /** Only true once a person has confirmed the claim. Never set for pending. */
  posterIsVerifiedFaculty: boolean
  isOwn: boolean
  estHours: number | null
  hoursPerWeek: number | null
  duration: string | null
  workMode: string | null
  teamSize: number | null
  createdAt: string
  skills: string[]
  fitTier: FitTier | null
  missingCount: number
}

// Effort bands over listings.est_hours (total hours), per the spec's hours_band.
// A listing with no est_hours matches no band, so an hours filter narrows to
// listings that actually declared an estimate.
const HOUR_BANDS: { key: string; label: string; test: (h: number) => boolean }[] = [
  { key: 'lt10', label: '< 10 hrs', test: (h) => h < 10 },
  { key: '10to40', label: '10–40 hrs', test: (h) => h >= 10 && h <= 40 },
  { key: 'gt40', label: '> 40 hrs', test: (h) => h > 40 },
]

const TIER_ORDER: FitTier[] = ['strong_fit', 'competitive', 'reach', 'not_yet']

function hoursBandKey(h: number | null): string | null {
  if (h == null) return null
  return HOUR_BANDS.find((b) => b.test(h))?.key ?? null
}

/** Kept exported: ListingDetailClient renders the same tier as a Badge with this label. */
export function FitBadge({ tier, missingCount }: { tier: FitTier; missingCount: number }) {
  return (
    <Badge tone={FIT_TIER_TONE[tier]}>
      {FIT_TIER_LABEL[tier]}
      {missingCount > 0 && <span style={{ opacity: 0.7, fontWeight: 400 }}> · {missingCount} gap{missingCount === 1 ? '' : 's'}</span>}
    </Badge>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`nb-chip${active ? ' nb-chip-active' : ''}`}
    >
      {label}
    </button>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Kicker style={{ marginBottom: 9 }}>{label}</Kicker>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{children}</div>
    </div>
  )
}

/** Tags are stored lowercase ('remote', 'hybrid') but read as labels. */
function sentenceCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1)
}

export default function ListingsClient({
  listings, aiProjects = [], signedIn, studentName,
  people = [], invitable = [], viewerIsStudent = false, viewerId = null, openToCollab = false, paidHidden = 0,
}: {
  listings: ListingCardData[]
  /** Projects Workmark wrote for this student and they have not started. */
  aiProjects?: AiProjectCardData[]
  signedIn: boolean
  studentName: string | null
  /** Students who chose to be found, for the People tab. */
  people?: PersonCard[]
  invitable?: InvitableProject[]
  viewerIsStudent?: boolean
  viewerId?: string | null
  openToCollab?: boolean
  /** Paid roles hidden because the viewer is on a student visa. */
  paidHidden?: number
}) {
  const router = useRouter()

  // Projects or People. Read from the URL after mount so a link can open
  // straight onto People (the dashboard's "Let other students find you"
  // step does) without the page needing a Suspense boundary.
  const [tab, setTab] = useState<'projects' | 'people'>('projects')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'people') setTab('people')
  }, [])
  function switchTab(next: 'projects' | 'people') {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'people') url.searchParams.set('tab', 'people')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url.toString())
  }

  // Nobody gets an empty page on their first visit. With no ideas waiting,
  // ask for them now instead of leaving it to tonight's run; once per
  // browser session, so a page that stays empty (faculty, agents off) does
  // not ask again on every visit.
  const [writing, setWriting] = useState(false)
  useEffect(() => {
    if (!signedIn || aiProjects.length > 0) return
    try {
      if (sessionStorage.getItem('wm-ideas-asked')) return
      sessionStorage.setItem('wm-ideas-asked', '1')
    } catch { /* storage blocked: asking once more is harmless */ }
    setWriting(true)
    fetch('/api/briefs/recommend', { method: 'POST' })
      .then((res) => res.json())
      .then((json) => { if (json?.generated > 0) router.refresh() })
      .catch(() => {})
      .finally(() => setWriting(false))
  }, [signedIn, aiProjects.length, router])

  // Just removed from its own page. The delete may still be in flight when
  // this renders, so it is hidden here rather than trusted to be gone.
  const [removedId, setRemovedId] = useState<string | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('removed')
    if (id) setRemovedId(id)
  }, [])
  listings = removedId ? listings.filter((l) => l.id !== removedId) : listings

  const [kinds, setKinds] = useState<Set<string>>(new Set())
  const [skills, setSkills] = useState<Set<string>>(new Set())
  const [workModes, setWorkModes] = useState<Set<string>>(new Set())
  const [hourBands, setHourBands] = useState<Set<string>>(new Set())
  const [tiers, setTiers] = useState<Set<FitTier>>(new Set())

  // Facet options derived from the listings actually on the page.
  const skillOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of listings) for (const s of l.skills) set.add(s)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [listings])

  const workModeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of listings) if (l.workMode) set.add(l.workMode)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [listings])

  // Only offer fit-tier filtering when signed in — logged-out cards have no fit.
  const showTierFilter = signedIn
  const showHoursFilter = useMemo(() => listings.some((l) => l.estHours != null), [listings])

  // Only the kinds actually on the page, in the form's order.
  const kindOptions = useMemo(
    () => LISTING_KINDS.filter((k) => listings.some((l) => l.kind === k.key)),
    [listings],
  )

  const filtered = useMemo(() => listings.filter((l) => {
    // AND across groups, OR within a group.
    if (kinds.size > 0 && !kinds.has(l.kind)) return false
    if (skills.size > 0 && !l.skills.some((s) => skills.has(s))) return false
    if (workModes.size > 0 && !(l.workMode && workModes.has(l.workMode))) return false
    if (hourBands.size > 0) {
      const bk = hoursBandKey(l.estHours)
      if (!bk || !hourBands.has(bk)) return false
    }
    if (tiers.size > 0 && !(l.fitTier && tiers.has(l.fitTier))) return false
    return true
  }), [listings, kinds, skills, workModes, hourBands, tiers])

  const activeCount = kinds.size + skills.size + workModes.size + hourBands.size + tiers.size

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function clearAll() {
    setKinds(new Set())
    setSkills(new Set())
    setWorkModes(new Set())
    setHourBands(new Set())
    setTiers(new Set())
  }

  const hasAnyFacet = kindOptions.length > 0 || skillOptions.length > 0 || workModeOptions.length > 0 || showHoursFilter || showTierFilter

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, letterSpacing: '-0.022em', color: C.text }}>
              Find work
            </h1>
          </div>
          {/* Outline, not accent: posting is the second thing this page does,
              so it is findable at a glance without outranking the listings. */}
          {signedIn && <Button href="/listings/new" variant="outline" size="sm">Post a project</Button>}
        </div>

        {signedIn && (
          <div className="wm-tabs" role="tablist" style={{ marginBottom: 18 }}>
            {([['projects', 'Projects'], ['people', `People${people.length > 0 ? ` · ${people.length}` : ''}`]] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => switchTab(key)}
                className={`wm-tab${tab === key ? ' wm-tab-on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === 'people' ? (
          <PeopleTab
            people={people}
            invitable={invitable}
            viewerIsStudent={viewerIsStudent}
            viewerId={viewerId}
            openToCollab={openToCollab}
          />
        ) : (<>
        {listings.length === 0 && signedIn && (aiProjects.length > 0 || writing) && (
          <div className="nb-g3" style={{ marginBottom: 18 }}>
            {aiProjects.map((project) => <AiProjectCard key={project.id} project={project} />)}
            {writing && aiProjects.length === 0 && [0, 1, 2].map((i) => (
              <div key={i} className="nb-ai-card" aria-hidden={i > 0} style={{ minHeight: 150 }}>
                {i === 0 && <p style={{ fontSize: 14, color: C.textMuted }}>Writing project ideas for you…</p>}
              </div>
            ))}
          </div>
        )}

        {listings.length === 0 ? (
          <Card hoverable={false} padding={36}>
            <p style={{ fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
              Nobody has posted a project yet.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {signedIn ? (
                <>
                  <Button href="/listings/new" variant="accent">Post the first one</Button>
                  <Button href="/goals" variant="outline">Get a project to build</Button>
                </>
              ) : (
                <Button href="/login" variant="accent">Sign in to post one</Button>
              )}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: hasAnyFacet ? '230px minmax(0, 1fr)' : '1fr', gap: 22, alignItems: 'start' }} className="mob-1col">

            {hasAnyFacet && (
              <Card hoverable={false} padding="15px 17px 18px" className="nb-filters" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 24 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: C.text, fontWeight: 600 }}>
                    Filter
                    {activeCount > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 19, height: 19, padding: '0 5px', borderRadius: R.pill,
                        fontSize: 12, fontWeight: 700, color: '#FFFFFF', background: C.accent,
                      }}>
                        {activeCount}
                      </span>
                    )}
                  </span>
                  {activeCount > 0 && (
                    <button
                      type="button" onClick={clearAll}
                      style={{ fontSize: 13, color: C.accent, fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {kindOptions.length > 0 && (
                  <FilterGroup label="Type">
                    {kindOptions.map((k) => (
                      <FilterChip key={k.key} label={k.label} active={kinds.has(k.key)} onClick={() => toggle<string>(setKinds, k.key)} />
                    ))}
                  </FilterGroup>
                )}

                {skillOptions.length > 0 && (
                  <MultiSelect
                    label="Skills"
                    options={skillOptions}
                    selected={skills}
                    onToggle={(v) => toggle(setSkills, v)}
                    onClear={() => setSkills(new Set())}
                  />
                )}

                {workModeOptions.length > 0 && (
                  <FilterGroup label="Work mode">
                    {workModeOptions.map((m) => (
                      <FilterChip key={m} label={m.charAt(0).toUpperCase() + m.slice(1)} active={workModes.has(m)} onClick={() => toggle(setWorkModes, m)} />
                    ))}
                  </FilterGroup>
                )}

                {showHoursFilter && (
                  <FilterGroup label="Est. hours">
                    {HOUR_BANDS.map((b) => (
                      <FilterChip key={b.key} label={b.label} active={hourBands.has(b.key)} onClick={() => toggle(setHourBands, b.key)} />
                    ))}
                  </FilterGroup>
                )}

                {showTierFilter && (
                  <FilterGroup label="Your fit">
                    {TIER_ORDER.map((t) => (
                      <FilterChip key={t} label={FIT_TIER_LABEL[t]} active={tiers.has(t)} onClick={() => toggle(setTiers, t)} />
                    ))}
                  </FilterGroup>
                )}
              </Card>
            )}

            <div>
              {activeCount > 0 && (
                <p style={{ fontSize: 13, color: C.textGhost, marginBottom: 13 }}>
                  Showing {filtered.length} of {listings.length}
                </p>
              )}

              {filtered.length === 0 ? (
                <Card hoverable={false} padding={36}>
                  <p style={{ fontSize: 15, color: C.textMuted, textAlign: 'center' }}>
                    No projects match your filters. Clear one to see more.
                  </p>
                </Card>
              ) : (
                // Two columns, cards alternating left and right in reading
                // order. Each column stacks its own cards with the same gap,
                // so a short card is never stretched to match its neighbour
                // and the rows drift a little, which reads as organic rather
                // than as a spreadsheet. On a phone it is one column, in order.
                <CardColumns>
                  {/* Written projects sit in the same grid as posted ones.
                      They lead because nothing is waiting on them: a student
                      can start one now, where a posting needs somebody to
                      reply. */}
                  {signedIn && aiProjects.map((project) => (
                    <AiProjectCard key={project.id} project={project} />
                  ))}
                  {filtered.map((l) => (
                    <Card key={l.id} href={`/listings/${l.id}`} padding={18}>
                      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.accent, marginBottom: 6 }}>
                        {KIND_LABEL[l.kind as ListingKind] ?? 'Project'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
                        <h2 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: C.text, lineHeight: 1.3 }}>
                          {l.title ?? 'Untitled project'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {l.isOwn ? (
                            <Badge>Yours</Badge>
                          ) : (
                            l.fitTier && <FitBadge tier={l.fitTier} missingCount={l.missingCount} />
                          )}
                        </div>
                      </div>

                      {l.brief && (
                        <p style={{
                          fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, marginBottom: 12,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {l.brief}
                        </p>
                      )}

                      {l.skills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5.5, marginBottom: 12 }}>
                          {l.skills.map((s) => {
                            return <SkillTag key={s} name={s} />
                          })}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, fontSize: 13, color: C.textGhost }}>
                        {l.posterDisplayName && <span>{l.posterDisplayName}</span>}
                        {l.posterIsVerifiedFaculty && <Badge tone="info">Verified faculty</Badge>}
                        {l.hoursPerWeek != null && <span>{l.hoursPerWeek} hrs/wk</span>}
                        {l.duration && <span>{sentenceCase(l.duration)}</span>}
                        {l.workMode && <span>{sentenceCase(l.workMode)}</span>}
                        {l.teamSize != null && <span>Team of {l.teamSize}</span>}
                      </div>
                    </Card>
                  ))}
                </CardColumns>
              )}
            </div>
          </div>
        )}
        </>)}
      </main>
    </div>
  )
}

/** Two stacks of cards, alternating, each at its own height. See .wm-stacks. */
function CardColumns({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children)
  const column = (side: 0 | 1) => (
    <div className="wm-stack">
      {items.map((item, i) => (i % 2 === side ? <div key={i} style={{ order: i }}>{item}</div> : null))}
    </div>
  )
  return <div className="wm-stacks">{column(0)}{column(1)}</div>
}
