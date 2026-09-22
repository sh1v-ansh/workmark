import { describe, it, expect } from 'vitest'
import { safeNext } from '../src/lib/auth/redirect'

describe('safeNext', () => {
  it('allows a path on this site', () => {
    expect(safeNext('/auth/reset')).toBe('/auth/reset')
    expect(safeNext('/workspaces/abc?tab=board')).toBe('/workspaces/abc?tab=board')
  })

  it('falls back to home when nothing was asked for', () => {
    expect(safeNext(null)).toBe('/')
    expect(safeNext(undefined)).toBe('/')
    expect(safeNext('')).toBe('/')
  })

  // The whole point. A callback that honours these is an open redirect on a
  // session that has just been established.
  it.each([
    ['an absolute URL', 'https://evil.test/steal'],
    ['a protocol-relative URL', '//evil.test/steal'],
    ['a backslash protocol-relative URL', '/\\evil.test/steal'],
    ['a double backslash', '\\\\evil.test/steal'],
    ['a scheme with no slashes', 'javascript:alert(1)'],
    ['a bare host', 'evil.test'],
    ['a newline-truncated path', '/ok\nhttps://evil.test'],
    ['a null byte', '/ok\u0000/../..'],
  ])('refuses %s', (_label, value) => {
    expect(safeNext(value)).toBe('/')
  })

  // Not a redirect target problem — the browser resolves it against the
  // origin either way — and refusing it would break legitimate deep links.
  it('leaves relative traversal alone', () => {
    expect(safeNext('/a/../b')).toBe('/a/../b')
  })
})
