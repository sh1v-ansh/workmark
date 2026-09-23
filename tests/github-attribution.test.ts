import { describe, it, expect } from 'vitest'
import {
  attributeCommits, coAuthorEmails, shouldAskAboutEmails, sampleAcross,
  type CommitIdentity,
} from '../src/lib/github/attribution'

function commit(over: Partial<CommitIdentity> = {}): CommitIdentity {
  return {
    sha: Math.random().toString(16).slice(2, 9),
    authorLogin: null, authorEmail: null, authorName: null, message: null,
    ...over,
  }
}

const me = { login: 'priya', emails: new Set(['priya@university.edu']) }

describe('attributeCommits', () => {
  it('takes GitHub at its word when it recognised the account', () => {
    const c = commit({ authorLogin: 'priya', authorEmail: 'whatever@nowhere.test' })
    expect(attributeCommits([c], me).mine).toHaveLength(1)
  })

  it('is not case sensitive about the login', () => {
    expect(attributeCommits([commit({ authorLogin: 'PRIYA' })], me).mine).toHaveLength(1)
  })

  // The bug this module exists for: a commit from a machine whose git config
  // uses an address GitHub has never verified against the account.
  it('claims a commit by a confirmed email GitHub did not recognise', () => {
    const c = commit({ authorLogin: null, authorEmail: 'priya@university.edu' })
    expect(attributeCommits([c], me).mine).toHaveLength(1)
  })

  it('does not care about the case of the email', () => {
    const c = commit({ authorEmail: 'Priya@University.EDU' })
    expect(attributeCommits([c], me).mine).toHaveLength(1)
  })

  // Pair programming, and every squash merge that keeps its co-authors.
  // Both were completely invisible before.
  it('claims a commit where they are a co-author', () => {
    const c = commit({
      authorLogin: 'someone-else',
      authorEmail: 'else@example.com',
      message: 'Add the parser\n\nCo-Authored-By: Priya R <priya@university.edu>',
    })
    expect(attributeCommits([c], me).mine).toHaveLength(1)
  })

  it('leaves other people\'s commits alone', () => {
    const c = commit({ authorLogin: 'someone-else', authorEmail: 'else@example.com' })
    expect(attributeCommits([c], me).mine).toHaveLength(0)
  })
})

describe('which addresses are offered to claim', () => {
  // The rule that stops this being a way to take credit for other people's
  // work. If GitHub says a commit belongs to an account, it does.
  it('never offers an address GitHub already attributes to somebody', () => {
    const c = commit({ authorLogin: 'someone-else', authorEmail: 'else@example.com' })
    expect(attributeCommits([c], me).unclaimed).toEqual([])
  })

  it('offers an address nobody owns', () => {
    const c = commit({ authorLogin: null, authorEmail: 'priya@lab-machine.local', authorName: 'priya' })
    const { unclaimed } = attributeCommits([c], me)
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0]).toMatchObject({ email: 'priya@lab-machine.local', name: 'priya', commits: 1 })
  })

  it('counts how many commits each address accounts for', () => {
    const c = () => commit({ authorEmail: 'priya@lab.local' })
    const { unclaimed } = attributeCommits([c(), c(), c()], me)
    expect(unclaimed[0].commits).toBe(3)
  })

  it('puts the commonest first, since that is the one to ask about', () => {
    const many = Array.from({ length: 4 }, () => commit({ authorEmail: 'a@x.test' }))
    const one = commit({ authorEmail: 'b@x.test' })
    const { unclaimed } = attributeCommits([one, ...many], me)
    expect(unclaimed.map((u) => u.email)).toEqual(['a@x.test', 'b@x.test'])
  })

  // Once an address has been attributed to an account anywhere in the
  // history, the question is closed for all of its commits.
  it('closes the question if any commit from that address was attributed', () => {
    const anon = commit({ authorLogin: null, authorEmail: 'shared@x.test' })
    const owned = commit({ authorLogin: 'someone-else', authorEmail: 'shared@x.test' })
    expect(attributeCommits([anon, owned], me).unclaimed).toEqual([])
  })

  // Always attributed by login already, so there is nothing to ask.
  it('never offers a GitHub noreply address', () => {
    const c = commit({ authorLogin: null, authorEmail: '1234+bob@users.noreply.github.com' })
    expect(attributeCommits([c], me).unclaimed).toEqual([])
  })

  it('does not offer an address that is already confirmed', () => {
    const c = commit({ authorEmail: 'priya@university.edu' })
    expect(attributeCommits([c], me).unclaimed).toEqual([])
  })
})

describe('coAuthorEmails', () => {
  it('reads one trailer', () => {
    expect(coAuthorEmails('Fix it\n\nCo-Authored-By: A B <a@b.test>')).toEqual(['a@b.test'])
  })

  it('reads several', () => {
    const msg = 'Fix\n\nCo-Authored-By: A <a@x.test>\nCo-authored-by: B <b@x.test>'
    expect(coAuthorEmails(msg)).toEqual(['a@x.test', 'b@x.test'])
  })

  it('finds nothing in an ordinary message', () => {
    expect(coAuthorEmails('Just a commit')).toEqual([])
    expect(coAuthorEmails(null)).toEqual([])
  })

  // The regex is module-level and carries /g, so lastIndex survives calls.
  // Without an explicit reset the second call starts mid-string and misses.
  it('gives the same answer when called twice', () => {
    const msg = 'x\n\nCo-Authored-By: A <a@x.test>'
    expect(coAuthorEmails(msg)).toEqual(coAuthorEmails(msg))
  })
})

describe('shouldAskAboutEmails', () => {
  // "We read it, but found no commits of yours" reads as "Workmark thinks I
  // did nothing". If there is an address they could claim, ask instead.
  it('asks when nothing matched but something is claimable', () => {
    const a = attributeCommits([commit({ authorEmail: 'priya@lab.local' })], me)
    expect(shouldAskAboutEmails(a)).toBe(true)
  })

  it('stays quiet when their commits were found', () => {
    const a = attributeCommits([commit({ authorLogin: 'priya' })], me)
    expect(shouldAskAboutEmails(a)).toBe(false)
  })

  it('stays quiet when everything belongs to somebody else', () => {
    const a = attributeCommits([commit({ authorLogin: 'other', authorEmail: 'o@x.test' })], me)
    expect(shouldAskAboutEmails(a)).toBe(false)
  })
})

describe('sampleAcross', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i)

  it('takes everything when there is little enough', () => {
    expect(sampleAcross([1, 2, 3], 20)).toEqual([1, 2, 3])
  })

  it('takes exactly the limit when there is more', () => {
    expect(sampleAcross(hundred, 20)).toHaveLength(20)
  })

  // The bug: file detail came from the twenty most recent commits, so a
  // year-long project whose last fortnight was README edits produced an
  // empty language share and no evidence for its main language.
  it('reaches the oldest commits, not just the newest', () => {
    const picked = sampleAcross(hundred, 20)
    expect(picked[0]).toBe(0)
    expect(picked[picked.length - 1]).toBeGreaterThan(90)
  })

  it('spreads evenly rather than clustering', () => {
    const picked = sampleAcross(hundred, 10)
    expect(picked).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
  })

  // Two scans of an unchanged repo have to produce the same record. Anything
  // random or time-dependent means a level moves because somebody pressed
  // rescan.
  it('gives the same answer every time', () => {
    expect(sampleAcross(hundred, 17)).toEqual(sampleAcross(hundred, 17))
  })

  it('copes with the empty and degenerate cases', () => {
    expect(sampleAcross([], 20)).toEqual([])
    expect(sampleAcross(hundred, 0)).toEqual([])
    expect(sampleAcross(hundred, 1)).toEqual([0])
  })
})
