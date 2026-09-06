import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * When the student's most recent scan finished.
 *
 * A rescan button with no date on it asks the student to guess whether their
 * record is stale, which is the one thing they came to the page to find out.
 *
 * Kept to a single indexed lookup: jobs_student_kind_idx covers
 * (student_id, kind, status), so this reads one row out of an index range
 * that is already small — a student has a handful of scans, not thousands.
 * Callers should put it in the Promise.all they are already running rather
 * than awaiting it on its own.
 */
export async function lastScanFinishedAt(
  supabase: SupabaseClient,
  studentId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('jobs')
    .select('finished_at')
    .eq('student_id', studentId)
    .eq('kind', 'github_scan')
    .eq('status', 'succeeded')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.finished_at ?? null
}

/**
 * The same timestamp as words.
 *
 * Lives here rather than in the button so it can be tested without a DOM,
 * and so anywhere else that needs to say "how stale is this" says it
 * identically.
 */
export function lastScanLabel(iso: string | null): string {
  if (!iso) return 'Not scanned yet'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Not scanned yet'
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'Scanned just now'
  if (mins < 60) return `Scanned ${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Scanned ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Scanned ${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `Scanned ${months} month${months === 1 ? '' : 's'} ago`
}
