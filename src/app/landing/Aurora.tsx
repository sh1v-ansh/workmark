/**
 * The moving colour behind the marketing pages.
 *
 * What it replaced was a static "constellation" of dotted nodes and a flat
 * violet wash — a diagram of a network, sitting behind a headline that was
 * not about networks. It read as clip art.
 *
 * This is six soft colour fields drifting slowly across each other. Where
 * two overlap they mix, so the palette keeps producing colours that are not
 * in any one blob — which is the whole trick, and the reason it looks alive
 * rather than like a gradient someone chose.
 *
 * Deliberately CSS and not canvas or WebGL. It is six divs with a blur and a
 * transform, which the compositor runs on the GPU without ever waking the
 * main thread — so it stays smooth on a laptop with thirty tabs open, costs
 * no JavaScript, and renders on the server with the rest of the page. A
 * shader would look marginally better and would cost all three.
 *
 * Two rules it must never break. It sits behind everything at a low opacity,
 * because a background that competes with the headline has failed at being a
 * background. And it stops completely for anyone who has asked for less
 * motion — see the media query in globals.css.
 */

interface Blob {
  /** Colour at the centre, fading to transparent. */
  color: string
  size: number
  top: string
  left: string
  /** Seconds for one full drift. Deliberately co-prime-ish so the whole
   *  field never visibly repeats. */
  duration: number
  delay: number
  /** Which of the three drift paths this one takes. */
  path: 1 | 2 | 3
}

const BLOBS: Blob[] = [
  { color: 'rgba(97, 66, 245, 0.42)',  size: 620, top: '-14%', left: '4%',  duration: 26, delay: 0,  path: 1 },
  { color: 'rgba(129, 140, 248, 0.38)', size: 560, top: '-6%',  left: '46%', duration: 31, delay: -6, path: 2 },
  { color: 'rgba(236, 72, 153, 0.24)',  size: 520, top: '6%',   left: '72%', duration: 37, delay: -12, path: 3 },
  { color: 'rgba(56, 189, 248, 0.30)',  size: 580, top: '30%',  left: '18%', duration: 29, delay: -3, path: 2 },
  { color: 'rgba(217, 169, 60, 0.20)',  size: 440, top: '38%',  left: '62%', duration: 41, delay: -18, path: 1 },
  { color: 'rgba(167, 139, 250, 0.34)', size: 500, top: '-2%',  left: '28%', duration: 34, delay: -9, path: 3 },
]

export function Aurora({ height = 780 }: { height?: number }) {
  return (
    <div className="wm-aurora" aria-hidden="true" style={{ height }}>
      <div className="wm-aurora-field">
        {BLOBS.map((b, i) => (
          <span
            key={i}
            className={`wm-aurora-blob wm-aurora-p${b.path}`}
            style={{
              width: b.size,
              height: b.size,
              top: b.top,
              left: b.left,
              background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, transparent 68%)`,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>
      {/* Fades the whole thing into the page rather than ending at a line. */}
      <div className="wm-aurora-fade" />
    </div>
  )
}
