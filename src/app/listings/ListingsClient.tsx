'use client'

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

export default function ListingsClient({ listings, signedIn, studentName }: {
  listings: ListingCardData[]
  signedIn: boolean
  studentName: string | null
}) {
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listings.map((l) => (
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
      </main>
    </div>
  )
}
