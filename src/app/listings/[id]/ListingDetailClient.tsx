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
import { FIT_TIER_BLURB, type FitTier } from '@/lib/matching/fit'
import { FitBadge } from '../ListingsClient'

const MAX_ACTIVE_APPLICATIONS = 5

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
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const atSlotCap = activeApplicationCount >= MAX_ACTIVE_APPLICATIONS

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
        body: JSON.stringify({ listingId: listing.id, responseText, consented: true }),
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

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {signedIn && <Navbar role="student" userName={studentName ?? undefined} />}

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link href="/listings" style={{ fontSize: 12, fontFamily: F.mono, color: C.textFaint, textDecoration: 'none' }}>
          ← All projects
        </Link>

        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>
              {listing.title ?? 'Untitled project'}
            </h1>
            {listing.status !== 'open' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {listing.status}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
            {listing.posterDisplayName && <span>{listing.posterDisplayName}</span>}
            {listing.hoursPerWeek != null && <span>{listing.hoursPerWeek} hrs/wk</span>}
            {listing.estHours != null && <span>~{listing.estHours} hrs total</span>}
            {listing.duration && <span>{listing.duration}</span>}
            {listing.workMode && <span>{listing.workMode}</span>}
            {listing.teamSize != null && <span>team of {listing.teamSize}</span>}
            {listing.declaredDifficulty != null && <span>difficulty {listing.declaredDifficulty}/10</span>}
          </div>
        </div>

        {isOwner && (
          <Card hoverable={false} padding={16}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 13, color: C.textMuted }}>This is your project.</p>
              <Link href={`/listings/${listing.id}/applicants`} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                <Icon name="inbox" size={13} /> View applicants
              </Link>
            </div>
          </Card>
        )}

        {listing.brief && (
          <Card hoverable={false} padding={24}>
            <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{listing.brief}</p>
          </Card>
        )}

        {/* Requirements */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Skills this asks for</h2>
          <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
            Importance is what the poster said matters most — not a minimum you have to clear.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requirements.map((r) => {
              const c = tagColor(r.name)
              const mine = fit?.perSkill.find((s) => s.skillId === r.skillId)
              return (
                <div key={r.skillId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                    {r.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontFamily: F.mono, color: C.textFaint }}>
                    <span>{IMPORTANCE_LABEL[r.requiredLevel] ?? `Level ${r.requiredLevel}`}</span>
                    {mine && (
                      <span style={{ color: mine.present ? '#15803D' : '#B45309' }}>
                        {mine.present ? 'evidenced' : 'no evidence yet'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Fit + apply */}
        {fit && !isOwner && (
          <Card hoverable={false} padding={24}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Your fit</h2>
              <FitBadge tier={fit.tier} missingCount={fit.missingNames.length} />
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
              {FIT_TIER_BLURB[fit.tier]}
              {fit.poolSize > 0 && (
                <span style={{ color: C.textFaint }}> Compared against {fit.poolSize} current applicant{fit.poolSize === 1 ? '' : 's'}.</span>
              )}
            </p>
            {/* Confidence is shown next to the tier, never folded into it —
                two students can share a tier while one's record is
                deployment-backed and the other's is a bare repo link. */}
            <p style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.6, marginBottom: fit.missingNames.length ? 10 : 16 }}>
              {fit.confidence >= 0.99
                ? 'Every skill this asks for is backed by a project we confirmed runs.'
                : fit.confidence <= 0.01
                  ? 'None of your evidence for this listing is backed by a deployment, package, or passing CI — it is all repo links. Deploying a project raises this.'
                  : `${Math.round(fit.confidence * 100)}% of what this listing asks for is backed by a project we confirmed runs; the rest is repo links.`}
            </p>
            {fit.missingNames.length > 0 && (
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
                No evidence yet in: <strong style={{ color: C.textSub }}>{fit.missingNames.join(', ')}</strong>. You can still apply — this is information, not a gate.
              </p>
            )}

            {application ? (
              <div style={{ padding: '12px 16px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <p style={{ fontSize: 13, color: C.textSub }}>
                  You applied on {new Date(application.created_at).toLocaleDateString()} — status <strong>{application.status}</strong>.
                </p>
              </div>
            ) : listing.status !== 'open' ? (
              <p style={{ fontSize: 13, color: C.textFaint }}>This project is no longer accepting applications.</p>
            ) : atSlotCap ? (
              <p style={{ fontSize: 13, color: '#B45309', lineHeight: 1.6 }}>
                You have {activeApplicationCount} active applications, the maximum of {MAX_ACTIVE_APPLICATIONS}. Withdraw one or wait for a response before applying to more.
              </p>
            ) : !showApply ? (
              <button onClick={() => setShowApply(true)} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                Apply to this project
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="apply-note" style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Anything to add (optional)
                  </label>
                  <textarea
                    id="apply-note" value={responseText} onChange={(e) => setResponseText(e.target.value)}
                    rows={4} className="dk-input" style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                    placeholder="Context the poster wouldn't get from your record alone. No resume needed — your verified record is the resume."
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="dk-checkbox" style={{ marginTop: 3 }} />
                  <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    I agree to share my verified skill record with this poster — the skills evidenced by my linked repos, the depth computed for each, and which of their required skills I have no evidence in. A record of exactly what was shared is kept in my file.
                  </span>
                </label>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={submitApplication} disabled={submitting || !consented} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                  <button onClick={() => setShowApply(false)} disabled={submitting} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {!signedIn && (
          <Card hoverable={false} padding={24}>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
              <Link href="/login" style={{ color: C.accent, textDecoration: 'none' }}>Sign in</Link> to see how your evidenced skills match this project and to apply.
            </p>
          </Card>
        )}
      </main>
    </div>
  )
}
