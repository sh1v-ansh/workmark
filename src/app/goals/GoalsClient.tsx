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
import { FIT_TIER_LABEL, type FitTier } from '@/lib/matching/fit'

export interface GoalsData {
  studentName: string | null
  activeApplicationCount: number
  openListingCount: number
  derivedFromListings: number
  thinData: boolean
  gaps: { skillId: string; name: string; listingCount: number }[]
  strengths: { skillId: string; name: string; listingCount: number; depth: number }[]
  recommendations: {
    id: string
    title: string
    posterName: string | null
    tier: FitTier
    matchedShare: number
    missingNames: string[]
    skillNames: string[]
  }[]
  agentsAvailable: boolean
}

const TIER_COLOR: Record<FitTier, string> = {
  strong_fit: '#15803D',
  competitive: '#0369A1',
  reach: '#B45309',
  not_yet: '#6B7280',
}

export default function GoalsClient({ data }: { data: GoalsData }) {
  const router = useRouter()
  const { toast } = useToast()
  const [buildingSkill, setBuildingSkill] = useState<string | null>(null)

  // The hand-off §8 describes: when nothing open closes a gap, name the
  // skill and offer a project brief targeting it, rather than fabricating
  // a plan for an empty marketplace.
  async function buildFor(skillId: string, name: string) {
    setBuildingSkill(skillId)
    try {
      const res = await fetch('/api/agents/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not generate.')
      toast(`Project idea ready for ${name}.`, 'success')
      router.push('/me/briefs')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not generate.', 'error')
    } finally {
      setBuildingSkill(null)
    }
  }

  const nothingOpen = data.recommendations.length === 0

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={data.studentName ?? undefined} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
            What to do next
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            Built from what open projects actually ask for, compared against what your linked repos demonstrate.
          </p>
        </div>

        {/* Honesty about the sample size — §8 says say so when it's seeded
            or thin, rather than presenting a distribution that isn't one. */}
        {data.thinData && (
          <Card hoverable={false} padding={16} style={{ borderColor: 'rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.06)' }}>
            <p style={{ fontSize: 12, color: '#B45309', lineHeight: 1.6 }}>
              {data.derivedFromListings === 0
                ? "There are no open projects yet, so there's nothing to derive demand from. What's below will fill in as projects get posted."
                : `This is derived from only ${data.derivedFromListings} project${data.derivedFromListings === 1 ? '' : 's'}, so treat it as a sample rather than a trend. It gets more reliable as more get posted.`}
            </p>
          </Card>
        )}

        {/* Gaps — the actionable half */}
        {data.gaps.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              What&apos;s missing from your record
            </h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Skills open projects ask for that nothing in your linked repos demonstrates. Each one is a project away from being on your record.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.gaps.map((g) => {
                const c = tagColor(g.name)
                return (
                  <div key={g.skillId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                        {g.name}
                      </span>
                      <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {g.listingCount} project{g.listingCount === 1 ? '' : 's'} want this
                      </span>
                    </div>
                    {data.agentsAvailable && (
                      <button
                        onClick={() => buildFor(g.skillId, g.name)}
                        disabled={buildingSkill === g.skillId}
                        className="wm-btn wm-btn-secondary wm-btn-sm"
                        style={{ display: 'inline-flex' }}
                      >
                        {buildingSkill === g.skillId ? 'Thinking…' : 'Get something to build'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Recommendations */}
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Where you can act today</h2>
            <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
              {data.activeApplicationCount}/5 slots used
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
            Open projects you haven&apos;t applied to, best fit first.
          </p>

          {nothingOpen ? (
            <Card hoverable={false} padding={24}>
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: data.gaps.length ? 14 : 0 }}>
                {data.openListingCount === 0
                  ? "Nothing is open right now. Rather than invent a plan for an empty marketplace: build something in one of the skills below, and it's on your record whenever projects do appear."
                  : "You've applied to everything currently open. The most useful thing you can do now is build — evidence you add today is what you'll be matched on tomorrow."}
              </p>
              {data.gaps.length > 0 && data.agentsAvailable && (
                <button
                  onClick={() => buildFor(data.gaps[0].skillId, data.gaps[0].name)}
                  disabled={buildingSkill === data.gaps[0].skillId}
                  className="wm-btn wm-btn-primary wm-btn-sm"
                  style={{ display: 'inline-flex' }}
                >
                  <Icon name="plus" size={12} /> Get a project idea for {data.gaps[0].name}
                </button>
              )}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.recommendations.map((r) => (
                <Card key={r.id} href={`/listings/${r.id}`} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.title}</p>
                      <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                        {[r.posterName, `${Math.round(r.matchedShare * 100)}% of what it asks for`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: TIER_COLOR[r.tier], fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {FIT_TIER_LABEL[r.tier]}
                    </span>
                  </div>
                  {r.missingNames.length > 0 && (
                    <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.5 }}>
                      Missing: {r.missingNames.join(', ')}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Strengths — last, because it's reassurance rather than action */}
        {data.strengths.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>What&apos;s working</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Skills you have evidence in that open projects are asking for.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.strengths.map((s) => {
                const c = tagColor(s.name)
                return (
                  <span key={s.skillId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                    {s.name}
                    <span style={{ fontWeight: 400, opacity: 0.7 }}>{s.listingCount} want it</span>
                  </span>
                )
              })}
            </div>
          </section>
        )}

        <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          Nothing here is a prediction. It&apos;s a count of what open projects ask for, compared against what your linked repos show —{' '}
          <Link href="/me" style={{ color: C.textMuted, textDecoration: 'none' }}>see your record</Link>.
        </p>
      </main>
    </div>
  )
}
