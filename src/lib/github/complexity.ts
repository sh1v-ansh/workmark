// Turns scan.ts's raw facts into a complexity composite (§5) — the number
// that gets ranked against all other evidence for the same skill via
// percentile-within-skill (skill_calibration, Phase 0). The composite's
// absolute value doesn't need to mean anything on its own; only its
// relative position within a skill's distribution does, which is exactly
// why a defensible heuristic is an acceptable foundation here rather than
// a blocker.
//
// HONEST SCOPING NOTE: "controlFlowDensity" and "exportedAbstractionCount"
// are regex-based approximations, not real cyclomatic complexity or AST
// analysis. True per-language complexity measurement would need a parser
// per language in the taxonomy — dozens of them. This is a deliberate,
// documented tradeoff: a language-agnostic heuristic that works
// (imperfectly) across many languages at once, rather than a correct
// implementation for zero languages. Revisit with tree-sitter or similar
// if/when this heuristic's weaknesses actually show up in practice.

import type { RepoScanResult } from './scan'
import { readFile, TEST_PATH } from './code-signals'

export interface ComplexitySignals {
  filesTouched: number
  /**
   * Mean indent depth across the sampled files, read off the left margin.
   * Replaces the old control-flow density, which counted `if`/`for`/`&&` and
   * treated more as better — a claim that doesn't hold up. Forty branches in
   * one file is as likely to mean tangled code as capable code. How deep the
   * structure goes is a real signal; how many keywords appear is not.
   */
  nestingDepth: number
  abstractionCount: number         // functions/classes/types defined, counted per language
  /** Handling failure in the language's own idiom — a real past-beginner marker. */
  errorHandlingCount: number
  externalSystemCount: number      // count of dependencies that resolved to a real taxonomy skill
  /**
   * Test files as a share of the source files the student touched. Replaces
   * a boolean: one empty test file used to score identically to two hundred
   * real ones.
   */
  testRatio: number
  hasCi: boolean
  hasInfraConfig: boolean
  hasConcurrency: boolean
  /** Distinct days committed on — sustained work, not one long evening. */
  activeDays: number
  /**
   * Days from first commit to last. Different information from activeDays:
   * ten days' work inside one fortnight is a sprint, ten days' work spread
   * over six months is a project someone kept returning to. Measured from
   * the student's own commits, so unlike GitHub's `pushed_at` a stray bot
   * commit can't inflate it.
   */
  spanDays: number
  /** Share of commits that reworked a file an earlier commit already changed. */
  revisitRate: number | null
  fractionAuthored: number | null
}

export interface ComplexityExtraction {
  signals: ComplexitySignals
  rawComposite: number
}

/**
 * externalSystemCount is passed in rather than computed here: counting it
 * means canonicalizing manifestSkills against the taxonomy, which needs a
 * Supabase client this module deliberately doesn't take a dependency on —
 * keeps complexity extraction pure GitHub-API-in, signals-out, with
 * canonicalization staying the caller's concern (evidence.ts, task #13).
 */
export function extractComplexity(
  scanResult: RepoScanResult,
  externalSystemCount: number,
): ComplexityExtraction {
  // Source contents now arrive on the scan result. They used to be fetched
  // again here, one round trip per file, duplicating work scanRepo had
  // already done for import extraction — same files, same request, twice.
  // With them passed in, this function does no I/O at all and is directly
  // testable.
  let abstractions = 0
  let errorHandling = 0
  let hasConcurrency = false
  let nestingWeightedSum = 0
  let nestingLines = 0

  for (const { path, content } of scanResult.sampledSources) {
    // Each file is read with the patterns for its own language, so Go's
    // `func` and Python's `def` both count as defining something, and Go's
    // ubiquitous `if err != nil` doesn't masquerade as complexity.
    const f = readFile(path, content)
    abstractions += f.abstractions
    errorHandling += f.errorHandling
    if (f.hasConcurrency) hasConcurrency = true
    // Weighted by file length so one deeply-nested three-line file doesn't
    // outweigh a long, flat, well-structured one.
    nestingWeightedSum += f.meanNesting * f.lines
    nestingLines += f.lines
  }

  const touched = scanResult.filesTouchedByStudent
  const testFiles = touched.filter((p) => TEST_PATH.test(p)).length
  const nonTestFiles = touched.length - testFiles

  const signals: ComplexitySignals = {
    filesTouched: touched.length,
    nestingDepth: nestingLines > 0 ? nestingWeightedSum / nestingLines : 0,
    abstractionCount: abstractions,
    errorHandlingCount: errorHandling,
    externalSystemCount,
    // Against non-test files, so the ratio can exceed nothing silly: a repo
    // that is 50% tests reads as 1.0, not 0.5.
    testRatio: nonTestFiles > 0 ? Math.min(testFiles / nonTestFiles, 1) : (testFiles > 0 ? 1 : 0),
    hasCi: scanResult.hasCi,
    hasInfraConfig: scanResult.hasInfraConfig,
    hasConcurrency,
    activeDays: scanResult.activeDays,
    spanDays: scanResult.spanDays,
    revisitRate: scanResult.revisitRate,
    fractionAuthored: scanResult.fractionAuthored,
  }

  return { signals, rawComposite: compositeScore(signals) }
}

/**
 * Weights are an unvalidated starting point, not empirically derived —
 * same honesty as canonicalize.ts's CONFIDENCE_THRESHOLD. There's no real
 * evidence distribution yet to calibrate against, and per §5 the anchor
 * for correctness is supervised calibration against poster ratings once
 * attestation exists (Phase Tier 1+) — until then, this only needs to be
 * *directionally* reasonable, since percentile-within-skill is what
 * actually determines a level, not this number in isolation.
 */
function compositeScore(s: ComplexitySignals): number {
  let score = 0
  score += Math.min(s.filesTouched, 20) * 0.5
  // Depth 0-1 is flat scripting; 3-4 is real structure; past ~5 is usually
  // tangle rather than sophistication, so the curve tops out rather than
  // rewarding ever-deeper indentation.
  score += Math.min(s.nestingDepth, 4) * 4
  score += Math.min(s.abstractionCount, 20) * 0.5
  score += Math.min(s.errorHandlingCount, 15) * 0.6
  score += Math.min(s.externalSystemCount, 10) * 1
  // Up to 12 for a full test suite, and unlike the old boolean, one token
  // test file earns roughly one point rather than the full ten.
  score += s.testRatio * 12
  score += s.hasCi ? 5 : 0
  score += s.hasInfraConfig ? 5 : 0
  score += s.hasConcurrency ? 10 : 0
  // Sustained work. Days, not commits — ten commits in one evening is one
  // day's work however it's split up. Capped at 20 so a long-running repo
  // doesn't dominate purely by age.
  score += Math.min(s.activeDays, 20) * 0.6
  // A project that ran across weeks rather than one sitting. Small weight
  // and capped at a quarter: it overlaps with activeDays, and past a couple
  // of months elapsed time says more about when they started than about
  // the work. Kept separate because "ten days inside a fortnight" and "ten
  // days across six months" are genuinely different things.
  score += Math.min(s.spanDays / 90, 1) * 4
  // Coming back to your own code and reworking it. The strongest signal
  // available without reading the code's meaning: generate-and-abandon sits
  // near zero, real iteration sits high. Null (too little history to judge)
  // scores neutral rather than zero — absence of evidence isn't evidence.
  score += (s.revisitRate ?? 0.35) * 12
  // Unknown fractionAuthored (contributor-stats endpoint never resolved,
  // see scan.ts) defaults to a neutral 0.5 rather than penalizing the
  // student for an API quirk that isn't their fault.
  score += (s.fractionAuthored ?? 0.5) * 10
  return score
}
