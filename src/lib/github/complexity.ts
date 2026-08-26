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

export interface ComplexitySignals {
  filesTouched: number
  controlFlowDensity: number       // control-flow keyword matches per line, sampled files
  exportedAbstractionCount: number // regex proxy for "defined an abstraction" vs. "only called leaf functions"
  externalSystemCount: number      // count of manifest dependencies that canonicalized to a real taxonomy skill
  hasTests: boolean
  hasCi: boolean
  hasInfraConfig: boolean
  hasConcurrency: boolean
  fractionAuthored: number | null
}

export interface ComplexityExtraction {
  signals: ComplexitySignals
  rawComposite: number
}

const CONTROL_FLOW_PATTERN = /\b(if|else if|elif|for|while|switch|case|catch|except)\b|&&|\|\|/g
const EXPORTED_ABSTRACTION_PATTERN = /\b(export\s+(function|class|default)|export\s+const\s+\w+\s*=|def\s+\w|class\s+\w|func\s+\w|pub\s+fn|public\s+(class|interface))\b/g
const CONCURRENCY_PATTERN = /\b(async\s+function|await|Promise|goroutine|go\s+func|Thread|Mutex|async\s+fn|threading\.|asyncio\.|concurrent\.)\b/

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
  let controlFlowMatches = 0
  let exportedAbstractions = 0
  let hasConcurrency = false
  let totalLines = 0

  for (const { content } of scanResult.sampledSources) {
    totalLines += content.split('\n').length
    controlFlowMatches += (content.match(CONTROL_FLOW_PATTERN) ?? []).length
    exportedAbstractions += (content.match(EXPORTED_ABSTRACTION_PATTERN) ?? []).length
    if (CONCURRENCY_PATTERN.test(content)) hasConcurrency = true
  }

  const signals: ComplexitySignals = {
    filesTouched: scanResult.filesTouchedByStudent.length,
    controlFlowDensity: totalLines > 0 ? controlFlowMatches / totalLines : 0,
    exportedAbstractionCount: exportedAbstractions,
    externalSystemCount,
    hasTests: scanResult.hasTests,
    hasCi: scanResult.hasCi,
    hasInfraConfig: scanResult.hasInfraConfig,
    hasConcurrency,
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
  score += Math.min(s.controlFlowDensity * 100, 20)
  score += Math.min(s.exportedAbstractionCount, 20) * 0.5
  score += Math.min(s.externalSystemCount, 10) * 1
  score += s.hasTests ? 10 : 0
  score += s.hasCi ? 5 : 0
  score += s.hasInfraConfig ? 5 : 0
  score += s.hasConcurrency ? 10 : 0
  // Unknown fractionAuthored (contributor-stats endpoint never resolved,
  // see scan.ts) defaults to a neutral 0.5 rather than penalizing the
  // student for an API quirk that isn't their fault.
  score += (s.fractionAuthored ?? 0.5) * 10
  return score
}
