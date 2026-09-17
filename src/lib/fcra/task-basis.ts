// Reconsidering a project claim on the basis it was actually made on.
//
// ── The bug this exists to fix ────────────────────────────────────────────
// A reinvestigation rescans the repository and asks two questions: are this
// student's commits still there, and is the skill still detected. For a row
// that came out of a repo scan, those are the right questions — the scan was
// the basis, so re-running it reconsiders the claim.
//
// Workspace evidence was never made on that basis. It says: this person
// finished N tasks whose acceptance criteria were written down before the
// work started, a checker or a teammate confirmed each one, and here is when.
// That is why it carries a higher tier than a scan. Asking a repository
// whether it still detects PostgreSQL does not reconsider that claim — it
// answers a different one — and under the old code a detection miss could
// retract evidence whose real basis was three confirmed tasks that are still
// sitting there, verified, in the database.
//
// Under §611 a reinvestigation has to reconsider the information the claim
// rests on. So for a project row, the repository is corroboration and the
// tasks are the basis, and the tasks are what this module reads.
//
// Pure, so the rule can be argued with in a test rather than inferred from
// what a dispute happened to return.

/** One task as it was recorded in evidence_audit at minting time. */
export interface RecordedTask {
  id: string
  title: string
  /** 'agent' or 'person' — who settled it. */
  settledBy: string | null
  verifiedAt: string | null
}

/** The same task as it stands now. Absent from the map means deleted. */
export interface LiveTask {
  id: string
  status: string
  /** The verdict on its most recent submission. */
  latestVerdict: string | null
}

export type BasisVerdict = 'holds' | 'weakened' | 'gone' | 'unknown'

export interface BasisFinding {
  verdict: BasisVerdict
  /** Tasks still finished and still carrying the verdict they were minted on. */
  standing: number
  /** Recorded tasks that are no longer finished, or that have gone. */
  fallen: number
  /** Said back to the student, in the dispute resolution. */
  note: string
}

/** A task that is finished in the sense the evidence claimed. */
function stillFinished(task: LiveTask | undefined): boolean {
  if (!task) return false
  return task.status === 'verified' || task.status === 'accepted'
}

/**
 * Does the recorded basis still stand?
 *
 * Three outcomes and one absence, and the shape of the absence matters: a
 * project minted before `recordEvidenceBasis` existed, or one whose audit
 * write failed — it is best-effort by design — has no recorded basis at all.
 * That is 'unknown', not 'gone'. Treating a missing footnote as a missing
 * basis would retract evidence because of a logging gap, which is the same
 * class of mistake as reading a skipped scan as "no commits are yours".
 */
export function checkBasis(
  recorded: RecordedTask[],
  live: Map<string, LiveTask>,
): BasisFinding {
  if (recorded.length === 0) {
    return {
      verdict: 'unknown',
      standing: 0,
      fallen: 0,
      note: 'There is no record of which tasks this evidence was based on, so it cannot be rechecked automatically.',
    }
  }

  const standing = recorded.filter((r) => stillFinished(live.get(r.id))).length
  const fallen = recorded.length - standing

  if (standing === 0) {
    return {
      verdict: 'gone',
      standing,
      fallen,
      note: `None of the ${recorded.length} task${recorded.length === 1 ? '' : 's'} this was based on is still finished.`,
    }
  }

  if (fallen > 0) {
    return {
      verdict: 'weakened',
      standing,
      fallen,
      note: `${standing} of ${recorded.length} tasks this was based on are still verified; ${fallen} ${fallen === 1 ? 'is' : 'are'} not.`,
    }
  }

  return {
    verdict: 'holds',
    standing,
    fallen,
    note: `All ${standing} task${standing === 1 ? '' : 's'} this was based on ${standing === 1 ? 'is' : 'are'} still verified against the criteria agreed before the work started.`,
  }
}

/**
 * May a repository rescan retract this row on its own?
 *
 * No, whenever the tasks still stand. This is the whole point of the module:
 * the scan is corroboration for a project claim, and corroboration failing is
 * not the same as the claim failing. A repository that went private, was
 * renamed, had its history rewritten, or simply stopped tripping a detector
 * must not delete evidence that three confirmed tasks still support.
 *
 * 'unknown' is protective for the same reason a skipped scan is: a missing
 * audit row is our gap, not the student's.
 */
export function scanMayRetract(finding: BasisFinding): boolean {
  return finding.verdict === 'gone'
}

/**
 * What a weakened or missing basis should do to the dispute.
 *
 * Neither is a decision a rescan should make by itself. A basis that has
 * partly fallen away is a judgment about how much of a skill claim survives,
 * and a basis nobody recorded cannot be rechecked at all — both are for a
 * person, which is exactly what §611 contemplates when the automated pass
 * cannot settle it.
 */
export function needsAPerson(finding: BasisFinding): boolean {
  return finding.verdict === 'weakened' || finding.verdict === 'unknown'
}
