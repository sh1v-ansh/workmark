import { describe, it, expect } from 'vitest'
import { groupDetections, resolutionKey } from '../src/lib/skills/group-detections'
import type { Detection } from '../src/lib/github/detectors'

const det = (raw: string, source: Detection['source'], where: string) =>
  ({ raw, source, where }) as Detection

/**
 * canonicalizeSkills stores results under the normalised key. This builds the
 * map the way it does, so the test fails if the two ever drift apart again.
 */
function resolvedAs(pairs: [string, string][]) {
  return new Map(pairs.map(([raw, skillId]) => [resolutionKey(raw), { resolved: true, skillId }]))
}

describe('groupDetections', () => {
  // The bug. Results were stored lowercased and looked up raw, so every
  // capitalised detection — every GitHub language, every AI tool — was
  // resolved correctly and then dropped before it reached the record.
  it('finds a capitalised language', () => {
    const { detectionsBySkill } = groupDetections(
      [det('TypeScript', 'language', 'GitHub language stats')],
      resolvedAs([['TypeScript', 'typescript']]),
    )
    expect(detectionsBySkill.get('typescript')).toHaveLength(1)
  })

  it('finds Claude Code', () => {
    const { detectionsBySkill } = groupDetections(
      [det('Claude Code', 'collaboration', 'co-authored Claude Code commits')],
      resolvedAs([['Claude Code', 'claude-code']]),
    )
    expect(detectionsBySkill.get('claude-code')).toHaveLength(1)
  })

  // A systems project with no npm or pip manifest has only its languages to
  // go on. With the old lookup it scanned as "nothing recognisable".
  it('gives a language-only repository something to show', () => {
    const { provenance } = groupDetections(
      [det('Go', 'language', 'GitHub language stats'), det('Makefile', 'language', 'GitHub language stats')],
      resolvedAs([['Go', 'go']]),
    )
    expect(Array.from(provenance.keys())).toEqual(['go'])
  })

  it('still finds lowercase manifest names, which always worked', () => {
    const { detectionsBySkill } = groupDetections(
      [det('react', 'manifest', 'package.json')],
      resolvedAs([['react', 'react']]),
    )
    expect(detectionsBySkill.get('react')).toHaveLength(1)
  })

  it('does not care about stray whitespace', () => {
    const { detectionsBySkill } = groupDetections(
      [det('  Python ', 'language', 'GitHub language stats')],
      resolvedAs([['Python', 'python']]),
    )
    expect(detectionsBySkill.get('python')).toHaveLength(1)
  })

  it('records each place once', () => {
    const { provenance } = groupDetections(
      [det('React', 'import', 'src/a.tsx'), det('react', 'import', 'src/a.tsx'), det('react', 'manifest', 'package.json')],
      resolvedAs([['react', 'react']]),
    )
    expect(provenance.get('react')).toEqual(['src/a.tsx', 'package.json'])
  })

  it('skips anything that did not resolve', () => {
    const canonical = new Map([[resolutionKey('mystery'), { resolved: false, skillId: null }]])
    const { provenance } = groupDetections([det('mystery', 'import', 'src/x.ts')], canonical)
    expect(provenance.size).toBe(0)
  })
})
