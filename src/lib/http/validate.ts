// Checking what arrived, before anything is done with it.
//
// Routes across the app read fields straight off a parsed JSON body and
// pass them on. Most of the time that is harmless, because Postgres rejects
// a number where it wanted text and the request 500s instead of doing
// damage. But "the database catches it" is not validation, it is a crash
// with extra steps: the caller gets a 500 that says nothing, the error log
// fills with noise, and every text column without a cap will happily store
// a megabyte because nothing upstream said no.
//
// These are deliberately plain functions rather than a schema library. The
// shapes here are five fields at a time, and a dependency that has to be
// kept current is a poor trade for the twenty lines it saves.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * The ceiling on any request body, before it is parsed.
 *
 * Without one, `request.json()` will happily buffer whatever it is sent.
 * 64 KB is many times the largest legitimate body in the app (a listing
 * description) and small enough that a flood costs the sender more than it
 * costs us.
 */
export const MAX_BODY_BYTES = 64 * 1024

/**
 * Parse a JSON body, refusing anything oversized or malformed.
 *
 * Returns a plain object. A body that parses to an array, a string or null
 * is rejected here rather than at the first property access, because
 * `body.email` on a string is `undefined` and that reads as "field missing"
 * rather than "this was never an object".
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const declared = request.headers.get('content-length')
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    throw new ValidationError('That request was too large.')
  }

  // Content-Length can be absent (chunked) or a lie, so the real check is
  // on the bytes actually read.
  const text = await request.text().catch(() => {
    throw new ValidationError('Could not read that request.')
  })
  if (text.length > MAX_BODY_BYTES) {
    throw new ValidationError('That request was too large.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ValidationError('That request was not valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('That request was not in the expected shape.')
  }
  return parsed as Record<string, unknown>
}

interface StringOptions {
  min?: number
  max: number
  /** Default true. Set false where leading space is meaningful. */
  trim?: boolean
}

/** A string that must be present and non-empty. */
export function requireString(value: unknown, field: string, options: StringOptions): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} is required.`)
  }
  const cleaned = options.trim === false ? value : value.trim()
  if (cleaned.length === 0) {
    throw new ValidationError(`${field} is required.`)
  }
  if (options.min !== undefined && cleaned.length < options.min) {
    throw new ValidationError(`${field} must be at least ${options.min} characters.`)
  }
  if (cleaned.length > options.max) {
    throw new ValidationError(`${field} must be ${options.max} characters or fewer.`)
  }
  return cleaned
}

/**
 * A string that may be absent.
 *
 * Missing and empty both become null, on purpose: a cleared text input
 * posts `''`, and storing that rather than null gives you two values that
 * mean "nothing here" and queries that only ever remember one of them.
 */
export function optionalString(value: unknown, field: string, options: StringOptions): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be text.`)
  }
  const cleaned = options.trim === false ? value : value.trim()
  if (cleaned.length === 0) return null
  if (options.min !== undefined && cleaned.length < options.min) {
    throw new ValidationError(`${field} must be at least ${options.min} characters.`)
  }
  if (cleaned.length > options.max) {
    throw new ValidationError(`${field} must be ${options.max} characters or fewer.`)
  }
  return cleaned
}

/** One of a fixed set. The set is the type, so the return is narrowed. */
export function requireOneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`)
  }
  return value as T
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field} must be true or false.`)
  }
  return value
}

/**
 * A whole number in range.
 *
 * Rejects the float rather than rounding it. Silently turning 3.7 into 4 is
 * how a value nobody typed ends up in the database.
 */
export function requireInt(
  value: unknown,
  field: string,
  options: { min: number; max: number },
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`${field} must be a whole number.`)
  }
  if (value < options.min || value > options.max) {
    throw new ValidationError(`${field} must be between ${options.min} and ${options.max}.`)
  }
  return value
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * An id that is about to be put in a `.eq()`.
 *
 * Postgres rejects a malformed uuid with error 22P02, which surfaces as a
 * 500 and an entry in the error log. The row was never going to be found
 * either way — the difference is whether the caller gets told that plainly
 * or whether it looks like Workmark fell over.
 */
export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError(`${field} is not valid.`)
  }
  return value
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  return requireUuid(value, field)
}

/** An array, checked before anything calls .filter or .map on it. */
export function requireArray(value: unknown, field: string, options: { max: number }): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be a list.`)
  }
  if (value.length > options.max) {
    throw new ValidationError(`${field} may have at most ${options.max} entries.`)
  }
  return value
}

/** Turn a ValidationError into the 400 it always means. Rethrows anything else. */
export function badRequest(err: unknown): Response {
  if (err instanceof ValidationError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  throw err
}

/**
 * Parse a body, or hand back the response to return.
 *
 * The `{ ok }` shape rather than a thrown error, because it matches what
 * validateProfileDetails and validateHandle already do here and it keeps a
 * route's happy path flat instead of indented inside a try.
 */
export async function parseBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await readJsonBody(request) }
  } catch (err) {
    return { ok: false, response: badRequest(err) }
  }
}

/**
 * Run a block of field checks, collecting the first failure as a response.
 *
 * The readers above throw, which is the right shape for writing them and the
 * wrong shape for calling them one at a time in a route. This is the adapter:
 *
 *   const fields = readFields(() => ({
 *     title: requireString(body.title, 'Title', { max: 200 }),
 *   }))
 *   if (!fields.ok) return fields.response
 */
export function readFields<T>(
  fn: () => T,
): { ok: true; values: T } | { ok: false; response: Response } {
  try {
    return { ok: true, values: fn() }
  } catch (err) {
    return { ok: false, response: badRequest(err) }
  }
}

/**
 * The maximum length of an email address, from RFC 5321.
 *
 * Worth enforcing even though the address is only ever handed to Supabase:
 * it is the field that gets typed into a rate-limit key, and a key is a row.
 */
export const MAX_EMAIL_LENGTH = 254

/**
 * A deliberately loose address check.
 *
 * There is no regex that matches exactly the set of deliverable addresses,
 * and every attempt to write one rejects somebody's real mailbox. The only
 * proof an address works is a message arriving at it, which is what the
 * confirmation email is for. This rejects what is obviously not an address
 * and gets out of the way.
 */
export function requireEmail(value: unknown, field = 'Email address'): string {
  const raw = requireString(value, field, { max: MAX_EMAIL_LENGTH })
  const address = raw.toLowerCase()
  const at = address.indexOf('@')
  const looksLikeAddress =
    at > 0 &&
    at === address.lastIndexOf('@') &&
    at < address.length - 3 &&
    address.includes('.', at) &&
    !address.includes(' ') &&
    !address.endsWith('.')
  if (!looksLikeAddress) {
    throw new ValidationError('That does not look like an email address.')
  }
  return address
}

/**
 * The rule that makes a Workmark account a student account.
 *
 * This lived only in the browser, which meant it was decoration: the signup
 * call went straight from the page to Supabase, so anyone willing to open
 * devtools could register any address at all. The check belongs on a server
 * the client cannot skip, and this is that check.
 *
 * Subdomains count — `cs.university.edu` is as real as `university.edu` —
 * so the test is the last label, not the whole suffix.
 */
export function isEduAddress(address: string): boolean {
  const domain = address.toLowerCase().split('@')[1]
  if (!domain) return false
  return domain.endsWith('.edu')
}

/** The domain half, for the permanent record of how an account was verified. */
export function emailDomain(address: string): string | null {
  return address.toLowerCase().split('@')[1] ?? null
}
