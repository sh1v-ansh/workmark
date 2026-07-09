import Link from 'next/link'
import { LogoMark } from '@/app/landing/LogoMark'
import { C, F } from '@/lib/theme/dark-tokens'
import type { Faculty } from '@/lib/types'

export default function FacultyPendingScreen({ faculty }: { faculty: Faculty }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 48 }}>
        <LogoMark size={20} />
        <span style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>workmark</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 440, background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ width: 48, height: 48, background: C.surfaceAlt, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke={C.textFaint} strokeWidth="1.2" />
            <path d="M10 6v4.5" stroke={C.textFaint} strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="10" cy="14" r="0.8" fill={C.textFaint} />
          </svg>
        </div>

        <h1 style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 700, color: C.text, marginBottom: 12, letterSpacing: '-0.01em' }}>
          Account pending review
        </h1>

        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>
          Your faculty account has been created and is awaiting manual verification.
        </p>

        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 32 }}>
          We typically review accounts within 1–2 business days. You&apos;ll be able to post projects and review applications once approved.
        </p>

        {/* Profile summary */}
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '14px 18px', marginBottom: 32, textAlign: 'left' }}>
          <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Submitted details</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Name', value: faculty.full_name },
              { label: 'Title', value: faculty.title },
              { label: 'Institution', value: faculty.institution },
              { label: 'Department', value: faculty.department },
              { label: 'Email', value: faculty.email },
            ].filter(({ value }) => !!value).map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, width: 80, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 12, color: C.textSub }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <Link href="/projects" style={{ display: 'block', padding: '10px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Browse open projects →
        </Link>
      </div>

      <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, marginTop: 24 }}>
        Questions? Reach out to the Workmark team.
      </p>
    </div>
  )
}
