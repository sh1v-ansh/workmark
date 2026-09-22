// Reading and writing the addresses a student's commits are signed with.
//
// Split from attribution.ts, which is the pure rule and stays testable
// without a database. This is the half that touches Supabase.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnclaimedEmail } from './attribution'

/**
 * Every address this student has confirmed, lowercased.
 *
 * Returns an empty set on a read failure rather than throwing. The cost of
 * being wrong is that this scan falls back to GitHub's own attribution,
 * which is exactly what happened before any of this existed — so a database
 * blip degrades to the old behaviour instead of failing the scan.
 */
export async function knownCommitEmails(
  supabase: SupabaseClient,
  studentId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('student_commit_emails')
    .select('email')
    .eq('student_id', studentId)

  if (error) {
    console.error('[emails] could not read confirmed addresses:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map((r) => (r.email as string).toLowerCase()))
}

/**
 * Remember an address we could not place, so the student can be asked.
 *
 * Upserted per (student, email, repo) so a rescan updates the count rather
 * than asking the same question twice. A row the student has already
 * dismissed keeps its dismissed_at — `last_seen_at` moving is not a reason
 * to start asking again about an address they have already said is not
 * theirs.
 */
export async function recordUnclaimedEmails(
  supabase: SupabaseClient,
  studentId: string,
  repoFullName: string,
  unclaimed: UnclaimedEmail[],
): Promise<void> {
  if (unclaimed.length === 0) return

  // Capped. A repository with two hundred contributors would otherwise write
  // two hundred rows nobody will ever read, and the question is only useful
  // for the handful of addresses with real volume behind them.
  const worth = unclaimed.slice(0, 5)

  const { error } = await supabase
    .from('observed_commit_emails')
    .upsert(
      worth.map((u) => ({
        student_id: studentId,
        email: u.email,
        display_name: u.name,
        repo_full_name: repoFullName,
        commit_count: u.commits,
        last_seen_at: new Date().toISOString(),
      })),
      { onConflict: 'student_id,email,repo_full_name', ignoreDuplicates: false },
    )

  // Logged, not thrown. This is a prompt for a question, not evidence —
  // failing a scan over it would trade something that matters for something
  // that does not.
  if (error) console.error('[emails] could not record unclaimed addresses:', error.message)
}
