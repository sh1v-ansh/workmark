import type { SupabaseClient } from '@supabase/supabase-js'

const LABELS: Record<string, string> = {
  friend: 'A friend or classmate',
  professor: 'A professor or advisor',
  club_or_society: 'A club or student society',
  social_media: 'Social media',
  search: 'Search',
  event: 'An event or hackathon',
  other: 'Something else',
  prefer_not_to_say: 'Prefer not to say',
}

/** "How did you hear about Workmark?" answers from signup, counted. */
export async function loadHeardAbout(admin: SupabaseClient) {
  const { data } = await admin
    .from('accounts')
    .select('heard_about, heard_about_detail')
    .not('heard_about', 'is', null)

  const counts = new Map<string, number>()
  const otherDetails: string[] = []
  for (const row of data ?? []) {
    counts.set(row.heard_about, (counts.get(row.heard_about) ?? 0) + 1)
    if (row.heard_about === 'other' && row.heard_about_detail) otherDetails.push(row.heard_about_detail)
  }
  const rows = Array.from(counts.entries())
    .map(([key, count]) => ({ label: LABELS[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)
  return { total: data?.length ?? 0, rows, otherDetails: otherDetails.slice(0, 30) }
}
