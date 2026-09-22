// Taking something off a record.
//
// ── Why this did not exist, and why that was the worst bug in the scanner ──
// processRepo only ever added. When a skill fell below the evidence bar the
// loop skipped it, and the row already on the record stayed there — so every
// mistake the scanner had ever made was permanent, and fixing the code did
// nothing for anybody already affected.
//
// That is what made the cryptography bug expensive rather than embarrassing.
// One student's record said Advanced at cryptography; the fix stopped it
// happening again and could not take it back.
//
// ── Retracted, not deleted ────────────────────────────────────────────────
// skill_evidence is append-only on purpose: it is the audit trail an FCRA
// dispute exists to produce, and "this was on your record between March and
// September" is a question somebody is entitled to an answer to. So a
// retraction sets retracted_at. current_skill_evidence filters those out, so
// every reader stops seeing it immediately while the history stays intact.
//
// ── Why this is per repo, not per student ─────────────────────────────────
// A scan knows one repository. It is entitled to say "this repo no longer
// supports that claim" and has nothing to say about a skill earned somewhere
// else, so the comparison is always scoped to one artifact. Retracting by
// student would let a scan of a toy repo silently strip a skill proved by a
// real one.

/** What a scan concluded about one repository. */
export interface ScanConclusion {
  /** Skills this scan put on, or kept on, the record for this repo. */
  supported: Set<string>
}

/** What the record currently claims on the strength of this repository. */
export interface ExistingClaim {
  evidenceId: string
  skillId: string
}

export interface Retraction {
  evidenceId: string
  skillId: string
  reason: string
}

/**
 * Which claims this repository no longer supports.
 *
 * A claim goes when the scan that just read the repository did not find
 * enough to make it. That covers all three ways a record goes stale: the
 * dependency was removed, the student's involvement turned out to be
 * thinner than it looked, or — the case that matters most — the rule that
 * minted it was wrong and has since been fixed.
 */
export function retractionsFor(
  existing: ExistingClaim[],
  conclusion: ScanConclusion,
  reason = 'The latest scan of this repository no longer supports this.',
): Retraction[] {
  return existing
    .filter((claim) => !conclusion.supported.has(claim.skillId))
    .map((claim) => ({ evidenceId: claim.evidenceId, skillId: claim.skillId, reason }))
}

/**
 * Whether a scan is allowed to retract anything at all.
 *
 * ── The rule that stops this being dangerous ──────────────────────────────
 * A scan that failed halfway through looks exactly like a scan that found
 * nothing: both end with an empty set of supported skills. Letting the first
 * one retract would mean a GitHub rate limit, a network blip or a 500 wipes
 * a student's record — silently, and with no way for them to tell the
 * difference between "Workmark reconsidered" and "Workmark broke".
 *
 * So retraction requires positive evidence that the scan actually worked:
 * it read the repository, found the student's commits, and resolved at least
 * one skill. A scan that resolved nothing is treated as uninformative rather
 * than as a verdict, and the record is left alone.
 *
 * The cost of being wrong in this direction is a stale row until the next
 * scan. The cost of being wrong in the other direction is somebody's record
 * emptying itself overnight.
 */
export function mayRetract(scan: {
  /** False when the repo was skipped — a fork with no changes, say. */
  scanned: boolean
  /** Did anything go wrong while reading the repository? */
  partial: boolean
  /** Commits attributed to this student in this repo. */
  studentCommitCount: number
  /** Skills this scan resolved, before the evidence bar. */
  resolvedCount: number
}): boolean {
  if (!scan.scanned) return false
  if (scan.partial) return false
  if (scan.studentCommitCount === 0) return false
  return scan.resolvedCount > 0
}
