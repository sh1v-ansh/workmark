import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CAREER_TRACKS, trackById } from '../src/lib/careers/tracks'
import { trackProgress } from '../src/lib/careers/next-skill'
import { SEED_ALIASES } from '../src/lib/skills/seed-aliases'
import { SKILL_IMPLIES } from '../src/lib/skills/implications'

const backend = trackById('backend')!
const levels = (o: Record<string, number>) => new Map(Object.entries(o))

describe('career tracks', () => {
  // A skill the scanner cannot produce is one nobody could ever finish.
  it('only uses skills from the taxonomy', () => {
    const seed = readFileSync('supabase/seed_skills_taxonomy.sql', 'utf8')
    for (const track of CAREER_TRACKS) {
      for (const slot of track.slots) {
        for (const id of slot.skills) expect(seed, `${track.id}: ${id}`).toContain(`'${id}'`)
      }
    }
  })

  // Every path skill needs something in a repo that points at it: a package
  // alias, a skill it is implied by, GitHub's language stats, or one of the
  // file detectors. Otherwise it sits on the path forever, unearnable.
  it('only uses skills the scanner can detect', () => {
    const reachable = new Set<string>([
      ...Object.values(SEED_ALIASES),
      ...Object.values(SKILL_IMPLIES).flat(),
      // GitHub language stats, by canonical name.
      'java', 'kotlin', 'swift', 'dart', 'c', 'cpp', 'assembly', 'dotnet', 'go', 'rust', 'python', 'javascript', 'typescript',
      // File detectors (detectors.ts, file-plan.ts).
      'docker', 'ci-cd', 'kubernetes', 'terraform', 'sql', 'mysql', 'postgresql', 'database-design', 'serverless', 'graphql', 'config-management',
    ])
    for (const track of CAREER_TRACKS) {
      for (const slot of track.slots) {
        expect(slot.skills.some((id) => reachable.has(id)), `${track.id}: ${slot.label}`).toBe(true)
      }
    }
  })

  it('has unique ids', () => {
    expect(new Set(CAREER_TRACKS.map((t) => t.id)).size).toBe(CAREER_TRACKS.length)
  })
})

describe('trackProgress', () => {
  it('starts an empty record at the first stage, most important first', () => {
    const p = trackProgress(backend, levels({}))
    expect(p.next).toMatchObject({ skillId: 'python', stage: 1, currentLevel: 0, targetLevel: 3 })
    expect(p.done).toBe(0)
  })

  it('never jumps ahead of an unfinished stage', () => {
    const p = trackProgress(backend, levels({ python: 3, docker: 0 }))
    expect(p.next).toMatchObject({ skillId: 'sql', stage: 1 })
  })

  it('counts a weak skill as a gap', () => {
    const p = trackProgress(backend, levels({ python: 3, sql: 1 }))
    expect(p.next).toMatchObject({ skillId: 'sql', currentLevel: 1, targetLevel: 2 })
  })

  it('points a missing framework at the language they already have', () => {
    const p = trackProgress(backend, levels({ python: 2, sql: 2 }))
    const framework = p.slots.find((s) => s.slot.label === 'A backend framework')!
    expect(framework.skillId).toBe('fastapi')
  })

  it('any skill in a slot counts', () => {
    const p = trackProgress(backend, levels({ go: 3, sql: 2 }))
    expect(p.slots[0].done).toBe(true)
  })

  it('returns no next skill when the track is complete', () => {
    const all: Record<string, number> = {}
    for (const slot of backend.slots) all[slot.skills[0]] = 3
    const p = trackProgress(backend, levels(all))
    expect(p.next).toBeNull()
    expect(p.done).toBe(p.total)
  })
})
