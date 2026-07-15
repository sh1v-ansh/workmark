import { C, F } from './tokens'

/**
 * The recurring trust mark — makes the verification mechanism recognizable
 * wherever a record appears, the same way a padlock icon signals "secure."
 */
export function VerificationSeal({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 18, height: 18, borderRadius: 999, flexShrink: 0,
          background: `linear-gradient(135deg, #7F5CFF, ${C.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5.2l2 2 4-4.4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ fontFamily: F.sans, fontSize: compact ? 10.5 : 12, fontWeight: 600, letterSpacing: '0.03em', color: C.textSub }}>
        {compact ? 'Identity · Duration · Confirmation' : 'Verified by identity, duration & poster confirmation'}
      </span>
    </div>
  )
}
