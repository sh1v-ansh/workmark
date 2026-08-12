'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'

export interface ListingCardData {
  id: string
  title: string | null
  brief: string | null
  posterDisplayName: string | null
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

const FIT_STYLE: Record<FitTier, { color: string; bg: string; border: string }> = {
  strong_fit: { color: '#15803D', bg: 'rgba(21,128,61,0.12)', border: 'rgba(21,128,61,0.35)' },
  competitive: { color: '#0369A1', bg: 'rgba(3,105,161,0.12)', border: 'rgba(3,105,161,0.35)' },
  reach: { color: '#B45309', bg: 'rgba(180,83,9,0.12)', border: 'rgba(180,83,9,0.35)' },
  not_yet: { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
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

export function FitBadge({ tier, missingCount }: { tier: FitTier; missingCount: number }) {
  const s = FIT_STYLE[tier]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
      fontFamily: F.mono, whiteSpace: 'nowrap',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {FIT_TIER_LABEL[tier]}
      {missingCount > 0 && <span style={{ opacity: 0.75, fontWeight: 400 }}>· {missingCount} gap{missingCount === 1 ? '' : 's'}</span>}
    </span>
  )
}

// A single toggleable filter chip. Active = filled; inactive = subtle border.
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontSize: 11, fontFamily: F.mono, padding: '4px 11px', borderRadius: 999, cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms, color 120ms',
        color: active ? C.bg : C.textMuted,
        background: active ? C.text : 'transparent',
        border: `1px solid ${active ? C.text : C.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 10, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textFaint }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  )
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
      {signedIn && <Navbar role="student" userName={studentName ?? undefined} />}

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              Open projects
            </h1>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              Student-posted projects looking for collaborators.
              {signedIn && ' Fit is based on the skills your linked repos actually demonstrate.'}
            </p>
          </div>
          {signedIn && (
            <Link href="/listings/new" className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              <Icon name="plus" size={13} /> Post a project
            </Link>
          )}
        </div>

        {listings.length === 0 ? (
          <Card hoverable={false} padding={32}>
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
              No open projects right now.{signedIn ? ' Post the first one.' : ' Sign in to post one.'}
            </p>
          </Card>
        ) : (
          <>
            {hasAnyFacet && (
              <Card hoverable={false} padding={18}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
                    <Icon name="search" size={13} />
                    Filter
                    {activeCount > 0 && (
                      <span style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint }}>
                        · {activeCount} active
                      </span>
                    )}
                  </span>
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {skillOptions.length > 0 && (
                    <FilterGroup label="Skills">
                      {skillOptions.map((s) => (
                        <FilterChip key={s} label={s} active={skills.has(s)} onClick={() => toggle(setSkills, s)} />
                      ))}
                    </FilterGroup>
                  )}

                  {workModeOptions.length > 0 && (
                    <FilterGroup label="Work mode">
                      {workModeOptions.map((m) => (
                        <FilterChip key={m} label={m} active={workModes.has(m)} onClick={() => toggle(setWorkModes, m)} />
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
                </div>
              </Card>
            )}

            <div style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint }}>
              Showing {filtered.length} of {listings.length} project{listings.length === 1 ? '' : 's'}
            </div>

            {filtered.length === 0 ? (
              <Card hoverable={false} padding={32}>
                <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
                  No projects match your filters. Clear one to see more.
                </p>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map((l) => (
                  <Card key={l.id} href={`/listings/${l.id}`} padding={20}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>
                        {l.title ?? 'Untitled project'}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {l.isOwn && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Yours
                          </span>
                        )}
                        {l.fitTier && !l.isOwn && <FitBadge tier={l.fitTier} missingCount={l.missingCount} />}
                      </div>
                    </div>

                    {l.brief && (
                      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {l.brief}
                      </p>
                    )}

                    {l.skills.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {l.skills.map((s) => {
                          const c = tagColor(s)
                          return (
                            <span key={s} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                              {s}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                      {l.posterDisplayName && <span>{l.posterDisplayName}</span>}
                      {l.hoursPerWeek != null && <span>{l.hoursPerWeek} hrs/wk</span>}
                      {l.duration && <span>{l.duration}</span>}
                      {l.workMode && <span>{l.workMode}</span>}
                      {l.teamSize != null && <span>team of {l.teamSize}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
