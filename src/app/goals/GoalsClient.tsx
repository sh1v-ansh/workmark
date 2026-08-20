'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Section, { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { FIT_TIER_TONE } from '@/lib/theme/fitTier'
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

/** A single number carrying a whole argument. Deliberately oversized. */
function BigStat({ value, suffix, caption, tone }: { value: string | number; suffix?: string; caption: string; tone?: string }) {
  return (
    <Card hoverable={false} padding={18} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: F.display, fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: tone ?? C.text }}>
        {value}
        {suffix && <span style={{ fontSize: 17, color: C.textGhost }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.4, marginTop: 6 }}>{caption}</div>
    </Card>
  )
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

  const [topGap, ...otherGaps] = data.gaps
  const topRecs = data.recommendations.slice(0, 3)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={data.studentName ?? undefined} />

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        <h1 style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 16 }}>
          What to build next
        </h1>

        {/* Focal band. The single gap worth closing takes two thirds; the
            evidence for the claim takes the last third as two numbers, so
            the argument is legible before a word of it is read. */}
        {topGap ? (
          <div className="nb-g3" style={{ marginBottom: 20 }}>
            <div className="nb-focal nb-s2" style={{ padding: '22px 24px' }}>
              <Kicker style={{ color: C.accentInk }}>The one gap worth closing</Kicker>
              <p style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15, color: C.text, margin: '11px 0 10px' }}>
                Build something with {topGap.name}.
              </p>
              <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, maxWidth: 420, marginBottom: 18 }}>
                {topGap.listingCount === 1
                  ? `One of the projects open right now asks for ${topGap.name}, and nothing in your record touches it.`
                  : `${topGap.listingCount} of the projects open right now ask for ${topGap.name}, and nothing in your record touches it.`}
                {' '}One weekend project would put it there permanently.
              </p>
              {data.agentsAvailable ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
                  <Button
                    variant="accent"
                    onClick={() => buildFor(topGap.skillId, topGap.name)}
                    busyLabel={buildingSkill === topGap.skillId ? 'Thinking…' : null}
                  >
                    Write me the brief
                  </Button>
                  <span style={{ fontSize: 12.5, color: C.textGhost }}>You can change it before you start</span>
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: C.textGhost }}>
                  Project briefs need an Anthropic API key configured. The gap itself stands either way.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'stretch' }}>
              <BigStat
                value={topGap.listingCount}
                suffix={`/${data.derivedFromListings}`}
                caption={`of the open projects ask for ${topGap.name}`}
              />
              <BigStat value={0} caption="repositories of yours touch it" tone={state.caution} />
            </div>
          </div>
        ) : (
          <Card hoverable={false} padding={22} style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: F.display, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 8 }}>
              Nothing open is asking for something you don&apos;t have.
            </p>
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, maxWidth: 520 }}>
              {data.derivedFromListings === 0
                ? 'There are no open projects to compare against yet. This page fills in as projects get posted.'
                : 'Every skill the open projects ask for is already evidenced somewhere in your record. Apply to something, or build for its own sake.'}
            </p>
          </Card>
        )}

        {/* Honesty about the sample size — §8 says say so when it's thin,
            rather than presenting a distribution that isn't one. */}
        {data.thinData && (
          <div style={{ background: state.cautionBg, borderRadius: R.md, padding: '11px 15px', fontSize: 13, color: '#6B3A0A', lineHeight: 1.5, marginBottom: 26 }}>
            {data.derivedFromListings === 0
              ? 'There are no open projects yet, so there is nothing to derive demand from. This fills in as projects get posted.'
              : `This is derived from only ${data.derivedFromListings} project${data.derivedFromListings === 1 ? '' : 's'}, so treat it as a sample rather than the market. It sharpens as more get posted.`}
          </div>
        )}

        {/* Three across reads as a set you choose from. The same three
            stacked would read as a queue you work through. */}
        <Section
          label="Open now, and you already fit"
          explain={topRecs.length > 0 ? 'The percentage is how much of what each project asks for your record already covers.' : undefined}
          aside={<span style={{ fontSize: 12.5, color: C.textGhost }}>{data.activeApplicationCount}/5 slots used</span>}
        >
          {topRecs.length === 0 ? (
            <Card hoverable={false} padding={20}>
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.55, maxWidth: 580 }}>
                {data.openListingCount === 0
                  ? 'Nothing is open right now. Rather than invent a plan for an empty marketplace: build, and the evidence is on your record whenever projects do appear.'
                  : "You've applied to everything currently open. The most useful thing you can do now is build — evidence you add today is what you'll be matched on tomorrow."}
              </p>
            </Card>
          ) : (
            <div className="nb-g3">
              {topRecs.map((r) => (
                <Card key={r.id} href={`/listings/${r.id}`} padding={17}>
                  <p style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3, color: C.text, marginBottom: 5 }}>
                    {r.title}
                  </p>
                  <p style={{ fontSize: 12, color: C.textGhost, marginBottom: 13 }}>{r.posterName ?? 'Unnamed poster'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                    <div style={{ flexGrow: 1, height: 5, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(r.matchedShare * 100)}%`, height: '100%', background: C.accent }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.accentInk, fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(r.matchedShare * 100)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <Badge tone={FIT_TIER_TONE[r.tier]}>{FIT_TIER_LABEL[r.tier]}</Badge>
                    {r.missingNames.length > 0 && (
                      <span style={{ fontSize: 11.5, color: C.textGhost }}>
                        missing {r.missingNames.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {otherGaps.length > 0 && (
          <Section label="Other gaps" explain="Worth doing, but none would change as much as the one above.">
            <Card hoverable={false} padding="4px 18px 8px">
              {otherGaps.map((g, i) => (
                <div
                  key={g.skillId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    padding: '11px 0', flexWrap: 'wrap',
                    borderBottom: i < otherGaps.length - 1 ? `1px solid ${C.borderFaint}` : 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: C.textSub, marginBottom: 2 }}>{g.name}</p>
                    <p style={{ fontSize: 12, color: C.textGhost }}>
                      Asked for by {g.listingCount} of {data.derivedFromListings} open project{data.derivedFromListings === 1 ? '' : 's'}
                    </p>
                  </div>
                  {data.agentsAvailable && (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => buildFor(g.skillId, g.name)}
                      busyLabel={buildingSkill === g.skillId ? 'Thinking…' : null}
                    >
                      Get a brief
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          </Section>
        )}

        {data.strengths.length > 0 && (
          <Section label="Already covered" explain="Skills you have evidence in that open projects are asking for." gap={24}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.strengths.map((s) => (
                <span
                  key={s.skillId}
                  style={{ fontSize: 12, fontWeight: 600, color: C.accentInk, background: '#EDE9FF', borderRadius: R.sm, padding: '6px 11px' }}
                >
                  {s.name} · asked for by {s.listingCount}
                </span>
              ))}
            </div>
          </Section>
        )}

        <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.55, borderTop: `1px solid ${C.border}`, paddingTop: 15 }}>
          Nothing here is a prediction. It is a count of what open projects ask for, compared against what your linked repositories show —{' '}
          <Link href="/me" style={{ color: C.textMuted, textDecoration: 'none' }}>see your record</Link>.
        </p>
      </main>
    </div>
  )
}
