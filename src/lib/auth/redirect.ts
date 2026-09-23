// Where an auth callback is allowed to send somebody.
//
// ── Why this is not a one-liner ───────────────────────────────────────────
// `next` arrives in a URL, so it is whatever the sender put there. A
// callback that redirects wherever it says is an open redirect on a session
// that has just been established — somebody could mail a genuine Workmark
// recovery link that signs the user in and lands them on a page the sender
// controls, with a Workmark URL in the address bar the whole way.
//
// "Starts with a slash" is the obvious check and it is not enough. Browsers
// read `//evil.test` as protocol-relative and `/\evil.test` the same way,
// while both look like paths to a careless test. Those are the two that get
// missed, so they are named here rather than left to a regex nobody rereads.

/** The path to send somebody to, or "/" when the one asked for is not ours. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/'

  // A backslash is a forward slash to every browser's URL parser, so
  // normalise before looking at the first two characters — otherwise
  // `/\evil.test` passes a check written only against `//`.
  const value = raw.replace(/\\/g, '/')

  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'

  // A control character can truncate the URL in some parsers and not others,
  // which is how two pieces of code disagree about where a link points.
  if (/[\x00-\x1F\x7F]/.test(value)) return '/'

  return value
}
