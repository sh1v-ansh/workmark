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
 * The highest level this much corroboration can justify.
 *
 * One place is level 1 — real, recorded, not a claim about depth. Two or
 * more lifts the cap and lets the other rules (relevance, repo difficulty)
 * decide. Deliberately a low bar: the aim is to stop one file minting a
 * record, not to make ordinary projects hard to evidence.
 */
export function corroborationCeiling(detections: Detection[]): 1 | 3 {
  return placesFor(detections) >= 2 ? 3 : 1
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
