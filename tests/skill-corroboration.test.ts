import { describe, it, expect } from 'vitest'
import {
  placesFor, corroborationCeiling, capSkillsPerRepo, MAX_SKILLS_ABOVE_FLOOR,
} from '../src/lib/skills/corroboration'
import type { Detection } from '../src/lib/github/detectors'

const at = (where: string, source: Detection['source'] = 'import'): Detection =>
  ({ raw: 'x', source, where })

describe('placesFor', () => {
  it('counts distinct files, not detections', () => {
    expect(placesFor([at('src/a.ts'), at('src/a.ts'), at('src/a.ts')])).toBe(1)
    expect(placesFor([at('src/a.ts'), at('src/b.ts')])).toBe(2)
  })

  it('is zero when nothing was found', () => {
    expect(placesFor([])).toBe(0)
  })
})

describe('corroborationCeiling', () => {
  // The gaming vector, stated as a test. One commit with a package.json of
  // sixty libraries plus one file importing them all used to produce sixty
  // skills at Intermediate or Advanced with no code behind any of them.
  it('holds a skill seen in one file at level 1', () => {
    expect(corroborationCeiling([at('src/imports.ts')])).toBe(1)
  })

  it('holds a skill seen only in a manifest at level 1', () => {
    expect(corroborationCeiling([at('package.json', 'manifest')])).toBe(1)
  })

  // Deliberately a low bar. The aim is to stop one file minting a record,
  // not to make ordinary projects hard to evidence.
  it('lifts the cap once it appears in two places', () => {
    expect(corroborationCeiling([at('package.json', 'manifest'), at('src/db.ts')])).toBe(3)
  })

  it('is not fooled by many detections in the same file', () => {
    const same = Array.from({ length: 30 }, () => at('src/imports.ts'))
    expect(corroborationCeiling(same)).toBe(1)
  })
})

describe('capSkillsPerRepo', () => {
  const scored = (n: number, level: 1 | 2 | 3 = 3) =>
    Array.from({ length: n }, (_, i) => ({
      skillId: `skill-${String(i).padStart(3, '0')}`,
      strength: 1 - i / 1000,
      level,
    }))

  it('leaves an honest project alone', () => {
    const out = capSkillsPerRepo(scored(8))
    expect(Array.from(out.values()).every((l) => l === 3)).toBe(true)
  })

  it('caps the overflow at level 1', () => {
    const out = capSkillsPerRepo(scored(40))
    const above = Array.from(out.values()).filter((l) => l > 1)
    expect(above).toHaveLength(MAX_SKILLS_ABOVE_FLOOR)
  })

  it('keeps the best-evidenced ones', () => {
    const out = capSkillsPerRepo(scored(40))
    expect(out.get('skill-000')).toBe(3)
    expect(out.get('skill-039')).toBe(1)
  })

  it('never raises a level', () => {
    const out = capSkillsPerRepo([{ skillId: 'a', strength: 1, level: 1 }])
    expect(out.get('a')).toBe(1)
  })

  it('does not count level-1 skills against the cap', () => {
    const mixed = [...scored(5, 3), ...scored(50, 1).map((s) => ({ ...s, skillId: `floor-${s.skillId}` }))]
    const out = capSkillsPerRepo(mixed)
    expect(Array.from(out.values()).filter((l) => l > 1)).toHaveLength(5)
  })

  // Two scans of an unchanged repo must produce the same record. Ordering
  // that depends on a Map's iteration order is how a level moves because
  // somebody pressed rescan.
  it('breaks ties the same way every time', () => {
    const tied = Array.from({ length: 30 }, (_, i) => ({
      skillId: `s-${String(i).padStart(3, '0')}`, strength: 0.5, level: 3 as const,
    }))
    const first = capSkillsPerRepo(tied)
    const second = capSkillsPerRepo([...tied].reverse())
    expect(Array.from(first.entries()).sort()).toEqual(Array.from(second.entries()).sort())
  })
})
