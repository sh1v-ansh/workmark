'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Ring from '@/components/ui/Ring'
import Drawer from '@/components/ui/Drawer'
import { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { FIT_TIER_TONE } from '@/lib/theme/fitTier'
import { tagColor } from '@/lib/theme/tagColors'
import { FIT_TIER_LABEL, FIT_TIER_BLURB, type FitTier } from '@/lib/matching/fit'

const MAX_ACTIVE_APPLICATIONS = 5
// Must match MIN/MAX_RESPONSE_WORDS in the apply route — the server is
// authoritative; these exist so the button disables before a round trip.
const MIN_WORDS = 50
const MAX_WORDS = 250

interface Listing {
  id: string
  title: string | null
  brief: string | null
  posterId: string
  posterDisplayName: string | null
  status: string
  estHours: number | null
  hoursPerWeek: number | null
  duration: string | null
  workMode: string | null
  teamSize: number | null
  declaredDifficulty: number | null
  createdAt: string
}

interface Fit {
  tier: FitTier
  rankScore: number
  confidence: number
  poolSize: number
  perSkill: { skillId: string; name: string; requiredLevel: number; depth: number; present: boolean }[]
  missingNames: string[]
}

const IMPORTANCE_LABEL: Record<number, string> = {
  1: 'Nice to have', 2: 'Helpful', 3: 'Important', 4: 'Core', 5: 'Essential',
}

export default function ListingDetailClient({
  listing, requirements, fit, application, isOwner, signedIn, studentName, activeApplicationCount,
}: {
  listing: Listing
  requirements: { skillId: string; name: string; requiredLevel: number }[]
  fit: Fit | null
  application: { id: string; status: string; fit_tier_at_apply: string | null; created_at: string } | null
  isOwner: boolean
  signedIn: boolean
  studentName: string | null
  activeApplicationCount: number
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [showApply, setShowApply] = useState(false)
  const [responseText, setResponseText] = useState('')
  // Pre-ticked where the student already has evidence — the point of the
  // checkbox isn't data collection, it's that ticking a skill your record
  // doesn't back is a visible act rather than something a paragraph can
  // imply vaguely.
  const [claimed, setClaimed] = useState<Set<string>>(
    () => new Set((fit?.perSkill ?? []).filter((s) => s.present).map((s) => s.skillId)),
  )
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const atSlotCap = activeApplicationCount >= MAX_ACTIVE_APPLICATIONS
  const wordCount = responseText.trim() ? responseText.trim().split(/\s+/).length : 0
  // The highest-weighted requirement is what the response is scoped to;
  // ties break on listing order, which is the poster's own ordering.
  const topRequirement = requirements.length
    ? requirements.reduce((a, b) => (b.requiredLevel > a.requiredLevel ? b : a))
    : null
  const canSubmit = consented && wordCount >= MIN_WORDS && wordCount <= MAX_WORDS

  async function submitApplication() {
    if (!consented) {
      toast('Please consent to sharing your verified record.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          responseText,
          claimedSkills: Array.from(claimed),
          consented: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not submit.')
      toast('Application submitted.', 'success')
      setShowApply(false)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not submit.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Whether the apply action is reachable at all right now — governs both
  // the top verdict card's CTA and whether the bottom bar renders.
  const applyState: 'apply' | 'applied' | 'closed' | 'capped' | 'owner' | 'signedOut' =
    isOwner ? 'owner'
    : !signedIn ? 'signedOut'
    : application ? 'applied'
    : listing.status !== 'open' ? 'closed'
    : atSlotCap ? 'capped'
    : 'apply'

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {signedIn && <Navbar role="student" userName={studentName ?? undefined} />}

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: `30px 28px ${applyState === 'apply' ? 99 : 66}px` }}>

        <Link href="/listings" style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>← Find work</Link>

        <div style={{ maxWidth: 750, margin: '14.5px 0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 9 }}>
            <h1 style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: C.text }}>
              {listing.title ?? 'Untitled project'}
            </h1>
            {listing.status !== 'open' && <Badge>{listing.status}</Badge>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 11, fontSize: 14, color: C.textMuted }}>
            {listing.posterDisplayName && <span>{listing.posterDisplayName}</span>}
            {[listing.hoursPerWeek != null ? `${listing.hoursPerWeek} hrs/wk` : null, listing.duration, listing.workMode, listing.teamSize != null ? `team of ${listing.teamSize}` : null, listing.estHours != null ? `~${listing.estHours} hrs total` : null, listing.declaredDifficulty != null ? `difficulty ${listing.declaredDifficulty}/10` : null]
              .filter(Boolean).map((t, i) => (
                <span key={i} style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, background: C.surfaceAlt, borderRadius: R.sm, padding: '4.5px 10px' }}>{t}</span>
              ))}
          </div>
        </div>

        {isOwner && (
          <Card hoverable={false} padding="14.5px 20px" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: C.textMuted }}>This is your project.</p>
              <Button href={`/listings/${listing.id}/applicants`} variant="ink" size="sm">View applicants</Button>
            </div>
          </Card>
        )}

        {/* Focal band — the answer to "should I bother", above the fold and
            at the largest size on the page. */}
        {fit && !isOwner && (
          <div className="nb-focal" style={{ padding: '24px 27px', marginBottom: 23 }}>
            <div className="nb-split">
              <div>
                <Kicker style={{ color: C.accentInk, marginBottom: 9 }}>Where you stand</Kicker>
                <p style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, color: C.text, marginBottom: 10.5 }}>
                  {FIT_TIER_LABEL[fit.tier]}{fit.missingNames.length > 0 ? ', one gap.' : '.'}
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: C.textMuted }}>
                  {FIT_TIER_BLURB[fit.tier]}
                  {fit.poolSize > 0 && ` Compared against ${fit.poolSize} current applicant${fit.poolSize === 1 ? '' : 's'}.`}
                  {fit.missingNames.length > 0 && (
                    <> No evidence yet in <strong style={{ color: C.textSub }}>{fit.missingNames.join(', ')}</strong> — apply anyway, this is information, not a gate.</>
                  )}
                </p>
              </div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 25 }} className="mob-static">
                <Ring pct={fit.confidence * 100} />
                <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.5, marginTop: 11 }}>
                  {fit.confidence >= 0.99
                    ? 'backed by projects we confirmed run'
                    : fit.confidence <= 0.01
                      ? 'backed by projects that run — none yet, it is all repo links'
                      : 'backed by projects we confirmed run'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!signedIn && (
          <Card hoverable={false} padding={21} style={{ marginBottom: 23 }}>
            <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>
              <Link href="/login" style={{ color: C.accent, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link> to see how your evidenced skills match this project and to apply.
            </p>
          </Card>
        )}

        {/* Brief at two thirds, requirements at one third */}
        <div className="nb-split">
          {listing.brief && (
            <div>
              <Kicker style={{ marginBottom: 11 }}>What {listing.posterDisplayName ?? 'the poster'} wrote</Kicker>
              <p style={{ fontSize: 16, lineHeight: 1.75, color: C.textSub, whiteSpace: 'pre-wrap' }}>{listing.brief}</p>
            </div>
          )}

          <div>
            <Kicker style={{ marginBottom: 5.5 }}>What it asks for</Kicker>
            <p style={{ fontSize: 13, color: C.textGhost, marginBottom: 12 }}>Weighting, not a bar you have to clear.</p>
            <Card hoverable={false} padding="5px 16.5px 9px">
              {requirements.map((r, i) => {
                const c = tagColor(r.name)
                const mine = fit?.perSkill.find((s) => s.skillId === r.skillId)
                return (
                  <div key={r.skillId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 0', borderBottom: i < requirements.length - 1 ? `1px solid ${C.borderFaint}` : 'none', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, padding: '3.5px 9.5px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                      {r.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9.5, fontSize: 12 }}>
                      {mine && (
                        <span style={{ color: mine.present ? state.positive : state.caution, fontWeight: 500 }}>
                          {mine.present ? 'evidenced' : 'no evidence yet'}
                        </span>
                      )}
                      <span style={{ color: C.textGhost, fontWeight: 600 }}>{IMPORTANCE_LABEL[r.requiredLevel] ?? `Level ${r.requiredLevel}`}</span>
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>
        </div>

        {application && !isOwner && (
          <div style={{ marginTop: 23, background: C.surfaceAlt, borderRadius: R.md, padding: '13px 16.5px' }}>
            <p style={{ fontSize: 14, color: C.textSub }}>
              You applied on {new Date(application.created_at).toLocaleDateString()} — status <strong>{application.status}</strong>.
            </p>
          </div>
        )}

        {applyState === 'closed' && (
          <div style={{ marginTop: 23, background: C.surfaceAlt, borderRadius: R.md, padding: '13px 16.5px' }}>
            <p style={{ fontSize: 14, color: C.textFaint }}>This project is no longer accepting applications.</p>
          </div>
        )}

        {/* The apply form lives in a drawer rather than inline: what you're
            writing is an answer to this listing's requirements, so the
            listing stays on screen behind it instead of being replaced by
            a form that opens below the fold. */}
        {applyState === 'apply' && fit && (
          <Drawer
            open={showApply}
            onClose={() => { if (!submitting) setShowApply(false) }}
            title="Apply to this project"
            subtitle={listing.title ?? undefined}
            footer={
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="accent" onClick={submitApplication} disabled={!canSubmit} busyLabel={submitting ? 'Submitting…' : null}>
                  Submit application
                </Button>
                <Button variant="quiet" onClick={() => setShowApply(false)} disabled={submitting}>Cancel</Button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <Kicker style={{ marginBottom: 5.5 }}>Which of these are you claiming?</Kicker>
                <p style={{ fontSize: 13, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
                  Ticked where your record already backs it. You can claim a skill your record doesn&apos;t show — the poster sees both.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6.5 }}>
                  {requirements.map((r) => {
                    const mine = fit.perSkill.find((s) => s.skillId === r.skillId)
                    const isClaimed = claimed.has(r.skillId)
                    return (
                      <label key={r.skillId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9.5px 13px', background: C.bg, borderRadius: R.md, cursor: 'pointer' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 9.5 }}>
                          <input
                            type="checkbox" checked={isClaimed} className="dk-checkbox"
                            onChange={(e) => {
                              const next = new Set(claimed)
                              if (e.target.checked) next.add(r.skillId); else next.delete(r.skillId)
                              setClaimed(next)
                            }}
                          />
                          <span style={{ fontSize: 14, color: C.textSub, fontWeight: 500 }}>{r.name}</span>
                        </span>
                        <span style={{ fontSize: 12, color: mine?.present ? state.positive : C.textGhost, fontWeight: 600 }}>
                          {mine?.present ? 'evidenced' : 'no evidence'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="apply-note" style={{ display: 'block' }}>
                  <Kicker style={{ marginBottom: 5.5 }}>{topRequirement ? `About ${topRequirement.name}` : 'Your response'}</Kicker>
                </label>
                <p style={{ fontSize: 13, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
                  {topRequirement
                    ? `This listing weights ${topRequirement.name} highest. What have you actually built with it?`
                    : 'What makes you a fit for this project?'}
                </p>
                <textarea
                  id="apply-note" value={responseText} onChange={(e) => setResponseText(e.target.value)}
                  rows={6} className="dk-textarea" style={{ fontFamily: 'inherit', lineHeight: 1.65, fontSize: 15 }}
                  placeholder="Be specific about what you built and what was hard about it. No resume needed — your verified record is the resume."
                />
                <p style={{ fontSize: 13, color: wordCount > MAX_WORDS ? '#B91C1C' : C.textGhost, marginTop: 6.5 }}>
                  {wordCount} word{wordCount === 1 ? '' : 's'}
                  {wordCount < MIN_WORDS ? ` · ${MIN_WORDS - wordCount} more needed` : wordCount > MAX_WORDS ? ` · ${wordCount - MAX_WORDS} over the limit` : ' · good'}
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="dk-checkbox" style={{ marginTop: 3 }} />
                <span style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
                  I agree to share my verified skill record with this poster — the skills evidenced by my linked repos, the depth computed for each, and which of their required skills I have no evidence in. A record of exactly what was shared is kept in my file.
                </span>
              </label>

            </div>
          </Drawer>
        )}
      </main>

      {/* The action follows the reader instead of sitting in a column
          competing with the brief for attention. */}
      {applyState === 'apply' && fit && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(250,247,240,0.94)', backdropFilter: 'blur(6px)', borderTop: `1px solid ${C.border}`, padding: '14.5px 28px', zIndex: 30 }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: C.textMuted }}>Four checkboxes and one short answer. About five minutes.</span>
            <Button variant="accent" onClick={() => setShowApply(true)}>Apply to this project</Button>
          </div>
        </div>
      )}
      {applyState === 'capped' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(250,247,240,0.94)', backdropFilter: 'blur(6px)', borderTop: `1px solid ${C.border}`, padding: '14.5px 28px', zIndex: 30 }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <p style={{ fontSize: 14, color: state.caution }}>
              You have {activeApplicationCount} active applications, the maximum of {MAX_ACTIVE_APPLICATIONS}. Withdraw one or wait for a response before applying to more.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
