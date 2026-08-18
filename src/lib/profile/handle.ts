// Handle validation for /p/[handle].
//
// A handle is permanent-ish in practice — it goes in résumés, email
// signatures, and job applications, and a student who changes it breaks
// every link they've already sent. So the rules are strict up front
// rather than lenient now and painful later.

// Anything that is (or plausibly will be) a top-level route. A handle
// that collides with one would either 404 or shadow a real page
// depending on Next's route precedence — both bad, and unfixable once
// someone's already shared the link.
const RESERVED = new Set([
  'p', 'api', 'admin', 'auth', 'login', 'logout', 'signup', 'onboarding',
  'listings', 'listing', 'students', 'student', 'engagements', 'engagement',
  'about', 'pricing', 'how-it-works', 'marketplace', 'projects', 'settings',
  'help', 'support', 'terms', 'privacy', 'legal', 'blog', 'docs', 'status',
  'workmark', 'www', 'app', 'dashboard', 'profile', 'new', 'edit', 'search',
])

export const HANDLE_MIN = 3
export const HANDLE_MAX = 30

export type HandleCheck = { ok: true; handle: string } | { ok: false; reason: string }

/**
 * Validates and normalizes. Returns the canonical (lowercased, trimmed)
 * form on success so callers never have to remember to normalize
 * separately — the value that comes back is the value to store.
 */
export function validateHandle(raw: string): HandleCheck {
  const handle = raw.trim().toLowerCase()

  if (handle.length < HANDLE_MIN) {
    return { ok: false, reason: `Handles are at least ${HANDLE_MIN} characters.` }
  }
  if (handle.length > HANDLE_MAX) {
    return { ok: false, reason: `Handles are at most ${HANDLE_MAX} characters.` }
  }
  if (!/^[a-z0-9-]+$/.test(handle)) {
    return { ok: false, reason: 'Handles can only use lowercase letters, numbers, and hyphens.' }
  }
  if (handle.startsWith('-') || handle.endsWith('-')) {
    return { ok: false, reason: "Handles can't start or end with a hyphen." }
  }
  if (handle.includes('--')) {
    return { ok: false, reason: "Handles can't contain two hyphens in a row." }
  }
  // A purely numeric handle is indistinguishable from an ID in a URL,
  // which makes /p/12345 ambiguous the moment anything else is keyed by
  // number.
  if (/^\d+$/.test(handle)) {
    return { ok: false, reason: 'Handles need at least one letter.' }
  }
  if (RESERVED.has(handle)) {
    return { ok: false, reason: 'That handle is reserved.' }
  }

  return { ok: true, handle }
}

export function suggestHandle(fullName: string | null, githubUsername: string | null): string {
  // GitHub username first — it's already unique, already the student's
  // chosen public identity, and already valid in this character set far
  // more often than a real name is.
  const source = githubUsername || fullName || ''
  const slug = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, HANDLE_MAX)
  const check = validateHandle(slug)
  return check.ok ? check.handle : ''
}
