import { describe, it, expect } from 'vitest'
import { isRealFailure } from '../src/lib/github/scan'

const err = (status: number | undefined, message = 'nope') =>
  Object.assign(new Error(message), { status })

describe('isRealFailure', () => {
  // The bug this exists for. GitHub's contents API returns 403 for any file
  // over 1MB, which is a lockfile in almost every real repository. Treating
  // that as a failure marked nearly every scan partial — and a partial scan
  // is forbidden from retracting, so retraction silently never ran and
  // records that were supposed to be corrected stayed wrong.
  it('forgives a file that is simply too big', () => {
    expect(isRealFailure(err(403, 'This API returns blobs up to 1 MB in size'))).toBe(false)
  })

  it('forgives a file that is not there', () => {
    expect(isRealFailure(err(404, 'Not Found'))).toBe(false)
  })

  it('forgives a legal takedown', () => {
    expect(isRealFailure(err(451, 'Repository access blocked'))).toBe(false)
  })

  // The other half. These mean GitHub refused to answer a question it
  // normally answers, and a scan that hit them must not be allowed to
  // conclude a student has demonstrated nothing.
  it('counts a rate limit, which also arrives as 403', () => {
    expect(isRealFailure(err(403, 'API rate limit exceeded'))).toBe(true)
    expect(isRealFailure(err(403, 'You have exceeded a secondary rate limit'))).toBe(true)
  })

  it('counts abuse detection', () => {
    expect(isRealFailure(err(403, 'You have triggered an abuse detection mechanism'))).toBe(true)
  })

  it('counts GitHub being down', () => {
    expect(isRealFailure(err(500))).toBe(true)
    expect(isRealFailure(err(502))).toBe(true)
    expect(isRealFailure(err(429, 'Too Many Requests'))).toBe(true)
  })

  // No status at all: a socket hung up, DNS failed, the request timed out.
  it('counts a network error with no status', () => {
    expect(isRealFailure(new Error('socket hang up'))).toBe(true)
    expect(isRealFailure(err(undefined))).toBe(true)
  })
})
