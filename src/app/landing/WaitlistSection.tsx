import Link from 'next/link'
import { C, F } from './tokens'

export function JoinSection() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '100px 24px', textAlign: 'center', background: C.bgDeep, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 500, background: 'radial-gradient(ellipse at center, rgba(200,117,51,0.07) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="reveal-item" style={{ maxWidth: 520, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
          Now open
        </div>
        <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, lineHeight: 1.1, marginBottom: 16 }}>
          Start building<br />your record.
        </h2>
        <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.7, marginBottom: 40 }}>
          Students sign up free. Organizations post their first 3 projects at no cost, no commitment.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          <Link
            href="/login"
            style={{ padding: '14px 28px', background: C.accent, color: C.bg, fontWeight: 600, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            I&apos;m a student →
          </Link>
          <Link
            href="/login"
            style={{ padding: '14px 28px', border: `1px solid ${C.border}`, color: C.text, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Post a project
          </Link>
        </div>

        <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
          Students always free · Organizations: free for first 3 projects
        </p>
      </div>
    </section>
  )
}
