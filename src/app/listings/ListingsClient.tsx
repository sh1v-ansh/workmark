'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Kicker } from '@/components/ui/Section'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { FIT_TIER_TONE } from '@/lib/theme/fitTier'
import { tagColor } from '@/lib/theme/tagColors'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'
import { LAYOUT } from '@/lib/theme/layout'
import MultiSelect from '@/components/ui/MultiSelect'

export interface ListingCardData {
  id: string
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
      style={{
        fontSize: 13, padding: '5.5px 12px', borderRadius: R.pill, cursor: 'pointer', font: 'inherit', fontWeight: 500,
        transition: 'background 120ms, border-color 120ms, color 120ms',
        color: active ? '#fff' : C.textMuted,
        background: active ? C.text : 'transparent',
        border: `1.5px solid ${active ? C.text : C.border}`,
        whiteSpace: 'nowrap',
      }}
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

export default function ListingsClient({ listings, signedIn, studentName }: {
  listings: ListingCardData[]
  signedIn: boolean
  studentName: string | null
}) {
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

  const filtered = useMemo(() => listings.filter((l) => {
    // AND across groups, OR within a group.
    if (skills.size > 0 && !l.skills.some((s) => skills.has(s))) return false
    if (workModes.size > 0 && !(l.workMode && workModes.has(l.workMode))) return false
    if (hourBands.size > 0) {
      const bk = hoursBandKey(l.estHours)
      if (!bk || !hourBands.has(bk)) return false
    }
    if (tiers.size > 0 && !(l.fitTier && tiers.has(l.fitTier))) return false
    return true
  }), [listings, skills, workModes, hourBands, tiers])

  const activeCount = skills.size + workModes.size + hourBands.size + tiers.size

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function clearAll() {
    setSkills(new Set())
    setWorkModes(new Set())
    setHourBands(new Set())
    setTiers(new Set())
  }

  const hasAnyFacet = skillOptions.length > 0 || workModeOptions.length > 0 || showHoursFilter || showTierFilter

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: C.text, marginBottom: 7 }}>
              Find Work
            </h1>
          </div>
          {/* A link, not a button. Posting is a secondary action here and an
              outlined button gave it the same weight as the page itself. */}
          {signedIn && (
            <Link
              href="/listings/new"
              style={{ fontSize: 13, color: C.accent, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Post a project →
            </Link>
          )}
        </div>

        {listings.length === 0 ? (
          <Card hoverable={false} padding={36}>
            <p style={{ fontSize: 15, color: C.textMuted, textAlign: 'center' }}>
              No open projects right now.{signedIn ? ' Post the first one.' : ' Sign in to post one.'}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: hasAnyFacet ? '230px minmax(0, 1fr)' : '1fr', gap: 22, alignItems: 'start' }} className="mob-1col">

            {hasAnyFacet && (
              <Card hoverable={false} padding={16.5} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
                    Filter{activeCount > 0 ? ` · ${activeCount}` : ''}
                  </span>
                  {activeCount > 0 && (
                    <button
                      type="button" onClick={clearAll}
                      style={{ fontSize: 12, color: C.textFaint, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14.5 }} className="mob-1col">
                  {filtered.map((l) => (
                    <Card key={l.id} href={`/listings/${l.id}`} padding={18}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
                        <h2 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, lineHeight: 1.3 }}>
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
                            const c = tagColor(s)
                            return (
                              <span key={s} style={{ fontSize: 12, padding: '3.5px 9.5px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                                {s}
                              </span>
                            )
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
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
