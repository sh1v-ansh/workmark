'use client'

import { C, F } from './tokens'

export function Capabilities() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, background: C.surfaceAlt, padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="reveal-item" style={{ maxWidth: 760, marginBottom: 56 }}>
          <div className="wm-eyebrow" style={{ marginBottom: 22 }}>What we&apos;re building on top</div>
          <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 46, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', color: C.text, margin: '0 0 20px' }}>
            A database this rich unlocks things a résumé never could.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted }}>
            Once work is verified and structured, matching, verification, and discovery stop
            being guesswork. Here&apos;s what that makes possible.
          </p>
        </div>

        {/* Bento grid */}
        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Probability matching — the showcase card with diagram */}
          <div className="reveal-item wm-card" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 32 }}>
            <FeatureLabel>AI job matching</FeatureLabel>
            <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>
              Probability-based applications
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: C.textMuted, marginBottom: 24 }}>
              We rank openings by how likely you are to actually land an interview, based on your
              verified records, not keywords. Spend your effort where it converts.
            </p>
            <BrowserFrame url="app.workmark.org/matches">
              <MatchDiagram />
            </BrowserFrame>
          </div>

          {/* AI verification */}
          <div className="reveal-item wm-card" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column' }}>
            <FeatureLabel>AI verification agents</FeatureLabel>
            <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>
              Proof, checked automatically
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: C.textMuted, marginBottom: 24 }}>
              Agents corroborate each record, cross-checking poster confirmation, engagement
              duration, and public work, and summarize a student&apos;s GitHub into the concrete
              skills they actually shipped.
            </p>
            <div style={{ marginTop: 'auto' }}>
              <BrowserFrame url="app.workmark.org/verify/agent-run">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <AgentRow label="GitHub summarization" value="12 repos → 8 skills" done />
                  <AgentRow label="Poster attestation" value="Confirmed" done />
                  <AgentRow label="Duration check" value="6 wks verified" done />
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>

        {/* Lower row */}
        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <SmallFeature
            label="Precision filters"
            title="Find the exact fit"
            body="Filter people and projects by verified stack, real duration, availability, and work authorization, not fuzzy keyword guesses."
          />
          <SmallFeature
            label="Student ↔ student"
            title="Build together first"
            body="Students hire and collaborate with other students on real projects, earning verified records before a single business is involved."
          />
          <SmallFeature
            label="Portable & owned"
            title="Yours forever"
            body="Every record belongs to the student: permanent, exportable, and trusted anywhere hiring happens."
          />
        </div>
      </div>
    </section>
  )
}

/** Wraps a diagram in browser chrome so it reads as a real product view, not a floating mockup. */
function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#E5E4EF' }} />
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#E5E4EF' }} />
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#E5E4EF' }} />
        </div>
        <div style={{ flex: 1, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="2.5" y="4.5" width="5" height="4" rx="0.5" stroke={C.textGhost} strokeWidth="0.9" />
            <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" stroke={C.textGhost} strokeWidth="0.9" />
          </svg>
          <span style={{ fontFamily: F.sans, fontSize: 10.5, color: C.textFaint }}>{url}</span>
        </div>
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  )
}

function FeatureLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function AgentRow({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: done ? C.accent : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {done && (
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4.2l1.8 1.8L6.5 2.2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span style={{ fontSize: 13, color: C.textSub }}>{label}</span>
      </div>
      <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.accent }}>{value}</span>
    </div>
  )
}

function SmallFeature({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="reveal-item wm-card" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
      <FeatureLabel>{label}</FeatureLabel>
      <h3 style={{ fontFamily: F.serif, fontSize: 21, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: C.textMuted, margin: 0 }}>{body}</p>
    </div>
  )
}

function MatchDiagram() {
  const rows = [
    { role: 'Backend Intern · Fintech startup', pct: 92 },
    { role: 'Full-Stack SWE · Seed SaaS', pct: 78 },
    { role: 'Data Eng · Research lab', pct: 54 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.role} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.textSub, fontWeight: 500 }}>{r.role}</span>
            <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.accent }}>{r.pct}%</span>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${r.pct}%`, height: '100%', background: `linear-gradient(90deg, #7F5CFF, ${C.accent})`, borderRadius: 999 }} />
          </div>
        </div>
      ))}
      <p style={{ fontFamily: F.sans, fontSize: 12, color: C.textFaint, margin: '4px 0 0' }}>
        Interview likelihood, computed from verified records
      </p>
    </div>
  )
}
