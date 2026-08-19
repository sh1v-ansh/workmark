import { C, F } from '@/lib/theme/dark-tokens'

/**
 * A section label, and optionally one line saying why the section exists.
 *
 * The `explain` line is not decoration. "Where you've applied" names a
 * database query; "waiting on someone else — nothing here needs you" names
 * the reader's situation, which is the thing they actually came to find out.
 * Where a heading can't carry that on its own, this is where it goes.
 */
export function Kicker({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: F.display, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.13em', textTransform: 'uppercase', color: C.textGhost,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function Section({
  label,
  explain,
  aside,
  children,
  gap = 36,
}: {
  label: string
  explain?: string
  aside?: React.ReactNode
  children: React.ReactNode
  gap?: number
}) {
  return (
    <section style={{ marginBottom: gap }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, marginBottom: explain ? 5 : 13, flexWrap: 'wrap' }}>
        <Kicker>{label}</Kicker>
        {aside}
      </div>
      {explain && (
        <p style={{ fontSize: 15, color: C.textFaint, lineHeight: 1.5, marginBottom: 15, maxWidth: 560 }}>{explain}</p>
      )}
      {children}
    </section>
  )
}

/** A large number with its caption. Size is the hierarchy — resist shrinking it. */
export function Stat({ value, label, suffix }: { value: React.ReactNode; label: string; suffix?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: C.text }}>
        {value}
        {suffix && <span style={{ fontSize: 22, color: C.textGhost }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 13.5, color: C.textFaint, marginTop: 3 }}>{label}</div>
    </div>
  )
}
