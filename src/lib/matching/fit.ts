// Fit tier: how well one student matches one listing's requirements.
//
// PRESENCE, NOT THRESHOLD. This is the single most important property of
// this file. A listing's required_level is an IMPORTANCE weight (how much
// this skill matters to the poster), never a bar the student must clear.
// Matching asks "do you have demonstrated evidence in this skill at all",
// then ranks by depth among everyone who does. It does not ask "is your
// React depth ≥ 3".
//
// The reason is calibration: a required-depth threshold would need the
// poster's "level 3" and the scan's "level 3" to mean the same thing, and
// they demonstrably don't — one is a self-assessment by someone who has
// never seen our scale, the other is a percentile band over a population
// that is currently ~4 students deep. Filtering on that comparison would
// silently exclude qualified people on the strength of a number nobody
// calibrated.
//
// Fit tiers, by count of required skills with NO evidence:
//   0 missing → competitive, upgraded to strong_fit on depth
//   1 missing → reach       (named, so the student knows exactly what)
//   2+missing → not_yet     (named, same reason)
//
// Nothing here blocks applying. Fit is shown to the student before they
// submit so they can spend their five application slots well; the only
// hard gate in MVP is the slot cap itself (§7: eligibility gates applying,
// not seeing).

import type { SkillDepth } from './depth'

// Level 3 = "Strong", the cap for self-evidenced work until attestation
// exists. Requiring the weighted average to reach it is what separates
// "you have all of this" from "you have all of this, deeply". Unvalidated
// starting point like everything else here.
const STRONG_FIT_MIN_DEPTH = 3.0

export type FitTier = 'strong_fit' | 'competitive' | 'reach' | 'not_yet'

export interface ListingRequirement {
  skillId: string
  requiredLevel: number // importance weight (1-5), NOT a threshold
  canonicalName?: string
}

export interface FitResult {
  tier: FitTier
  /** Skills the listing asks for that the student has no evidence in. */
  missingSkillIds: string[]
  /** Present skills, with the depth that will be used for ranking. */
  matchedSkillIds: string[]
  /**
   * Importance-weighted mean depth across the listing's required skills.
   * Missing skills contribute 0, so a partial match ranks below a full
   * one even before the tier is considered. This is the ranking key.
   */
  rankScore: number
  perSkill: { skillId: string; requiredLevel: number; depth: number; present: boolean }[]
}

export function computeFit(
  requirements: ListingRequirement[],
  depthBySkill: Map<string, SkillDepth>,
): FitResult {
  // A listing with no declared requirements can't be "missing" anything —
  // everyone is nominally competitive and ranking falls back to 0 for all.
  if (requirements.length === 0) {
    return { tier: 'competitive', missingSkillIds: [], matchedSkillIds: [], rankScore: 0, perSkill: [] }
  }

  const perSkill = requirements.map((req) => {
    const d = depthBySkill.get(req.skillId)
    return {
      skillId: req.skillId,
      requiredLevel: req.requiredLevel,
      depth: d?.depth ?? 0,
      present: !!d,
    }
  })

  const missingSkillIds = perSkill.filter((s) => !s.present).map((s) => s.skillId)
  const matchedSkillIds = perSkill.filter((s) => s.present).map((s) => s.skillId)

  const weightTotal = perSkill.reduce((n, s) => n + s.requiredLevel, 0)
  const rankScore = weightTotal === 0
    ? 0
    : perSkill.reduce((n, s) => n + s.requiredLevel * s.depth, 0) / weightTotal

  let tier: FitTier
  if (missingSkillIds.length === 0) {
    tier = rankScore >= STRONG_FIT_MIN_DEPTH ? 'strong_fit' : 'competitive'
  } else if (missingSkillIds.length === 1) {
    tier = 'reach'
  } else {
    tier = 'not_yet'
  }

  return { tier, missingSkillIds, matchedSkillIds, rankScore, perSkill }
}

export const FIT_TIER_LABEL: Record<FitTier, string> = {
  strong_fit: 'Strong fit',
  competitive: 'Competitive',
  reach: 'Reach',
  not_yet: 'Not yet',
}

export const FIT_TIER_BLURB: Record<FitTier, string> = {
  strong_fit: 'You have demonstrated evidence in every skill this asks for, with real depth.',
  competitive: 'You have demonstrated evidence in every skill this asks for.',
  reach: 'One skill this asks for has no evidence in your record yet.',
  not_yet: 'Several skills this asks for have no evidence in your record yet.',
}
