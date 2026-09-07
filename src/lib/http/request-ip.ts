/**
 * Who is asking, when nobody is signed in yet.
 *
 * Every rate limit in the app so far is keyed on a user id, which works
 * everywhere except the one place it is needed most: the sign-in and sign-up
 * forms, where there is no user yet by definition. An IP is a poor identity
 * — shared behind a university NAT, rotated on mobile, trivially changed by
 * anyone renting a proxy — but it is the only handle available before a
 * session exists, and it is enough to stop the cheap version of the attack.
 *
 * Header order matters and is not a matter of taste. `x-forwarded-for` is
 * a chain the client can prepend to, so its leftmost entry is whatever the
 * caller wrote there. Vercel sets `x-vercel-forwarded-for` and `x-real-ip`
 * itself at the edge and they cannot be spoofed from outside, so those are
 * consulted first and the forwarded chain is the last resort.
 */
export function clientIp(request: Request): string {
  const direct = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-real-ip')
  if (direct) return normalise(direct)

  // Last resort, and only the leftmost hop is meaningful. Attacker-supplied
  // in principle — which is fine, because the worst it does is let someone
  // give themselves a fresh bucket, exactly as they could by changing IP.
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return normalise(first)
  }

  // No proxy headers at all — local development, or a direct hit. One
  // shared bucket is the right answer: unattributable traffic should not
  // get an unlimited one each.
  return 'unknown'
}

/**
 * Trim the port off `1.2.3.4:5678` and cap the length.
 *
 * The value ends up inside a rate-limit key that is written to Postgres, so
 * an unbounded header would be an unbounded row.
 */
function normalise(value: string): string {
  const withoutPort = value.includes(':') && value.split(':').length === 2
    ? value.split(':')[0]
    : value
  return withoutPort.slice(0, 45)
}
