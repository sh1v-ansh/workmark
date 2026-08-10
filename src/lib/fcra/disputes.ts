// Dispute categories and what each one means procedurally.
//
// The unusual thing about disputing Workmark evidence, versus disputing
// a traditional credit file, is that our evidence is DERIVED, not
// reported. Nobody told us a student knows React; we computed it from
// commit-attributed code by a deterministic process. That makes
// reinvestigation (§611) genuinely mechanical for most categories: we
// re-run the same computation against the same source and compare.
//
// The categories that aren't mechanical are the ones about facts
// outside the code — whether a past disclosure was authorized, say.
// Those need a human, and the honest thing is to route them there
// rather than pretend an automated check settled them.

export type DisputeCategory =
  | 'inaccurate_level'
  | 'skill_not_demonstrated'
  | 'not_my_work'
  | 'wrong_attribution'
  | 'disclosure_unauthorized'
  | 'other'

export type DisputeStatus =
  | 'open'
  | 'reinvestigating'
  | 'resolved_corrected'
  | 'resolved_retracted'
  | 'resolved_verified'
  | 'resolved_manual'

export const DISPUTE_CATEGORIES: {
  value: DisputeCategory
  label: string
  help: string
  /** Can a re-run of the original computation settle this? */
  machineCheckable: boolean
  /** Does this dispute attach to a specific evidence row? */
  needsEvidence: boolean
}[] = [
  {
    value: 'inaccurate_level',
    label: 'The level is wrong',
    help: "We scored this higher or lower than the work actually shows. We'll recompute it from the repo.",
    machineCheckable: true,
    needsEvidence: true,
  },
  {
    value: 'skill_not_demonstrated',
    label: "This project doesn't show that skill",
    help: "The skill was detected but the code doesn't really demonstrate it. We'll rescan and drop it if it's no longer found.",
    machineCheckable: true,
    needsEvidence: true,
  },
  {
    value: 'not_my_work',
    label: "I didn't write this",
    help: "We'll re-check commit attribution and retract the evidence if none of the commits are yours.",
    machineCheckable: true,
    needsEvidence: true,
  },
  {
    value: 'wrong_attribution',
    label: 'The commits attributed to me are wrong',
    help: "Same check — we re-run attribution against your GitHub identity.",
    machineCheckable: true,
    needsEvidence: true,
  },
  {
    value: 'disclosure_unauthorized',
    label: "I didn't authorize a disclosure",
    help: 'A record was shared without your consent. This one needs a person to look at it.',
    machineCheckable: false,
    needsEvidence: false,
  },
  {
    value: 'other',
    label: 'Something else',
    help: 'Describe the problem and a person will review it.',
    machineCheckable: false,
    needsEvidence: false,
  },
]

export function categoryMeta(category: DisputeCategory) {
  return DISPUTE_CATEGORIES.find((c) => c.value === category) ?? null
}

export function isMachineCheckable(category: DisputeCategory): boolean {
  return categoryMeta(category)?.machineCheckable ?? false
}

/** FCRA §611 reinvestigation window. */
export const REINVESTIGATION_DAYS = 30

export function isResolved(status: DisputeStatus): boolean {
  return status.startsWith('resolved_')
}

/**
 * Days remaining on the statutory clock. Negative means overdue —
 * surfaced rather than clamped, because an overdue dispute is a
 * compliance problem that should look like one.
 */
export function daysRemaining(dueAt: string, now: Date = new Date()): number {
  const due = new Date(dueAt).getTime()
  return Math.ceil((due - now.getTime()) / (1000 * 60 * 60 * 24))
}

export const STATUS_LABEL: Record<DisputeStatus, string> = {
  open: 'Filed — awaiting reinvestigation',
  reinvestigating: 'Reinvestigating',
  resolved_corrected: 'Resolved — record corrected',
  resolved_retracted: 'Resolved — evidence removed',
  resolved_verified: 'Resolved — original value confirmed',
  resolved_manual: 'Resolved — reviewed by a person',
}

/**
 * What a reinvestigation concluded, given the recomputed values.
 * Extracted from the route so the decision is testable without a
 * GitHub scan or a database behind it.
 */
export function reinvestigationOutcome(args: {
  category: DisputeCategory
  /** Did the student have attributed commits on the rescan? */
  hasAttributedCommits: boolean
  /** Was the disputed skill still detected in the repo? */
  skillStillDetected: boolean
  /** Level the rescan produced, when it produced one. */
  recomputedLevel: number | null
  originalLevel: number
}): { status: DisputeStatus; note: string } {
  // Attribution failure retracts regardless of category — if the
  // commits aren't theirs, nothing else about the row is worth
  // recomputing.
  if (!args.hasAttributedCommits) {
    return {
      status: 'resolved_retracted',
      note: 'Rescan found no commits attributed to you in this repository. The evidence has been removed from your record.',
    }
  }

  if (!args.skillStillDetected) {
    return {
      status: 'resolved_retracted',
      note: 'Rescan no longer detects this skill in the repository. The evidence has been removed from your record.',
    }
  }

  if (args.recomputedLevel === null) {
    return {
      status: 'resolved_manual',
      note: 'The repository could not be re-read automatically. A person will review this.',
    }
  }

  if (args.recomputedLevel !== args.originalLevel) {
    return {
      status: 'resolved_corrected',
      note: `Rescan produced level ${args.recomputedLevel} rather than ${args.originalLevel}. Your record has been corrected.`,
    }
  }

  return {
    status: 'resolved_verified',
    note: `Rescan produced the same level (${args.originalLevel}). The original value stands.`,
  }
}
