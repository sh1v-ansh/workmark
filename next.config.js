/**
 * Security headers.
 *
 * Vercel already terminates TLS and redirects http→https, so the site was
 * never served insecurely — but the redirect only helps after the first
 * request has already gone out over the wire. HSTS is what removes that
 * first request: once a browser has seen the header, it rewrites http to
 * https itself and never sends the plaintext one again.
 *
 * `preload` is included deliberately, but it is a one-way door: submitting
 * the domain to the preload list is easy and getting off it takes months.
 * The header is safe to serve either way — it only matters once someone
 * actually submits workmark.org at hstspreload.org.
 *
 * The CSP here is the narrow half: it says who may frame us, where forms
 * may post and what `<base>` may claim, and it upgrades any stray http
 * subresource. It deliberately does NOT constrain script-src or style-src.
 * The app renders roughly nine hundred inline styles, so a real style-src
 * would need 'unsafe-inline' and buy nothing, and a script-src without
 * per-request nonces would break Next's own inline bootstrap. A CSP that
 * has to be disabled the first time it fires is worse than an honest
 * partial one.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  },
]

// Only in production. A browser that has been told to pin https for
// localhost keeps doing it for every other project on that port, and
// clearing it means digging through browser internals.
if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
