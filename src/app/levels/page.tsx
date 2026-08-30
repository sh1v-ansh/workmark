import Link from 'next/link'
import type { Metadata } from 'next'
import Card from '@/components/Card'
import { Kicker } from '@/components/ui/Section'
import { LEVEL_NAMES, LEVEL_DESCRIPTIONS, SELF_EVIDENCED_CAP, isReachable, CAP_EXPLANATION } from '@/lib/skills/level-names'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { LAYOUT } from '@/lib/theme/layout'

export const metadata: Metadata = {
  title: 'What the levels mean · Workmark',
  description: 'How Workmark grades a skill, and why the scale currently stops at Strong.',
}

/**
 * The levels, explained once, properly.
 *
 * This replaces a paragraph that stood permanently above the skills list on
 * /me — the kind of text everyone reads past on the second visit and nobody
 * can find on the tenth. It is linked from every level name in the product,
 * so the explanation is one hover away from the word it explains rather than
 * competing with the record for the same space.
 *
 * Deliberately readable signed-out: a level appears on public profiles, so
 * whoever is reading one needs to be able to look it up without an account.
 */
export default function LevelsPage() {
  const levels = [1, 2, 3, 4, 5]

  return (
    <main
      id="main-content"
      style={{ maxWidth: 720, margin: '0 auto', padding: '44px 28px 80px' }}
    >
      <Kicker style={{ marginBottom: 8 }}>How the record works</Kicker>
      <h1
        style={{
          fontFamily: F.display, fontSize: 30, fontWeight: 700,
          letterSpacing: '-0.03em', color: C.text, marginBottom: 12, lineHeight: 1.15,
        }}
      >
        What the levels mean
      </h1>
      <p style={{ fontSize: 15.5, color: C.textMuted, lineHeight: 1.65, marginBottom: 14 }}>
        Every skill on your record carries a level. It isn&apos;t self-reported and it isn&apos;t a
        score out of five — it&apos;s a reading of how much real work the scanner found behind
        that skill in code you actually wrote.
      </p>
      <p style={{ fontSize: 15.5, color: C.textMuted, lineHeight: 1.65, marginBottom: 30 }}>
        Levels are judged <strong style={{ color: C.text }}>per skill, against other students
        who have that same skill</strong> — not against one global bar. Being Strong in Rust and
        Strong in React mean the same thing about your work, even though the two are nothing
        alike.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
        {levels.map((n) => {
          const reachable = isReachable(n)
          return (
            <Card key={n} hoverable={false} padding={19.5} style={reachable ? undefined : { opacity: 0.72 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textGhost, fontVariantNumeric: 'tabular-nums' }}>
                  {n}
                </span>
                <span style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: C.text }}>
                  {LEVEL_NAMES[n]}
                </span>
                {!reachable && (
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600, color: state.caution, background: state.cautionBg,
                      borderRadius: R.sm, padding: '3px 8px',
                    }}
                  >
                    Not reachable yet
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6 }}>
                {LEVEL_DESCRIPTIONS[n]}
              </p>
            </Card>
          )
        })}
      </div>

      <Card hoverable={false} padding={19.5} style={{ marginBottom: 26 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 8 }}>
          Why it stops at {LEVEL_NAMES[SELF_EVIDENCED_CAP]}
        </h2>
        <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6 }}>
          {CAP_EXPLANATION}
        </p>
      </Card>

      <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 8 }}>
        If you think a level is wrong
      </h2>
      <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.65, marginBottom: 26 }}>
        Dispute it. A level is computed rather than reported, so most disputes are settled by
        running the same computation again rather than by someone forming an opinion — which
        usually means an answer in seconds.{' '}
        <Link href="/me/file" style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
          Open your file
        </Link>
        .
      </p>

      <Link href="/me" style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>
        &larr; Back to your record
      </Link>
    </main>
  )
}
