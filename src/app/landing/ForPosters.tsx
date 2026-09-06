'use client'

import Link from 'next/link'
import { C, F } from './tokens'

/**
 * The other side of the marketplace, in one section rather than half a page.
 *
 * Students are the side that has to exist first — a project board with
 * nobody on it is worth nothing to a professor, while a record is worth
 * something to a student on day one. So posters get an honest section and
 * not equal billing, and the section's job is to answer the two questions a
 * professor actually has: what does this cost me, and is the person any
 * good.
 */

const POINTS = [
  ['Post in a few minutes', 'Describe the work, or let Workmark draft it from a couple of lines. Say which skills matter and how much time it needs.'],
  ['See evidence, not adjectives', 'Every applicant arrives with a record you can inspect — which project each skill came from, and how it was checked.'],
  ['Free, and no contract to sign', 'Faculty, research groups, student teams and nonprofits. Nothing to pay and nothing to install.'],
]

export function ForPosters() {
  return (
    <section className="wm-section" style={{ background: '#FBFBFD', borderTop: `1px solid ${C.border}` }}>
      <div className="wm-section-inner">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 56, alignItems: 'start' }} className="mob-1col">
          <div>
            <span className="wm-eyebrow-2">If you have work that needs doing</span>
            <h2 className="wm-h2">Post a project, and see who can actually do it</h2>
            <p className="wm-lede" style={{ marginBottom: 24 }}>
              For faculty, research groups and anyone with real work and no budget for it.
              Applicants come with a record built from code they wrote, so the first thing you
              read is what they have done rather than how they describe themselves.
            </p>
            <Link href="/listings/new" className="wm-cta-ghost">Post a project</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {POINTS.map(([title, body]) => (
              <div
                key={title}
                style={{
                  background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: '17px 19px',
                  boxShadow: '0 1px 1px rgba(25,30,46,0.03), 0 10px 24px -16px rgba(25,30,46,0.22)',
                }}
              >
                <p style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{title}</p>
                <p style={{ fontFamily: F.sans, fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, textWrap: 'pretty' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
