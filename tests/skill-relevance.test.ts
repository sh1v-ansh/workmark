import { describe, it, expect } from 'vitest'
import {
  computeSkillRelevance, scaleComposite, evidenceCeiling, EVIDENCE_THRESHOLD,
} from '../src/lib/skills/relevance'
import type { Detection } from '../src/lib/github/detectors'

function detection(over: Partial<Detection> = {}): Detection {
  return { raw: 'bcrypt', source: 'manifest', where: 'package.json', ...over } as Detection
}

const NOTHING_TOUCHED = new Set<string>()
const NO_LANGUAGES = new Map()

function relevanceOf(detections: Detection[], filesTouched = NOTHING_TOUCHED) {
  return computeSkillRelevance({
    detections, filesTouched, languageShare: NO_LANGUAGES, impliedFrom: undefined,
  }).relevance
}

describe('the evidence bar', () => {
  // The bug a student actually reported: told they were Advanced at
  // cryptography, having never written any. seed-aliases maps bcrypt to
  // cryptography, so one line in a package.json minted the skill.
  //
  // This used to return exactly EVIDENCE_THRESHOLD, and the gate in
  // evidence.ts is `relevance < EVIDENCE_THRESHOLD` — so 0.3 < 0.3 was
  // false and every declared dependency anybody had ever had cleared it.
  it('leaves a dependency the student never touched below the bar', () => {
    expect(relevanceOf([detection()])).toBeLessThan(EVIDENCE_THRESHOLD)
  })

  it('lets it through once they edited the file it is declared in', () => {
    const r = relevanceOf([detection()], new Set(['package.json']))
    expect(r).toBeGreaterThanOrEqual(EVIDENCE_THRESHOLD)
  })

  it('lets it through once they imported it in their own code', () => {
    expect(relevanceOf([detection({ source: 'import', where: 'src/auth.ts' })]))
      .toBeGreaterThanOrEqual(EVIDENCE_THRESHOLD)
  })

  // An inference is at most as good as what it was inferred from. The floor
  // here used to be EVIDENCE_THRESHOLD, which meant an implied skill could
  // never fall below the bar however weak its parent was.
  it('does not prop a weak inference up to the bar', () => {
    const r = computeSkillRelevance({
      detections: [], filesTouched: NOTHING_TOUCHED, languageShare: NO_LANGUAGES,
      impliedFrom: { skillId: 'supabase', relevance: 0.25 },
    }).relevance
    expect(r).toBeLessThan(EVIDENCE_THRESHOLD)
  })

  it('still carries a strong inference through', () => {
    const r = computeSkillRelevance({
      detections: [], filesTouched: NOTHING_TOUCHED, languageShare: NO_LANGUAGES,
      impliedFrom: { skillId: 'supabase', relevance: 0.9 },
    }).relevance
    expect(r).toBeGreaterThanOrEqual(EVIDENCE_THRESHOLD)
  })
})

describe('evidenceCeiling', () => {
  // The second half of the same bug. Even above the bar, the level came from
  // the repository's composite — test ratio, CI, how long it ran — and
  // scaleComposite keeps 45% of that regardless. A serious repo dragged
  // every skill in it into the top band.
  it('caps a skill the student only configured at level 2', () => {
    expect(evidenceCeiling(0.7)).toBe(2)
  })

  it('caps weak evidence at level 1', () => {
    expect(evidenceCeiling(0.3)).toBe(1)
    expect(evidenceCeiling(0.25)).toBe(1)
  })

  it('allows the top band only for code they wrote', () => {
    expect(evidenceCeiling(0.75)).toBe(3)
    expect(evidenceCeiling(1)).toBe(3)
  })

  // Concretely: the repo scores 100, which is about as good as it gets.
  // Before the ceiling this reached the >= 40 band and printed "Advanced".
  it('stops a perfect repo from making a config line Advanced', () => {
    const scaled = scaleComposite(100, 0.7)
    expect(scaled).toBeGreaterThan(40) // the old level-3 band, still cleared
    expect(evidenceCeiling(0.7)).toBeLessThan(3) // and still not Advanced
  })
})

describe('what relevance says about where it saw things', () => {
  it('rates their own imports above a config file they set up', () => {
    const imported = relevanceOf([detection({ source: 'import', where: 'src/a.ts' })])
    const configured = relevanceOf([detection()], new Set(['package.json']))
    expect(imported).toBeGreaterThan(configured)
  })

  it('rates a config file they set up above one they did not', () => {
    const mine = relevanceOf([detection()], new Set(['package.json']))
    expect(mine).toBeGreaterThan(relevanceOf([detection()]))
  })

  it('reports nothing at all for a skill with no detections', () => {
    expect(relevanceOf([])).toBe(0)
  })

  // Tests prove the thing runs, not that they built with it.
  it('rates test-only use below real use', () => {
    const inTests = relevanceOf([detection({ source: 'import', where: 'src/auth.test.ts' })])
    const inSource = relevanceOf([detection({ source: 'import', where: 'src/auth.ts' })])
    expect(inTests).toBeLessThan(inSource)
    expect(evidenceCeiling(inTests)).toBeLessThan(3)
  })
})
