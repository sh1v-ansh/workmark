// How many separate places a repository says a student used something.
//
// ── The hole this closes ──────────────────────────────────────────────────
// One commit containing a package.json with sixty popular libraries in it,
// plus one file that imports them all, used to produce sixty skills at
// Intermediate or Advanced on a permanent record, with no code behind any of
// them. Nothing in the pipeline asked how *much* of the repository supported
// a claim — only how strong the strongest single signal was, and one import
// is a strong signal.
//
// It did not matter while the only users were people we knew. It matters the
// moment a record is worth something, which is the moment somebody has a
// reason to fake one.
//
// ── Why places rather than a score ────────────────────────────────────────
// A skill that appears in one file is a skill somebody might have used once,
// or might have pasted in. A skill threaded through four files is one the
// project is actually built on. That distinction is cheap to compute, hard
// to fake at scale — faking it means writing a plausible codebase, which is
// the thing we wanted them to do — and easy to explain to somebody
// disputing their record, which matters more here than precision.

import type { Detection } from '@/lib/github/detectors'

/**
 * How many distinct places in the repository mention this skill.
 *
 * Counted by path, so twelve imports in one file are one place. That is the
 * whole point: the file of sixty imports is a single piece of evidence
 * however many names are in it.
 */
export function placesFor(detections: Detection[]): number {
  return new Set(detections.map((d) => d.where)).size
}

/**
 * Sources whose strength is already measured by volume rather than by how
 * many files mention them.
 *
 * A language arrives as a single detection from GitHub's language statistics
 * — one "place", however many thousand lines the student wrote in it. Its
 * real corroboration is the share of their own changed files, which
 * computeSkillRelevance already reads. Counting places here would cap every
 * language at level 1, which is the opposite of the intent.
 *
 * Collaboration is exempt for a different reason: evidenceCeiling already
 * holds it at 2, so a second cap adds nothing but a way to get it wrong.
 */
const MEASURED_ELSEWHERE = new Set(['language', 'collaboration'])

/**
 * The highest level this much corroboration can justify.
 *
 * ── Why graduated rather than a single gate ───────────────────────────────
 * The first version was binary: one place capped at 1, two or more lifted
 * the cap entirely. That was not enough. `import bcrypt` in one file plus
 * the line in package.json is two places, so cryptography still reached the
 * top band — a student was told they were Advanced at cryptography for using
 * a hashing library once, which is the complaint this was meant to fix.
 *
 * The binary version only asked "is this a complete fabrication". The
 * question worth asking is how much of the project rests on the thing:
 *
 *   1 place   — it appears. Recorded, no claim about depth.
 *   2-3       — they used it. Real, and not the same as building on it.
 *   4+        — it is threaded through the project.
 *
 * Still a cap and never a floor, so repo difficulty and relevance can pull a
 * level down from here but never push it past what the repository actually
 * shows.
 */
export function corroborationCeiling(detections: Detection[]): 1 | 2 | 3 {
  if (detections.some((d) => MEASURED_ELSEWHERE.has(d.source))) return 3

  const places = placesFor(detections)
  if (places >= 4) return 3
  if (places >= 2) return 2
  return 1
}

/**
 * How many skills one repository may put above level 1.
 *
 * A backstop for somebody who spreads the same trick over three files rather
 * than one. Twelve is roughly what a serious, honest project demonstrates —
 * a full-stack web application genuinely evidences a language, a framework,
 * a database, a styling approach, a deployment target and a handful of
 * libraries, and lands near this number. Forty does not happen by writing
 * software.
 *
 * The skills that keep their level are the best-evidenced ones, so the
 * effect on an honest record is nil and the effect on a padded one is that
 * the padding lands at level 1.
 */
export const MAX_SKILLS_ABOVE_FLOOR = 12

export interface Scored {
  skillId: string
  /** Higher is better-evidenced. Relevance, in practice. */
  strength: number
  level: 1 | 2 | 3
}

/**
 * Apply the per-repository cap, keeping the best-evidenced claims intact.
 *
 * Ties break on skill id rather than on input order, so two scans of an
 * unchanged repository produce the same record. Ordering that depends on a
 * Map's iteration order is the kind of thing that makes a level move because
 * somebody pressed rescan.
 */
export function capSkillsPerRepo(
  scored: Scored[],
  max: number = MAX_SKILLS_ABOVE_FLOOR,
): Map<string, 1 | 2 | 3> {
  const out = new Map<string, 1 | 2 | 3>()

  const aboveFloor = scored
    .filter((s) => s.level > 1)
    .sort((a, b) => (b.strength - a.strength) || a.skillId.localeCompare(b.skillId))

  const keep = new Set(aboveFloor.slice(0, max).map((s) => s.skillId))

  for (const s of scored) {
    out.set(s.skillId, s.level > 1 && !keep.has(s.skillId) ? 1 : s.level)
  }
  return out
}
