import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Which of these posters are faculty we have actually confirmed.
 *
 * Goes through `verified_faculty_ids()` rather than reading `accounts`
 * directly. That table is behind RLS which lets you read your own row and
 * nothing else — correct, since it holds roles, status and who confirmed
 * whom — and RLS grants rows rather than columns, so there is no policy that
 * exposes just this. The function answers the one question and discloses
 * nothing else. See v05_0015.
 *
 * Returns confirmed ids only. A pending faculty claim is absent from the
 * set, and the caller shows no badge at all for it — not "unverified
 * faculty", which would still tell a student "professor", which is exactly
 * the part nobody has checked yet.
 */
export async function verifiedFacultyPosterIds(
  supabase: SupabaseClient,
  posterIds: (string | null | undefined)[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(posterIds.filter((id): id is string => !!id)))
  if (ids.length === 0) return new Set()

  const { data, error } = await supabase.rpc('verified_faculty_ids', { p_ids: ids })

  if (error) {
    // A badge is not worth failing a page over. Showing no badge is the
    // safe direction to fail in: it understates, and the listing still
    // works. Loud in the log because silently never showing it would look
    // like the feature was never built.
    console.error('[listings] verified faculty lookup failed:', error.message)
    return new Set()
  }

  return new Set(((data ?? []) as (string | { id: string })[]).map((row) => (typeof row === 'string' ? row : row.id)))
}
