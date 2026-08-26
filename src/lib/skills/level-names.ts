// What each level is called, and which ones anyone can currently reach.
//
// The names were copy-pasted into four files, all listing five levels — but
// the scan caps every skill at 3 by design, because a level above Strong
// means someone else vouched for the work and nothing on the platform can
// produce that yet. So the record has been advertising two levels no student
// could earn, with nothing saying why.
//
// Showing them greyed with a reason is better than hiding them: a scale that
// stops at Strong with no explanation reads as "this is as good as it gets",
// which is the opposite of true.

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Familiar',
  2: 'Practiced',
  3: 'Strong',
  4: 'Advanced',
  5: 'Expert',
}

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
  'Levels above Strong need someone you worked with to confirm the work. That\'s coming — until then every record on Workmark tops out at Strong, including everyone you\'re compared against.'
