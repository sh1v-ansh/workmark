import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  MAX_BODY_BYTES,
  readJsonBody,
  requireString,
  optionalString,
  requireOneOf,
  requireBoolean,
  requireInt,
  requireEmail,
  isEduAddress,
  emailDomain,
  requireUuid,
  optionalUuid,
  requireArray,
  readFields,
} from '../src/lib/http/validate'
import { clientIp } from '../src/lib/http/request-ip'
import { destinationAfterSignIn, landingForStatus } from '../src/lib/auth/post-signin'

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('https://workmark.org/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

describe('readJsonBody', () => {
  it('returns the parsed object', async () => {
    await expect(readJsonBody(jsonRequest('{"a":1}'))).resolves.toEqual({ a: 1 })
  })

  it('refuses a body over the cap even when Content-Length lies', async () => {
    const huge = JSON.stringify({ a: 'x'.repeat(MAX_BODY_BYTES + 10) })
    // No Content-Length is set by hand here, so this is the read-side check.
    await expect(readJsonBody(jsonRequest(huge))).rejects.toBeInstanceOf(ValidationError)
  })

  it('refuses an oversized declared Content-Length without reading it', async () => {
    const request = jsonRequest('{}', { 'content-length': String(MAX_BODY_BYTES + 1) })
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(ValidationError)
  })

  it('refuses malformed JSON', async () => {
    await expect(readJsonBody(jsonRequest('{nope'))).rejects.toBeInstanceOf(ValidationError)
  })

  // An array or a bare string parses fine but every `body.field` read on it
  // is undefined, which reads downstream as "they left it blank" rather than
  // "this was never an object".
  it.each(['[1,2]', '"a string"', 'null', '42'])('refuses a non-object body: %s', async (body) => {
    await expect(readJsonBody(jsonRequest(body))).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('requireString', () => {
  it('trims by default', () => {
    expect(requireString('  hi  ', 'Name', { max: 10 })).toBe('hi')
  })

  it('can be told not to trim, for passwords', () => {
    expect(requireString(' pw ', 'Password', { max: 10, trim: false })).toBe(' pw ')
  })

  it('treats whitespace-only as missing', () => {
    expect(() => requireString('   ', 'Name', { max: 10 })).toThrow(ValidationError)
  })

  it.each([undefined, null, 42, {}, []])('rejects the non-string %s', (value) => {
    expect(() => requireString(value, 'Name', { max: 10 })).toThrow(ValidationError)
  })

  it('enforces both ends of the range', () => {
    expect(() => requireString('ab', 'Name', { min: 3, max: 10 })).toThrow(ValidationError)
    expect(() => requireString('a'.repeat(11), 'Name', { max: 10 })).toThrow(ValidationError)
  })
})

describe('optionalString', () => {
  // A cleared input posts '', and storing that alongside null gives two
  // values meaning "nothing here" that queries only ever remember one of.
  it.each([undefined, null, '', '   '])('collapses %s to null', (value) => {
    expect(optionalString(value, 'Bio', { max: 10 })).toBeNull()
  })

  it('still rejects a non-string that is present', () => {
    expect(() => optionalString(7, 'Bio', { max: 10 })).toThrow(ValidationError)
  })
})

describe('requireOneOf / requireBoolean / requireInt', () => {
  const allowed = ['a', 'b'] as const

  it('accepts a member and rejects anything else', () => {
    expect(requireOneOf('a', 'Kind', allowed)).toBe('a')
    expect(() => requireOneOf('c', 'Kind', allowed)).toThrow(ValidationError)
    expect(() => requireOneOf(1, 'Kind', allowed)).toThrow(ValidationError)
  })

  it('will not coerce a truthy value into a boolean', () => {
    expect(requireBoolean(false, 'Flag')).toBe(false)
    expect(() => requireBoolean('true', 'Flag')).toThrow(ValidationError)
  })

  it('rejects a float rather than rounding it', () => {
    expect(requireInt(3, 'Hours', { min: 1, max: 5 })).toBe(3)
    expect(() => requireInt(3.7, 'Hours', { min: 1, max: 5 })).toThrow(ValidationError)
    expect(() => requireInt(9, 'Hours', { min: 1, max: 5 })).toThrow(ValidationError)
  })
})

describe('requireUuid / requireArray', () => {
  const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

  it('accepts a real uuid in either case', () => {
    expect(requireUuid(uuid, 'Id')).toBe(uuid)
    expect(requireUuid(uuid.toUpperCase(), 'Id')).toBe(uuid.toUpperCase())
  })

  // These go straight into .eq(). Postgres answers a malformed uuid with
  // 22P02, which surfaces as a 500 for a row that was never going to exist.
  it.each(['', 'not-a-uuid', '3f2504e0-4f89-11d3-9a0c', 123, null, {}])(
    'rejects %s', (value) => {
      expect(() => requireUuid(value, 'Id')).toThrow(ValidationError)
    })

  it('treats missing as null when optional, but still checks a present one', () => {
    expect(optionalUuid(undefined, 'Id')).toBeNull()
    expect(optionalUuid('', 'Id')).toBeNull()
    expect(() => optionalUuid('nope', 'Id')).toThrow(ValidationError)
  })

  it('refuses a non-array before anything calls .filter on it', () => {
    expect(requireArray([1, 2], 'Items', { max: 5 })).toEqual([1, 2])
    expect(() => requireArray('nope', 'Items', { max: 5 })).toThrow(ValidationError)
    expect(() => requireArray({ 0: 'a' }, 'Items', { max: 5 })).toThrow(ValidationError)
    expect(() => requireArray([1, 2, 3], 'Items', { max: 2 })).toThrow(ValidationError)
  })
})

describe('readFields', () => {
  it('returns the values when every check passes', () => {
    const result = readFields(() => ({ name: requireString('  x  ', 'Name', { max: 5 }) }))
    expect(result.ok && result.values.name).toBe('x')
  })

  it('turns the first failure into a 400 carrying that field’s message', async () => {
    const result = readFields(() => ({ name: requireString(9, 'Name', { max: 5 }) }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(400)
    expect(await result.response.json()).toEqual({ error: 'Name is required.' })
  })

  // A bug in the route must not be reported to the caller as their mistake.
  it('lets a non-validation error through rather than calling it a 400', () => {
    expect(() => readFields(() => { throw new TypeError('a real bug') })).toThrow(TypeError)
  })
})

describe('requireEmail', () => {
  it('lowercases, so the rate-limit key is one bucket per account', () => {
    expect(requireEmail('Someone@University.EDU')).toBe('someone@university.edu')
  })

  it.each([
    'no-at-sign',
    '@university.edu',
    'two@@university.edu',
    'someone@nodot',
    'someone@university.edu.',
    'some one@university.edu',
  ])('rejects %s', (address) => {
    expect(() => requireEmail(address)).toThrow(ValidationError)
  })

  it('accepts ordinary addresses', () => {
    expect(requireEmail('a.b+tag@sub.university.edu')).toBe('a.b+tag@sub.university.edu')
  })
})

describe('isEduAddress', () => {
  it('accepts a university subdomain', () => {
    expect(isEduAddress('me@cs.university.edu')).toBe(true)
  })

  it('rejects a non-edu address', () => {
    expect(isEduAddress('me@gmail.com')).toBe(false)
  })

  // The check is on the last label, not on the string ending in ".edu" — an
  // address at "notreally.edu.co" must not pass.
  it('is not fooled by .edu appearing mid-domain', () => {
    expect(isEduAddress('me@university.edu.co')).toBe(false)
    expect(isEduAddress('me@edu.com')).toBe(false)
  })

  it('reports the domain for the verification record', () => {
    expect(emailDomain('me@University.EDU')).toBe('university.edu')
  })
})

describe('clientIp', () => {
  const withHeaders = (headers: Record<string, string>) =>
    clientIp(new Request('https://workmark.org/', { headers }))

  // The edge-set headers are trusted first precisely because x-forwarded-for
  // is a chain the caller can prepend to.
  it('prefers the headers the platform sets over the forwarded chain', () => {
    expect(withHeaders({
      'x-vercel-forwarded-for': '9.9.9.9',
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
    })).toBe('9.9.9.9')

    expect(withHeaders({
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '1.1.1.1',
    })).toBe('8.8.8.8')
  })

  it('falls back to the leftmost forwarded hop', () => {
    expect(withHeaders({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })).toBe('1.1.1.1')
  })

  it('shares one bucket when there is nothing to attribute', () => {
    expect(withHeaders({})).toBe('unknown')
  })

  it('strips a port and caps the length so the key cannot grow a row', () => {
    expect(withHeaders({ 'x-real-ip': '1.2.3.4:5678' })).toBe('1.2.3.4')
    expect(withHeaders({ 'x-real-ip': 'x'.repeat(200) }).length).toBe(45)
  })
})

describe('destinationAfterSignIn', () => {
  const base = { hasAccount: true, status: 'active', roles: ['student'], hasStudentProfile: true }

  it('sends a finished student to the dashboard', () => {
    expect(destinationAfterSignIn(base)).toBe('/student/dashboard')
  })

  // "Has an account row" is what finished onboarding means. Keying off the
  // student row sent every professor back to the signup form forever.
  it('sends someone with no account row to onboarding', () => {
    expect(destinationAfterSignIn({ ...base, hasAccount: false })).toBe('/onboarding')
  })

  it('sends a half-finished student signup back to the form', () => {
    expect(destinationAfterSignIn({ ...base, hasStudentProfile: false })).toBe('/onboarding')
  })

  it('sends faculty to their own home', () => {
    expect(destinationAfterSignIn({
      ...base, roles: ['faculty'], hasStudentProfile: false,
    })).toBe('/faculty')
  })

  // Someone holding both roles is a student first — that is the side of the
  // product they are being scored on.
  it('treats a student who is also faculty as a student', () => {
    expect(destinationAfterSignIn({ ...base, roles: ['faculty', 'student'] })).toBe('/student/dashboard')
  })

  it('routes a non-active account to the page that explains why', () => {
    expect(destinationAfterSignIn({ ...base, status: 'suspended' })).toBe('/account/status')
    expect(destinationAfterSignIn({ ...base, status: 'deleting' })).toBe('/account/deleted')
  })

  // Status is checked before roles: a suspended professor must not sail past
  // the explanation and land on their dashboard.
  it('checks status before role', () => {
    expect(destinationAfterSignIn({
      ...base, status: 'suspended', roles: ['faculty'], hasStudentProfile: false,
    })).toBe('/account/status')
  })

  it('names the restore page only for a deletion in its grace period', () => {
    expect(landingForStatus('deleting')).toBe('/account/deleted')
    expect(landingForStatus('suspended')).toBe('/account/status')
  })
})
