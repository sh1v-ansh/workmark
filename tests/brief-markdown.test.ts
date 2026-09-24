import { describe, it, expect } from 'vitest'
import { parseBriefMarkdown } from '@/lib/briefs/parse'
import { briefSummary, briefTime } from '@/lib/briefs/parse'

const SAMPLE = `# Habit tracker with streaks

**Time:** A week or two

## What you'll build
A small web app that tracks daily habits and shows streaks.

## Done when
- You can add a habit
- Streaks reset after a missed day`

describe('parseBriefMarkdown', () => {
  it('splits title, body and difficulty', () => {
    const out = parseBriefMarkdown(SAMPLE)
    expect(out.title).toBe('Habit tracker with streaks')
    expect(out.body.startsWith('**Time:**')).toBe(true)
    expect(out.difficulty).toBe(3)
  })

  it('copes with a half-written stream', () => {
    const out = parseBriefMarkdown('# Habit tra')
    expect(out.title).toBe('Habit tra')
    expect(out.body).toBe('')
  })
})

describe('brief card helpers', () => {
  it('summarises from "What you\'ll build"', () => {
    expect(briefSummary(parseBriefMarkdown(SAMPLE).body)).toBe('A small web app that tracks daily habits and shows streaks.')
  })

  it('falls back to the first paragraph for old plain briefs', () => {
    expect(briefSummary('Build a CLI.\n\nThen add tests.')).toBe('Build a CLI.')
  })

  it('reads the time line', () => {
    expect(briefTime(parseBriefMarkdown(SAMPLE).body)).toBe('A week or two')
  })
})
