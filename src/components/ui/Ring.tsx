import { C, F } from '@/lib/theme/dark-tokens'

/**
 * A proportion drawn as a ring rather than written as a number.
 *
 * A bar has to be read left to right and compared against its own track; a
 * ring is a shape you recognise at a glance, which is the whole point when
 * the number is meant to be understood before the page is read.
 *
 * Rotated -90deg so the arc starts at twelve o'clock, where people expect a
 * dial to start.
 */
export default function Ring({ pct, size = 72, stroke = 7 }: { pct: number; size?: number; stroke?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  const r = (size - stroke) / 2 - 1
  const circumference = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={C.accent} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: F.display, fontSize: size * 0.24, fontWeight: 800, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums', color: C.text,
        }}
      >
        {clamped}%
      </div>
    </div>
  )
}
