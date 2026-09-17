import { describe, it, expect } from 'vitest'
import { parseSender, formatSender } from '../src/lib/notify/from'

describe('parseSender', () => {
  it('takes a bare address', () => {
    expect(parseSender('noreply@send.workmark.org')).toEqual({
      address: 'noreply@send.workmark.org', display: null,
    })
  })

  // The form worth using: an inbox showing "Workmark" is one people
  // recognise, and a bare address is one they report as spam.
  it('takes a display name and an address', () => {
    expect(parseSender('Workmark <noreply@send.workmark.org>')).toEqual({
      address: 'noreply@send.workmark.org', display: 'Workmark',
    })
  })

  it('does not mind the spacing', () => {
    expect(parseSender('  Workmark   < noreply@send.workmark.org >  ')?.address)
      .toBe('noreply@send.workmark.org')
  })

  // Quotes meant for the shell that ended up in the value. The commonest way
  // this variable goes wrong.
  it('survives quotes around the whole thing', () => {
    expect(parseSender('"Workmark <noreply@send.workmark.org>"')).toEqual({
      address: 'noreply@send.workmark.org', display: 'Workmark',
    })
  })

  it('survives quotes around only the display name', () => {
    expect(parseSender('"Workmark" <noreply@send.workmark.org>')?.display).toBe('Workmark')
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['a name with no address', 'Workmark'],
    ['an unclosed bracket', 'Workmark <noreply@send.workmark.org'],
    ['an address with no domain', 'noreply@'],
    ['an address with no dot in the domain', 'noreply@localhost'],
    ['two addresses', 'a@b.com, c@d.com'],
  ])('refuses %s', (_label, value) => {
    expect(parseSender(value)).toBeNull()
  })
})

describe('formatSender', () => {
  // Rebuilt rather than passed through, so however the variable was written,
  // Resend receives one shape.
  it('puts the name back in front', () => {
    expect(formatSender({ address: 'a@b.com', display: 'Workmark' })).toBe('Workmark <a@b.com>')
  })

  it('sends a bare address bare', () => {
    expect(formatSender({ address: 'a@b.com', display: null })).toBe('a@b.com')
  })

  it('round-trips both forms', () => {
    for (const raw of ['a@b.com', 'Workmark <a@b.com>']) {
      expect(formatSender(parseSender(raw)!)).toBe(raw)
    }
  })
})
