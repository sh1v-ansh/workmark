// How much each kind of evidence is worth before anything else is measured.
//
// ── What these numbers are, honestly ──────────────────────────────────────
// They are a stated ordering with a defensible argument behind it, and they
// are not validated. Nobody has checked them against whether a business
// agreed with the level a student was given, because no such data exists yet.
// Anyone reading these should treat the ORDER as the claim and the magnitudes
// as a first guess.
//
// They were inline magic numbers in processRepo until now, which made that
// distinction impossible to see and a change impossible to make deliberately.
//
// ── The ordering, and why ─────────────────────────────────────────────────
// Each step up is a step further from "the student decided this was good".
//
//   solo scan (0.4)        Somebody wrote code alone and linked it. The work
//                          is real and nothing outside their own judgement
//                          says it was any good.
//
//   multi-contributor      Other people worked in the same repository, so at
//   scan (0.5)             least the code survived contact with somebody
//                          else. Weak, and better than nothing.
//
//   listing-driven (0.5)   Somebody asked for the work and accepted it. The
//                          acceptance is a real external signal, but it
//                          arrives afterwards and against no written standard
//                          — "this is fine" is not the same as "this meets
//                          what we agreed".
//
//   workspace (0.6)        The acceptance criteria were written down BEFORE
//                          the code existed and checked against afterwards,
//                          and on a team a second person confirmed it. This
//                          is the only tier where the bar was set in advance,
//                          which is the entire argument for it outranking the
//                          others.
//
// Note that listing-driven and multi-contributor sit at the same number for
// different reasons. That is deliberate, not an oversight: one has a person
// who accepted the work, the other has people who worked alongside it, and we
// have no basis for saying which is stronger.
//
// ── How to validate them ──────────────────────────────────────────────────
// Not from more scanning — no amount of reading repositories says whether 0.6
// was the right weight. It needs outcomes: cases where somebody who saw the
// record also saw the work and said whether the level matched. That means
// business feedback on candidates they actually engaged, which is a thing
// Workmark cannot have until businesses are using it.
//
// Until then the right move is to leave the ordering alone and not defend the
// magnitudes. `recomputeCalibration` does NOT touch these — it calibrates
// skill bands from the spread of evidence, which is a different question.

export type ArtifactTier = 'tier_0' | 'tier_0_5' | 'listing_driven' | 'workspace_verified'

export interface TierDefinition {
  /** The weight before relevance and complexity are applied. */
  base: number
  /** Shown to a student on /me/file, in answer to "why does my record say this". */
  explanation: string
}

export const TIERS: Record<ArtifactTier, TierDefinition> = {
  tier_0: {
    base: 0.4,
    explanation: 'A repository you wrote on your own and linked yourself.',
  },
  tier_0_5: {
    base: 0.5,
    explanation: 'A repository with other contributors, so the code was worked on by more than one person.',
  },
  listing_driven: {
    base: 0.5,
    explanation: 'Work somebody posted, that you did, and that they accepted.',
  },
  workspace_verified: {
    base: 0.6,
    explanation:
      'A project where the acceptance criteria were written down before the work started and checked against afterwards.',
  },
}

export function baseFor(tier: ArtifactTier): number {
  return TIERS[tier].base
}

/**
 * The claim these numbers actually make, strongest last.
 *
 * Exported so a test can pin it. The ordering is what the product tells
 * businesses — that a verified project outranks a linked repository — and it
 * is the part that must not drift when somebody tunes a magnitude. The
 * magnitudes themselves are free to move; this list is not, without a
 * deliberate decision.
 */
export const TIER_ORDER: ArtifactTier[] = [
  'tier_0',
  'tier_0_5',
  'listing_driven',
  'workspace_verified',
]
