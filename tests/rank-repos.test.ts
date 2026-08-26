import { describe, it, expect } from 'vitest'
import {
  rankRepos, scoreRepo, DEFAULT_SCAN_LIMIT, MINIMUM_ENABLED,
  type RankableRepo,
} from '../src/lib/github/rank-repos'

const NOW = new Date('2026-06-01T00:00:00Z')

function repo(over: Partial<RankableRepo> = {}): RankableRepo {
  return {
    repoFullName: over.repoFullName ?? 'me/project',
    isPrivate: false, isFork: false, isArchived: false,
    sizeKb: 500,
    pushedAt: '2026-05-01T00:00:00Z',
    createdAtGh: '2026-04-01T00:00:00Z',
    description: 'a project', primaryLanguage: 'TypeScript',
    stars: 0, hasPages: false, scanChoice: null,
    ...over,
  }
}

const enabledNames = (rs: ReturnType<typeof rankRepos>) =>
  rs.filter((r) => r.enabled).map((r) => r.repoFullName)

describe('scoring one repo', () => {
  it('pushes forks and archived repos to the bottom', () => {
    expect(scoreRepo(repo({ isFork: true }), NOW).score).toBeLessThan(0)
    expect(scoreRepo(repo({ isArchived: true }), NOW).score).toBeLessThan(0)
  })

  it('prefers a project worked on over months to one built in an afternoon', () => {
    const afternoon = scoreRepo(repo({
      createdAtGh: '2026-05-01T09:00:00Z', pushedAt: '2026-05-01T18:00:00Z',
    }), NOW)
    const months = scoreRepo(repo({
      createdAtGh: '2026-01-01T00:00:00Z', pushedAt: '2026-05-01T00:00:00Z',
    }), NOW)
    expect(months.score).toBeGreaterThan(afternoon.score)
  })

  it('marks down a repo nothing has been pushed to in years', () => {
    const stale = scoreRepo(repo({ pushedAt: '2021-01-01T00:00:00Z', createdAtGh: '2020-12-01T00:00:00Z' }), NOW)
    expect(stale.reason).toContain('two years')
  })

  it('marks down an almost-empty repo', () => {
    expect(scoreRepo(repo({ sizeKb: 4 }), NOW).reason).toContain('almost empty')
  })

  it('counts GitHub Pages but not a hand-set homepage', () => {
    // The homepage field mostly measures whether someone knew the field
    // existed. Pages is automatic, so it actually means they shipped.
    const withPages = scoreRepo(repo({ hasPages: true }), NOW)
    const without = scoreRepo(repo({ hasPages: false }), NOW)
    expect(withPages.score).toBeGreaterThan(without.score)
    expect(withPages.reason).toContain('published a site')
  })

  it('lets stars add but never subtract', () => {
    const none = scoreRepo(repo({ stars: 0 }), NOW)
    const some = scoreRepo(repo({ stars: 40 }), NOW)
    expect(some.score).toBeGreaterThan(none.score)
    // Almost every student has zero stars on genuinely good work.
    expect(none.score).toBeGreaterThan(0)
  })
})

describe('choosing which repos to scan', () => {
  it('caps a huge account instead of switching on all 300', () => {
    const many = Array.from({ length: 300 }, (_, i) => repo({ repoFullName: `me/p${i}` }))
    const ranked = rankRepos(many, { now: NOW })
    expect(enabledNames(ranked).length).toBeLessThanOrEqual(DEFAULT_SCAN_LIMIT)
  })

  it('keeps the only project in a language, even when it ranks low', () => {
    // The flaw in a plain top-N cut: eight React repos each add almost
    // nothing after the second, while the one Rust project is the only
    // evidence of that skill the student has.
    const js = Array.from({ length: 40 }, (_, i) => repo({
      repoFullName: `me/js${i}`, primaryLanguage: 'TypeScript', hasPages: true, stars: 30,
    }))
    const lonelyRust = repo({
      repoFullName: 'me/rust-thing', primaryLanguage: 'Rust',
      sizeKb: 40, description: null,
      createdAtGh: '2026-04-28T00:00:00Z', pushedAt: '2026-04-29T00:00:00Z',
    })
    const ranked = rankRepos([...js, lonelyRust], { now: NOW })
    expect(enabledNames(ranked)).toContain('me/rust-thing')
  })

  it('never scans a private repo the student has not opted into', () => {
    const ranked = rankRepos([
      repo({ repoFullName: 'me/secret', isPrivate: true, scanChoice: null }),
    ], { now: NOW })
    expect(enabledNames(ranked)).toEqual([])
  })

  it('scans a private repo the student did opt into', () => {
    const ranked = rankRepos([
      repo({ repoFullName: 'me/secret', isPrivate: true, scanChoice: 'on' }),
    ], { now: NOW })
    expect(enabledNames(ranked)).toEqual(['me/secret'])
  })

  it('respects an off switch no matter how well the repo ranks', () => {
    const ranked = rankRepos([
      repo({ repoFullName: 'me/great', hasPages: true, stars: 100, scanChoice: 'off' }),
    ], { now: NOW })
    expect(enabledNames(ranked)).toEqual([])
    expect(ranked[0].reason).toBe('you turned this off')
  })

  it('always includes a repo linked to a project brief', () => {
    const many = Array.from({ length: 60 }, (_, i) => repo({
      repoFullName: `me/p${i}`, hasPages: true, stars: 50,
    }))
    const brief = repo({
      repoFullName: 'me/my-brief-project', sizeKb: 12, description: null,
      createdAtGh: '2026-05-30T00:00:00Z', pushedAt: '2026-05-30T00:00:00Z',
      linkedToBrief: true,
    })
    const ranked = rankRepos([...many, brief], { now: NOW })
    expect(enabledNames(ranked)).toContain('me/my-brief-project')
  })

  it('never leaves a small account with nothing scanned', () => {
    // A first-year with three small recent repos scoring below every bar is
    // exactly who this product is for.
    const tiny = Array.from({ length: 3 }, (_, i) => repo({
      repoFullName: `me/hw${i}`, sizeKb: 3, description: null,
      createdAtGh: '2026-05-30T00:00:00Z', pushedAt: '2026-05-30T00:00:00Z',
    }))
    expect(enabledNames(rankRepos(tiny, { now: NOW })).length).toBe(3)
  })

  it('applies the floor without exceeding what is available', () => {
    const two = [repo({ repoFullName: 'me/a', sizeKb: 2 }), repo({ repoFullName: 'me/b', sizeKb: 2 })]
    const enabled = enabledNames(rankRepos(two, { now: NOW }))
    expect(enabled.length).toBe(2)
    expect(enabled.length).toBeLessThanOrEqual(MINIMUM_ENABLED)
  })

  it('does not let forks eat the language slots', () => {
    const ranked = rankRepos([
      repo({ repoFullName: 'me/fork', primaryLanguage: 'Haskell', isFork: true }),
      ...Array.from({ length: 30 }, (_, i) => repo({ repoFullName: `me/p${i}` })),
    ], { now: NOW })
    expect(enabledNames(ranked)).not.toContain('me/fork')
  })

  it('explains itself for every repo', () => {
    const ranked = rankRepos([
      repo({ repoFullName: 'me/a' }),
      repo({ repoFullName: 'me/b', isFork: true }),
      repo({ repoFullName: 'me/c', scanChoice: 'on' }),
    ], { now: NOW })
    for (const r of ranked) expect(r.reason.length).toBeGreaterThan(0)
    expect(ranked.find((r) => r.repoFullName === 'me/b')!.reason).toBe('this is a fork')
    expect(ranked.find((r) => r.repoFullName === 'me/c')!.reason).toBe('you turned this on')
  })
})
