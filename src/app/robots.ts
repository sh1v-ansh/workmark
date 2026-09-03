import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://www.workmark.org'

/**
 * What search engines may look at.
 *
 * Without this file the answer is "everything they can reach", which is the
 * wrong default here: a student's public profile is deliberately public, but
 * their file, their dashboard, the admin console and every API route are
 * not. Most of those need a session and would 302 a crawler to /login
 * anyway — the point of listing them is that a search engine shouldn't be
 * spending its crawl budget discovering that, and shouldn't be indexing the
 * login page a hundred times over under different redirect URLs.
 *
 * `Disallow` is a request, not a security control. Anything that actually
 * must not be read is protected by auth and RLS; this only stops well-
 * behaved crawlers from wasting their time and ours.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/student/',
          '/faculty',
          '/me',
          '/account/',
          '/onboarding',
          '/waitlist',
          '/engagements/',
          // Applicant lists name real people who applied to something.
          '/listings/*/applicants',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
