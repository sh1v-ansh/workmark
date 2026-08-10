// Fit and interview probability (§7).
//
// Two separate steps that were previously conflated:
//
//   computeFit()  — presence, weighted rank score, and confidence. Depends
//                   only on the student and the listing.
//   assignTier()  — the interview-probability tier, which depends on the
//                   LIVE APPLICANT POOL and therefore cannot be computed
//                   from the student alone.
//
// PRESENCE, NOT THRESHOLD. required_level is an IMPORTANCE weight (how
// much this skill matters to the poster), never a bar the student must
// clear. Matching asks "do you have demonstrated evidence in this skill
// at all", then ranks by depth among everyone who does.
//
// The reason is calibration: a required-depth threshold would need the
// poster's "level 3" and the scan's "level 3" to mean the same thing, and
// they demonstrably don't — one is a self-assessment by someone who has
// never seen our scale, the other a percentile band over a population
// currently a handful of students deep. Filtering on that comparison
// would silently exclude qualified people on the strength of a number
// nobody calibrated.
//
// Nothing here blocks applying. Fit is shown before submitting so a
// student can spend their five slots well; the only hard gate in MVP is
// the slot cap itself (§7: eligibility gates applying, not seeing).

import type { SkillDepth } from './depth'

export type FitTier = 'strong_fit' | 'competitive' | 'reach' | 'not_yet'

export interface ListingRequirement {
  skillId: string
  requiredLevel: number // importance weight (1-5), NOT a threshold
  canonicalName?: string
}

export interface FitResult {
  /** Skills the listing asks for that the student has no evidence in. */
  missingSkillIds: string[]
  matchedSkillIds: string[]
  /**
   * Importance-weighted mean depth across the listing's required skills.
   * Missing skills contribute 0, so a partial match ranks below a full
   * one even before the tier is considered. This is the ranking key.
   */
  rankScore: number
  /**
   * §7 step 5: the share of requirement weight backed by evidence that
   * proved it runs (deployment, package registry, passing CI) rather than
   * a bare repo link.
   *
   * Reported ALONGSIDE the score, never folded into it. Collapsing score,
   * confidence, and track record into one number is the lie that makes
   * employers stop trusting a platform — two students can share a score
   * while one's record is deployment-backed and the other's is a
   * package.json, and a poster is entitled to see that difference.
   */
  confidence: number
  perSkill: { skillId: string; requiredLevel: number; depth: number; present: boolean; verified: boolean }[]
}

export function computeFit(
  requirements: ListingRequirement[],
  depthBySkill: Map<string, SkillDepth>,
): FitResult {
  // A listing with no declared requirements can't be "missing" anything.
  if (requirements.length === 0) {
    return { missingSkillIds: [], matchedSkillIds: [], rankScore: 0, confidence: 0, perSkill: [] }
  }

  const perSkill = requirements.map((req) => {
    const d = depthBySkill.get(req.skillId)
    return {
      skillId: req.skillId,
      requiredLevel: req.requiredLevel,
      depth: d?.depth ?? 0,
      present: !!d,
      verified: d?.hasVerifiedEvidence ?? false,
    }
  })

  const weightTotal = perSkill.reduce((n, s) => n + s.requiredLevel, 0)
  const rankScore = weightTotal === 0
    ? 0
    : perSkill.reduce((n, s) => n + s.requiredLevel * s.depth, 0) / weightTotal
  const confidence = weightTotal === 0
    ? 0
    : perSkill.reduce((n, s) => n + (s.verified ? s.requiredLevel : 0), 0) / weightTotal

  return {
    missingSkillIds: perSkill.filter((s) => !s.present).map((s) => s.skillId),
    matchedSkillIds: perSkill.filter((s) => s.present).map((s) => s.skillId),
    rankScore,
    confidence,
    perSkill,
  }
}

/**
 * Interview probability (§7), assigned relative to the live applicant
 * pool rather than an absolute threshold:
 *
 *   Strong fit   top quartile of current applicants
 *   Competitive  above median
 *   Reach        below median, or missing exactly one required skill
 *   Not yet      missing two or more, each named
 *
 * Pool-relative because an absolute cutoff means something different in a
 * skill with four students than one with four hundred, and because the
 * question a student is actually asking is "how do I compare to who else
 * applied", not "did I clear a number someone picked".
 *
 * `poolScores` is every current applicant's rank_score for this listing.
 * The student's own score being present or absent doesn't change the
 * banding materially, and requiring callers to remove it would be a
 * subtle correctness trap — so it's tolerated either way.
 */
export function assignTier(fit: FitResult, poolScores: number[]): FitTier {
  // Presence dominates: a missing skill is a concrete gap the student can
  // act on, and no amount of depth elsewhere fills it.
  if (fit.missingSkillIds.length >= 2) return 'not_yet'
  if (fit.missingSkillIds.length === 1) return 'reach'

  // Nobody else has applied yet, so there is no pool to be in the top
  // quartile OF. Claiming "strong fit" against an empty distribution
  // would be an unfalsifiable compliment.
  if (poolScores.length === 0) return 'competitive'

  const sorted = [...poolScores].sort((a, b) => a - b)
  const share = sorted.filter((s) => s < fit.rankScore).length / sorted.length

  if (share >= 0.75) return 'strong_fit'
  if (share > 0.5) return 'competitive'
  return 'reach'
}

export const FIT_TIER_LABEL: Record<FitTier, string> = {
  strong_fit: 'Strong fit',
  competitive: 'Competitive',
  reach: 'Reach',
  not_yet: 'Not yet',
}

export const FIT_TIER_BLURB: Record<FitTier, string> = {
  strong_fit: 'You have evidence in every skill this asks for, and your depth is in the top quarter of everyone who has applied.',
  competitive: 'You have evidence in every skill this asks for.',
  reach: 'Either one required skill has no evidence in your record yet, or your depth is below the median applicant.',
  not_yet: 'Several skills this asks for have no evidence in your record yet.',
}
