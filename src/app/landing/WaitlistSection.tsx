import Link from 'next/link'
import { C, F } from './tokens'

export function JoinSection() {
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '100px 24px', textAlign: 'center', background: C.bgDeep, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 500, background: 'radial-gradient(ellipse at center, rgba(62,31,255,0.10) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="reveal-item" style={{ maxWidth: 560, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
          Join Workmark
        </div>
        <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>
          Start building your<br />Workmark record.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 40 }}>
          Students: start stacking real, verified work experience — free, forever. Organizations: post your first project and get real CS help without an agency in the middle.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <Link href="/login" className="wm-btn wm-btn-primary">
            I&apos;m a student →
          </Link>
          <Link href="/login" className="wm-btn wm-btn-secondary-invert">
            Post a project
          </Link>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: F.mono }}>
          Students always free · Organizations: free to start, no credit card required
        </p>
      </div>
    </section>
  )
}
