/**
 * How wide the app is, in one place.
 *
 * This existed as a literal in seventeen files and had drifted to four
 * different values — the navbar framed its pages at 1100 while they rendered
 * at 1180, so content overhung its own nav by 40px a side on nearly every
 * page. That is the kind of bug that comes back the moment someone adds a
 * page and picks a number, so the number lives here now.
 *
 * Tune the whole app's side margins by changing `maxWidth` alone.
 */
export const LAYOUT = {
  /** Content width for full-width pages: dashboards, lists, records. */
  maxWidth: 1320,
  /**
   * Narrow reading column, for a single form or a column of prose. Wider
   * than this and the eye loses the start of the next line.
   */
  readingWidth: 680,
} as const
