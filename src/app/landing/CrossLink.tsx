'use client'

import { COPY, type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The band that points at the other half of the marketplace.
 *
 * It flips the switch rather than navigating, because both stories live on
 * this page and sending someone to a second URL to read the other one would
 * mean maintaining two pages that have to agree with each other.
 *
 * It replaced a full section arguing the poster's case on the student page.
 * That section gave the two sides equal billing, which is wrong for where
 * this product is: a project board with nobody on it is worth nothing to a
 * professor, while a record is worth something to a student on day one. The
 * demand side has to exist first, so the other audience gets a door rather
 * than a chapter.
 */
export function CrossLink({
  audience,
  onAudienceChange,
}: {
  audience: Audience
  onAudienceChange: (next: Audience) => void
}) {
  const copy = COPY[audience].crossLink
  const other: Audience = audience === 'students' ? 'businesses' : 'students'

  return (
    <section className="wm-section" style={{ paddingTop: 72 }}>
      <div className="wm-section-inner">
        <div className="wm-crosslink">
          <div style={{ minWidth: 0, position: 'relative' }}>
            <span className="wm-eyebrow-2" style={{ marginBottom: 8 }}>{copy.eyebrow}</span>
            <h2 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, lineHeight: 1.24, marginBottom: 8, textWrap: 'pretty' }}>
              {copy.headline}
            </h2>
            <p style={{ fontFamily: F.sans, fontSize: 15, color: C.textMuted, lineHeight: 1.62, maxWidth: '54ch', textWrap: 'pretty' }}>
              {copy.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onAudienceChange(other)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="wm-cta-ghost"
            style={{ flexShrink: 0, position: 'relative' }}
          >
            {copy.cta} →
          </button>
        </div>
      </div>
    </section>
  )
}
