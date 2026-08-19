/**
 * The handwritten margin note.
 *
 * This is the single most load-bearing piece of personality in the app and
 * the easiest one to ruin, so the constraints are in the code rather than in
 * somebody's memory:
 *
 *   1. AT MOST ONE PER PAGE. If you are adding a second, delete the first.
 *   2. It is an ASIDE pointing at something — never a label, heading, button,
 *      error, empty state, or body copy.
 *   3. It must be removable with no loss of information. If a user would miss
 *      a fact by not reading it, it is not a margin note, it is content, and
 *      it belongs in the layout.
 *   4. Never on /me/file, disputes, consent, or anything legal. Those pages
 *      have to read as sober, and a hand-drawn arrow on an FCRA disclosure is
 *      exactly the wrong tone.
 *
 * aria-hidden for the same reason as (3): it is decoration wrapped around a
 * remark. A screen reader announcing "this is the bit posters actually read"
 * out of visual context is noise, and the information is already elsewhere.
 *
 * Positioning is the caller's job — wrap the target in position: relative and
 * pass an `offset`. Nothing is positioned by default so this can never
 * silently overlap content it wasn't measured against.
 */
export default function HandNote({
  children,
  side = 'right',
  offset,
  rotate = 6,
}: {
  children: React.ReactNode
  /** Which way the arrow points back toward the thing being annotated. */
  side?: 'right' | 'left'
  /** Absolute placement relative to the caller's positioned ancestor. */
  offset: React.CSSProperties
  rotate?: number
}) {
  return (
    <div
      aria-hidden="true"
      className="mob-hide"
      style={{
        position: 'absolute',
        width: 132,
        transform: `rotate(${side === 'right' ? rotate : -rotate}deg)`,
        pointerEvents: 'none',
        ...offset,
      }}
    >
      <span className="wm-hand">{children}</span>
      <svg
        width="46"
        height="30"
        viewBox="0 0 46 30"
        fill="none"
        style={{ display: 'block', marginTop: 2, transform: side === 'left' ? 'scaleX(-1)' : undefined }}
      >
        <path d="M43 4C34 6 20 8 8 19" stroke="#6142F5" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 13l-2 8 9-1" stroke="#6142F5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
