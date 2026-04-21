'use client'

import { C, F } from './tokens'

export function TeamSection() {
  return (
    <section aria-labelledby="team-heading" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 id="team-heading" style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        The team
      </h2>

      <div className="mob-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }}>
        {/* Left: founder */}
        <div className="reveal-item">
          {/* Avatar */}
          <div aria-hidden="true" style={{ width: 64, height: 64, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <span style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: C.accent }}>S</span>
          </div>

          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Founder
          </div>
          <h2 style={{ fontFamily: F.serif, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, lineHeight: 1.2, marginBottom: 6 }}>
            Shivansh Soni
          </h2>
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, marginBottom: 24 }}>
            CS student, UMass Amherst
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.75 }}>
              I built Workmark because I watched it happen firsthand — smart people with real skills getting filtered out before the first call. Not because they couldn&apos;t code. Because they didn&apos;t have the right name on their résumé, the right connection, or the first internship that unlocks every subsequent one.
            </p>
            <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.75 }}>
              Hiring is broken in a specific, structural way — and it&apos;s most broken for first-generation students, international students, and anyone who didn&apos;t go to a target school. Workmark exists to fix that. Not by gaming the system, but by replacing the broken part: the self-reported résumé. Demonstrated capability should be the currency — not credentials, not connections.
            </p>
            <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.75 }}>
              Workmark is a student-built platform, made by a student for students. One person trying to change the way hiring works, starting with CS. If it resonates, reach out.
            </p>
          </div>
        </div>

        {/* Right: mission + contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Mission */}
          <div className="reveal-item" style={{ transitionDelay: '0.1s', background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, padding: 28 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Workmark&apos;s mission</div>
            <blockquote style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 500, color: C.text, lineHeight: 1.6, margin: 0 }}>
              Change the way hiring works — make it fair. Workmark replaces the self-reported résumé with something that actually means something: proof.
            </blockquote>
          </div>

          {/* Pull quote */}
          <div className="reveal-item" style={{ transitionDelay: '0.2s', background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.border}`, padding: 28 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>On hiring</div>
            <blockquote style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 500, color: C.textSub, lineHeight: 1.65, margin: 0 }}>
              The résumé is self-reported noise. The only thing that should matter is whether you can actually ship. Workmark makes that verifiable.
            </blockquote>
          </div>

          {/* Contact */}
          <div className="reveal-item" style={{ transitionDelay: '0.3s', background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Get in touch
            </div>
            <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 20 }}>
              Whether you&apos;re a student who wants to build their Workmark record, an organization interested in posting, or just curious about the mission — I&apos;d like to hear from you.
            </p>

            <a
              href="mailto:shivansh@workmark.org"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '11px 20px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text, fontFamily: F.mono, fontSize: 13, textDecoration: 'none', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
                <rect x="1" y="2.5" width="12" height="9" rx="0.5" stroke={C.accent} strokeWidth="1"/>
                <path d="M1 3.5l6 4 6-4" stroke={C.accent} strokeWidth="1" strokeLinecap="round"/>
              </svg>
              shivansh@workmark.org
            </a>

            <div style={{ marginTop: 16, fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
              Response time is usually within a day.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
