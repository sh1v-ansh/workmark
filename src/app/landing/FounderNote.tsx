import Link from 'next/link'
import { C, F } from './tokens'

export function FounderNote() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '88px 24px' }}>
      <div className="reveal-item mob-col" style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div
          aria-hidden="true"
          style={{
            width: 56, height: 56, borderRadius: 999, flexShrink: 0,
            background: `linear-gradient(135deg, #7F5CFF, ${C.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: '#fff' }}>S</span>
        </div>

        <div>
          <p style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 600, lineHeight: 1.5, color: C.text, margin: '0 0 20px' }}>
            &ldquo;I built Workmark because I saw two problems solving each other — CS students who
            couldn&apos;t get work experience, and small organizations that needed CS help they
            couldn&apos;t afford. The infrastructure to connect them just didn&apos;t exist, so I&apos;m
            building it — starting with students helping students.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Shivansh Soni</div>
              <div style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint }}>Founder · CS student, UMass Amherst</div>
            </div>
            <span style={{ color: C.border }}>·</span>
            <Link href="/about" style={{ fontFamily: F.sans, fontSize: 12.5, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
              Read the full story →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
