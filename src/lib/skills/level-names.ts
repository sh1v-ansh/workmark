// What each level is called, and which ones anyone can currently reach.
//
// The first three are Beginner / Intermediate / Advanced because those are
// words a reader already owns. They replaced Familiar / Practiced / Strong,
// which sound more precise and are not: a student reading "Practiced" has to
// be told what it means, and a poster reading it guesses.
//
// The names were once copy-pasted into four files, all listing five levels —
// but the scan caps every skill at 3 by design, because a level above
// Advanced means someone else vouched for the work and nothing on the
// platform can produce that yet. So the record has been advertising two
// levels no student could earn, with nothing saying why.
//
// Showing them greyed with a reason is better than hiding them: a scale that
// stops at Advanced with no explanation reads as "this is as good as it gets",
// which is the opposite of true.

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Confirmed',
  5: 'Expert',
}

/** The three a scan can reach, lowest first. The record groups by these. */
export const REACHABLE_LEVELS = [1, 2, 3] as const

/** The highest level a scan alone can produce. */
export const SELF_EVIDENCED_CAP = 3

export function levelName(n: number): string {
  return LEVEL_NAMES[n] ?? `Level ${n}`
}

export function isReachable(level: number): boolean {
  return level <= SELF_EVIDENCED_CAP
}

/** One sentence, shown wherever the ceiling would otherwise be unexplained. */
export const CAP_EXPLANATION =
  'Levels above Advanced need someone you worked with to confirm the work. That\'s coming — until then every record on Workmark tops out at Advanced, including everyone you\'re compared against.'

/**
 * What each level actually means, in the terms a student can check against
 * their own work. Lives beside the names so the explainer page and the
 * hover card can never drift from each other or from the scale itself.
 */
export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'The scanner found this in code you wrote, in a project that ran. Enough to say you have used it for real.',
  2: 'You came back to it. The same skill across more than one project, or one you kept working on rather than finished once.',
  3: 'Sustained, substantial work — the kind that survives contact with other people\'s code, tests and mistakes. This is the ceiling a scan alone can reach.',
  4: 'Someone you actually worked with confirmed the work. Not reachable yet.',
  5: 'Confirmed by collaborators, repeatedly, across projects that others depended on. Not reachable yet.',
}
