// Who the mail says it is from.
//
// ── Why this is a module and not a string ─────────────────────────────────
// EMAIL_FROM was passed straight through to Resend, and emailAvailable() only
// checked it was non-empty. So a value with a typo in it — a stray quote, a
// missing angle bracket, a display name with no address at all — passed every
// check the app makes and then failed at Resend on every single send, with
// the reason visible only in a server log nobody was tailing. The product's
// symptom was "no email is going out", which is the same symptom as a missing
// API key, an unverified domain, and a wrong key. Four causes, one symptom,
// no way to tell them apart.
//
// Checking the shape here turns one of those four into a startup-time answer.

/** Both forms Resend takes. The second is the one worth using. */
const WITH_NAME = /^\s*(.+?)\s*<\s*([^<>\s]+)\s*>\s*$/
const PLAIN_ADDRESS = /^[^@\s<>",]+@[^@\s<>",]+\.[^@\s<>",]{2,}$/

export interface Sender {
  /** The bare address, whatever form it arrived in. */
  address: string
  /** The name shown beside it in an inbox, when one was given. */
  display: string | null
}

/**
 * Read EMAIL_FROM.
 *
 * Accepts `noreply@send.workmark.org` and `Workmark <noreply@send.workmark.org>`
 * — the second is better, because an inbox showing "Workmark" is one people
 * recognise and a bare address is one they report as spam.
 *
 * Returns null for anything that is not one of those two, rather than
 * guessing. A sender address that is nearly right is worse than one that is
 * plainly missing: the send fails the same way, but nobody thinks to look at
 * the variable.
 */
export function parseSender(raw: string | undefined | null): Sender | null {
  if (!raw) return null
  const value = raw.trim()
  if (value === '') return null

  // Quotes that were meant for the shell and ended up in the value. This is
  // the single most common way this variable goes wrong, and silently
  // stripping them would hide a mistake somebody should fix — but refusing to
  // send over it is worse, so it is stripped and the rest is checked.
  const unquoted = value.replace(/^['"]|['"]$/g, '').trim()

  const named = WITH_NAME.exec(unquoted)
  if (named) {
    const [, display, address] = named
    if (!PLAIN_ADDRESS.test(address)) return null
    // A display name carrying its own quotes renders them literally in an
    // inbox: "Workmark" <noreply@…> shows up with the quote marks on screen.
    const clean = display.replace(/^['"]|['"]$/g, '').trim()
    return { address, display: clean === '' ? null : clean }
  }

  return PLAIN_ADDRESS.test(unquoted) ? { address: unquoted, display: null } : null
}

/**
 * What goes in the `from` field.
 *
 * Rebuilt from the parsed parts rather than passed through, so whatever shape
 * the variable was written in, Resend receives one shape.
 */
export function formatSender(sender: Sender): string {
  return sender.display ? `${sender.display} <${sender.address}>` : sender.address
}
