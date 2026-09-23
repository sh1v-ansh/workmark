import { describe, it, expect } from 'vitest'
import {
  evidenceSkipReason, SKIP_EXPLANATION, FINISHED_STATUSES,
  type MemberEvidenceInput, type SkipReason,
} from '../src/lib/workspace/evidence'

function member(extra: Partial<MemberEvidenceInput> = {}): MemberEvidenceInput {
  return {
    accountId: 'alice',
    githubUsername: 'alice-dev',
    scanConsentAt: '2026-01-01T00:00:00Z',
    verifiedTaskCount: 3,
    ...extra,
  }
}

describe('evidenceSkipReason', () => {
  it('lets through somebody with verified work, consent and a connected account', () => {
    expect(evidenceSkipReason(member())).toBeNull()
  })

  // The tier this mints is earned by criteria written before the code existed
  // and checked afterwards. Somebody who finished nothing has no such check.
  it('refuses somebody whose work was never verified', () => {
    expect(evidenceSkipReason(member({ verifiedTaskCount: 0 }))).toBe('no_verified_work')
  })

  // The same gate ingest.ts applies to attribution. A project closing is not
  // a reason to start reading somebody's work.
  it('refuses somebody who never consented to their work being read', () => {
    expect(evidenceSkipReason(member({ scanConsentAt: null }))).toBe('no_consent')
  })

  // Faculty have no students row, so no github_username. Evidence attributed
  // to the wrong person is worse than no evidence.
  it('refuses somebody with no GitHub account connected', () => {
    expect(evidenceSkipReason(member({ githubUsername: null }))).toBe('no_github_username')
    expect(evidenceSkipReason(member({ githubUsername: '' }))).toBe('no_github_username')
  })

  // Order matters only for which message is shown, but showing "no consent"
  // to somebody who also did no work would send them to the wrong setting.
  it('reports the missing work before the missing consent', () => {
    expect(evidenceSkipReason(member({ verifiedTaskCount: 0, scanConsentAt: null })))
      .toBe('no_verified_work')
  })

  it('has a plain-language explanation for every reason it can return', () => {
    const reasons: SkipReason[] = ['no_verified_work', 'no_consent', 'no_github_username']
    for (const reason of reasons) {
      expect(SKIP_EXPLANATION[reason]).toBeTruthy()
      expect(SKIP_EXPLANATION[reason].length).toBeGreaterThan(20)
    }
  })
})

describe('FINISHED_STATUSES', () => {
  // Submitted is a claim, not a result. If it ever appears here, a student
  // gets evidence for saying they were done.
  it('counts only work that was checked, never work that was merely submitted', () => {
    expect(FINISHED_STATUSES).toEqual(['verified', 'accepted'])
    expect(FINISHED_STATUSES).not.toContain('submitted')
    expect(FINISHED_STATUSES).not.toContain('doing')
  })
})
