// The rules a password has to meet, in one place.
//
// They were constants at the top of the signup route, which was fine while
// signup was the only thing that set a password. Reset sets one too, and two
// copies of a minimum length is how an account ends up creatable with eight
// characters and resettable with six.

/** Supabase's own floor is 6. Eight is the shortest worth calling a rule. */
export const PASSWORD_MIN = 8

/**
 * bcrypt, which is what Supabase hashes with, silently truncates at 72
 * bytes. A longer password is not stronger, it is the first 72 bytes with a
 * tail nobody checks — so it is refused rather than quietly cut.
 */
export const PASSWORD_MAX = 72

/**
 * Why this password will not do, or null.
 *
 * Deliberately only length. A rule about symbols and digits pushes people
 * towards Passw0rd! — short, predictable and in every cracking dictionary —
 * and away from the long ordinary phrase that is actually hard to guess.
 * This matches NIST 800-63B, which dropped composition rules for that
 * reason.
 */
export function passwordProblem(password: string): string | null {
  // Bytes, not characters: bcrypt counts bytes, and an emoji is four of
  // them. Someone whose passphrase is mostly non-Latin can otherwise be
  // told it is fine here and have it truncated at the hash.
  const bytes = new TextEncoder().encode(password).length
  if (password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`
  }
  if (bytes > PASSWORD_MAX) {
    return `That is too long — ${PASSWORD_MAX} bytes is the most the hash can take.`
  }
  return null
}
