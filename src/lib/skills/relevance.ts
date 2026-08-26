// How much of a repo's difficulty actually belongs to each skill it used.
//
// The scan worked out one difficulty number per repo and handed that same
// number to every skill it found there. So a hard Rust systems project that
// happened to contain a package.json with React in it claimed the student
// was as good at React as at Rust. It cut the other way too: a serious
// Postgres schema inside an otherwise simple app got marked down to the
// app's level.
//
// The fix needs no new data. We already know where each skill was found and
// which files the student personally committed to. That's enough to say
// whether a skill is what they were working on or something that happened
// to be in the directory.

import type { Detection } from '@/lib/github/detectors'
import { languageOf, TEST_PATH, type LanguageKey } from '@/lib/github/code-signals'

export interface SkillRelevance {
  /** 0-1. How much of the repo's difficulty this skill has a claim on. */
  relevance: number
  /** Plain-language reason, stored alongside the evidence. */
  reason: string
}

/**
 * Below this, a skill is recorded as a prior — "we saw this" — rather than
 * as evidence. A React dependency in a repo where the student never touched
 * a line of frontend code is a true fact about the repo and a false claim
 * about the student, and the record should only make the first one.
 */
export const EVIDENCE_THRESHOLD = 0.3

/** Detections that mean the student wrote code using this thing. */
const HANDS_ON_SOURCES = new Set(['import'])

/**
 * Detections that describe the repo's setup. Real, but one step removed
 * from the student's own keystrokes unless they edited the file themselves.
 */
const CONFIG_SOURCES = new Set(['manifest', 'compose', 'dockerfile', 'prisma', 'orm-config', 'workflow', 'file', 'sql'])

export function computeSkillRelevance(args: {
  detections: Detection[]
  /** Files the student's own commits changed, vendored paths already removed. */
  filesTouched: Set<string>
  /** Share of the student's touched source files by language, 0-1. */
  languageShare: Map<LanguageKey, number>
  /** Set when this skill was only reached through an implication rule. */
  impliedFrom?: { relevance: number; skillId: string }
}): SkillRelevance {
  const { detections, filesTouched, languageShare, impliedFrom } = args

  // An implied skill inherits from what implied it, slightly discounted.
  // Postgres reached through Supabase is a genuine claim, but it's one
  // inference removed from anything we directly observed.
  if (impliedFrom) {
    return {
      relevance: Math.max(impliedFrom.relevance * 0.9, EVIDENCE_THRESHOLD),
      reason: `implied by ${impliedFrom.skillId}`,
    }
  }

  if (detections.length === 0) return { relevance: 0, reason: 'not found in this repo' }

  // Strongest claim first: they imported it in a file they wrote.
  const importedIn = detections.filter((d) => HANDS_ON_SOURCES.has(d.source))
  if (importedIn.length > 0) {
    // Used across several of their files, or only in one? Both count, but
    // something threaded through the whole codebase is more central to it.
    const breadth = Math.min(importedIn.length / 4, 1)
    const onlyInTests = importedIn.every((d) => TEST_PATH.test(d.where))
    if (onlyInTests) {
      return { relevance: 0.5, reason: 'used in your test files' }
    }
    return { relevance: 0.75 + breadth * 0.25, reason: `imported in ${importedIn.length} of your files` }
  }

  // A language from GitHub's stats: weight by how much of the student's own
  // work is in it. Repo-wide language bytes would count a teammate's code.
  const languageDetection = detections.find((d) => d.source === 'language')
  if (languageDetection) {
    const key = languageKeyForName(languageDetection.raw)
    const share = key ? (languageShare.get(key) ?? 0) : 0
    if (share > 0) {
      // Square-rooted so a language that's a fifth of their work still
      // registers as real rather than nearly nothing.
      return { relevance: Math.min(0.35 + Math.sqrt(share) * 0.65, 1), reason: `${Math.round(share * 100)}% of the files you changed` }
    }
    // Present in the repo but not in anything they touched.
    return { relevance: 0.25, reason: 'in the repo, but not in files you changed' }
  }

  // Config and setup files. Much stronger if they edited the file themselves.
  const configDetections = detections.filter((d) => CONFIG_SOURCES.has(d.source))
  if (configDetections.length > 0) {
    const editedByStudent = configDetections.some((d) => filesTouched.has(d.where))
    if (editedByStudent) {
      const where = configDetections.find((d) => filesTouched.has(d.where))!.where
      return { relevance: 0.7, reason: `you set this up in ${where}` }
    }
    return { relevance: 0.3, reason: `declared in ${configDetections[0].where}, which you didn't change` }
  }

  return { relevance: 0.3, reason: 'found in this repo' }
}

/**
 * Share of the student's own source files by language.
 *
 * Test files are excluded from the denominator: someone whose repo is half
 * tests shouldn't have every language's share halved for it.
 */
export function computeLanguageShare(filesTouched: string[]): Map<LanguageKey, number> {
  const counts = new Map<LanguageKey, number>()
  let total = 0
  for (const path of filesTouched) {
    if (TEST_PATH.test(path)) continue
    const key = languageOf(path)
    if (key === 'other') continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total++
  }
  const share = new Map<LanguageKey, number>()
  if (total === 0) return share
  for (const [key, n] of Array.from(counts.entries())) share.set(key, n / total)
  return share
}

/** GitHub's language names -> the keys used by the per-language readers. */
const LANGUAGE_NAME_KEY: Record<string, LanguageKey> = {
  javascript: 'js', typescript: 'js', 'javascript (jsx)': 'js', tsx: 'js', jsx: 'js',
  python: 'python', go: 'go', rust: 'rust',
  java: 'java', kotlin: 'java', scala: 'java',
  c: 'c', 'c++': 'c', 'c#': 'csharp', cuda: 'c', 'objective-c': 'swift',
  ruby: 'ruby', php: 'php', swift: 'swift',
}

function languageKeyForName(name: string): LanguageKey | null {
  return LANGUAGE_NAME_KEY[name.toLowerCase()] ?? null
}

/**
 * Scale a repo's difficulty for one skill.
 *
 * Deliberately not a straight multiply. A skill that's genuinely present but
 * peripheral should score lower than the repo, not near zero — the student
 * did work in a repo of that difficulty, and the surrounding complexity is
 * part of what they dealt with. The floor keeps that; the range above it is
 * what relevance actually moves.
 */
export function scaleComposite(rawComposite: number, relevance: number): number {
  return rawComposite * (0.45 + 0.55 * Math.min(Math.max(relevance, 0), 1))
}
