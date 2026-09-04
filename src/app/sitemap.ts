import type { MetadataRoute } from 'next'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://www.workmark.org'

export const revalidate = 3600

/**
 * The list of pages worth indexing.
 *
 * Two dynamic sets, both opt-in by design rather than by omission: student
 * profiles appear only if the student claimed a handle, and listings only
 * while they're open. Nobody is put in a search index by default.
 *
 * Read with the service role because a sitemap is generated with no session
 * at all, and RLS would otherwise return nothing. The queries are narrowed
 * to exactly the columns and rows that are already public — a handle and a
 * listing id — so this doesn't widen what anyone can see.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/marketplace`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/levels`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/legal/acceptable-use`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const [{ data: profiles }, { data: listings }] = await Promise.all([
      admin.from('students').select('handle').not('handle', 'is', null).limit(5000),
      admin.from('listings').select('id, created_at').eq('status', 'open').limit(5000),
    ])

    return [
      ...staticPages,
      ...(profiles ?? []).map((p) => ({
        url: `${SITE}/p/${p.handle}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...(listings ?? []).map((l) => ({
        url: `${SITE}/listings/${l.id}`,
        lastModified: l.created_at ? new Date(l.created_at) : now,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    ]
  } catch (err) {
    // A sitemap that 500s is worse than a short one — search engines treat
    // a failing sitemap as a signal about the whole site.
    console.error('[sitemap] dynamic entries failed, serving static only:', err)
    return staticPages
  }
}
