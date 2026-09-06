import { describe, it, expect } from 'vitest'
import { detectAgenticTools, trailerValues } from '../src/lib/github/agentic-tools'

const none = { contributorLogins: [], commitMessages: [], paths: [] }
const raws = (r: ReturnType<typeof detectAgenticTools>) => r.map((d) => d.raw)

describe('detectAgenticTools', () => {
  it('finds nothing in a repo with nothing in it', () => {
    expect(detectAgenticTools(none)).toEqual([])
  })

  it('recognises a bot that actually committed', () => {
    const got = detectAgenticTools({ ...none, contributorLogins: ['sh1v-ansh', 'claude[bot]'] })
    expect(raws(got)).toEqual(['Claude Code'])
    expect(got[0].where).toContain('claude[bot]')
    expect(got[0].source).toBe('collaboration')
  })

  it('does not care how the login is capitalised', () => {
    expect(raws(detectAgenticTools({ ...none, contributorLogins: ['Claude[bot]'] }))).toEqual(['Claude Code'])
  })

  // How Claude Code actually marks its work, and so the signal that fires
  // most often in practice.
  it('reads a Co-Authored-By trailer on the student\'s own commits', () => {
    const got = detectAgenticTools({
      ...none,
      commitMessages: ['Add the scan retry\n\nCo-Authored-By: Claude <noreply@anthropic.com>'],
    })
    expect(raws(got)).toEqual(['Claude Code'])
    expect(got[0].where).toContain('co-authored')
  })

  it('reads the trailer whatever the display name says', () => {
    for (const name of ['Claude', 'Claude Opus 4.5', 'Claude Code']) {
      const got = detectAgenticTools({
        ...none,
        commitMessages: [`Fix it\n\nCo-Authored-By: ${name} <noreply@anthropic.com>`],
      })
      expect(raws(got)).toEqual(['Claude Code'])
    }
  })

  // The trailer, not the prose. Someone complaining about a tool in a commit
  // message has not used it.
  it('ignores the tool being mentioned in the body of a message', () => {
    expect(detectAgenticTools({
      ...none,
      commitMessages: [
        'Revert the claude changes, they were wrong',
        'stop using copilot for this file',
        'notes on cursor vs claude code',
      ],
    })).toEqual([])
  })

  it('falls back to a config file when nothing committed', () => {
    const got = detectAgenticTools({ ...none, paths: ['README.md', 'CLAUDE.md', 'src/index.ts'] })
    expect(raws(got)).toEqual(['Claude Code'])
    expect(got[0].where).toBe('CLAUDE.md')
  })

  it('finds a .claude directory as well as the file', () => {
    expect(raws(detectAgenticTools({ ...none, paths: ['.claude/settings.json'] }))).toEqual(['Claude Code'])
  })

  // Strongest available evidence, once. A repo with a bot contributor AND a
  // CLAUDE.md should say the bot committed, not that a file exists.
  it('reports one reason per tool, the strongest one', () => {
    const got = detectAgenticTools({
      contributorLogins: ['claude[bot]'],
      commitMessages: ['x\n\nCo-Authored-By: Claude <noreply@anthropic.com>'],
      paths: ['CLAUDE.md'],
    })
    expect(got).toHaveLength(1)
    expect(got[0].where).toContain('contributor')
  })

  it('finds more than one tool when more than one is there', () => {
    const got = detectAgenticTools({
      contributorLogins: ['claude[bot]'],
      commitMessages: [],
      paths: ['.cursorrules', '.github/copilot-instructions.md'],
    })
    expect(raws(got).sort()).toEqual(['Claude Code', 'Cursor', 'GitHub Copilot'])
  })

  it('does not mistake an ordinary path for a config file', () => {
    expect(detectAgenticTools({
      ...none,
      paths: ['docs/claude.md.bak', 'src/cursorrules.ts', 'vendor/CLAUDE.md'],
    })).toEqual([])
  })
})

describe('trailerValues', () => {
  it('takes the value side of every trailer', () => {
    expect(trailerValues('Title\n\nCo-Authored-By: A <a@b.c>\nCo-authored-by: B <d@e.f>'))
      .toEqual(['A <a@b.c>', 'B <d@e.f>'])
  })

  it('returns nothing for a message with no trailers', () => {
    expect(trailerValues('Just a commit')).toEqual([])
    expect(trailerValues('')).toEqual([])
  })
})
