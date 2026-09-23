import { describe, it, expect } from 'vitest'
import { passwordProblem, PASSWORD_MIN, PASSWORD_MAX } from '../src/lib/auth/password'

describe('passwordProblem', () => {
  it('accepts a long ordinary phrase', () => {
    expect(passwordProblem('correct horse battery staple')).toBeNull()
  })

  it('accepts exactly the minimum', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_MIN))).toBeNull()
  })

  it('refuses one short of it', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_MIN - 1))).toMatch(/at least 8/)
  })

  // No composition rules on purpose — see the note in password.ts. A rule
  // about symbols pushes people to Passw0rd! and away from the long phrase
  // above, which is genuinely harder to guess.
  it('does not demand a digit or a symbol', () => {
    expect(passwordProblem('gardening in the rain')).toBeNull()
  })

  it('accepts exactly the byte ceiling', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_MAX))).toBeNull()
  })

  it('refuses one byte past it', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_MAX + 1))).toMatch(/too long/)
  })

  // bcrypt counts bytes and truncates silently at 72. Counting characters
  // here would tell somebody whose passphrase is mostly non-Latin that it
  // was fine, and then hash only the first part of it.
  it('counts bytes rather than characters at the ceiling', () => {
    // 24 emoji, 4 bytes each, is 96 bytes but only 48 UTF-16 units.
    const emoji = '🔑'.repeat(24)
    expect(emoji.length).toBeLessThan(PASSWORD_MAX)
    expect(passwordProblem(emoji)).toMatch(/too long/)
  })

  it('counts characters rather than bytes at the floor', () => {
    // Seven characters is under the minimum even though it is 21 bytes.
    expect(passwordProblem('日本語日本語日')).toMatch(/at least 8/)
  })
})
