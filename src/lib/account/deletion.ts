// Leaving Workmark.
//
// Two stages, seven days apart.
//
// Asking to leave takes effect immediately in every way a person would
// notice: they're signed out, their account stops working, their public
// profile stops resolving, they vanish from the student directory, and
// their open applications are withdrawn. Nothing about them is discoverable
// from the moment they click the button.
//
// The actual destruction waits a week. That delay is not politeness — it's
// the difference between "someone got into my session for five minutes" and
// "someone got into my session for five minutes and erased four semesters
// of my verified record". Everything is recoverable during it except the
// outward-facing things above, and the page says so rather than implying a
// clean undo.
//
// After the week, the auth user is deleted and every row cascades from it.
// There is no soft-deleted skeleton left behind: a student's file is a
// consumer report about them, and keeping a copy of one after they asked us
// not to is the exact thing they were trying to prevent.

import type { SupabaseClient } from '@supabase/supabase-js'

/** How long a deletion can be undone. */
export const GRACE_DAYS = 7

export interface DeletionState {
  requestedAt: string
  /** When the record is actually destroyed, ISO date-time. */
  purgesAt: string
}

export function purgesAt(requestedAt: string): string {
  return new Date(Date.parse(requestedAt) + GRACE_DAYS * 86_400_000).toISOString()
}

/**
 * Start a deletion.
 *
 * Runs under the service role: `accounts` has no user-facing update policy,
 * deliberately, because a row that says what someone is allowed to be must
 * not be writable by the browser.
 */
export async function requestDeletion(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; state: DeletionState } | { ok: false; message: string }> {
  const { data: account } = await admin
    .from('accounts')
    .select('status, deletion_requested_at')
    .eq('id', userId)
    .maybeSingle()

  if (!account) return { ok: false, message: 'No account to delete.' }
  if (account.status === 'deleting' && account.deletion_requested_at) {
    // Already going. Not an error — a double-submit or a second tab.
    return { ok: true, state: { requestedAt: account.deletion_requested_at, purgesAt: purgesAt(account.deletion_requested_at) } }
  }

  const now = new Date().toISOString()

  const { error } = await admin
    .from('accounts')
    .update({ status: 'deleting', deletion_requested_at: now, updated_at: now })
    .eq('id', userId)
    .eq('status', 'active')

  if (error) {
    console.error('[account/deletion] could not mark account:', error)
    return { ok: false, message: 'Could not start the deletion.' }
  }

  // Everything below is the part that must not wait a week. A person who
  // has asked to leave should not still be turning up in a search or
  // sitting in somebody's applicant list tomorrow morning.
  //
  // Each step is independent and best-effort: a failure in one must not
  // leave the account marked for deletion but still publicly listed, so
  // none of them can abort the others.
  const outward = await Promise.allSettled([
    admin.from('students').update({ open_to_collab: false, handle: null }).eq('id', userId),
    // decided_at is deliberately not set: it means "the poster answered",
    // and a withdrawal is the applicant answering. Setting it would make
    // the reply-time numbers in /admin/growth quietly wrong.
    admin.from('applications').update({ status: 'withdrawn' })
      .eq('student_id', userId).in('status', ['submitted', 'shortlisted']),
    // Their own open listings close. Leaving them up would have applicants
    // writing to somebody who no longer exists.
    admin.from('listings').update({ status: 'closed' }).eq('poster_id', userId).eq('status', 'open'),
  ])

  for (const r of outward) {
    if (r.status === 'rejected') console.error('[account/deletion] cleanup step failed:', r.reason)
  }

  await admin.from('account_deletions').insert({ user_id: userId, requested_at: now })

  return { ok: true, state: { requestedAt: now, purgesAt: purgesAt(now) } }
}

/**
 * Change your mind, inside the week.
 *
 * Restores the account itself. It cannot restore the handle, the directory
 * listing or the withdrawn applications — those went the moment the button
 * was pressed, on purpose — so the page that offers this says so.
 */
export async function restoreAccount(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; message?: string }> {
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('accounts')
    .update({ status: 'active', deletion_requested_at: null, updated_at: now })
    .eq('id', userId)
    .eq('status', 'deleting')
    .select('id')

  if (error) {
    console.error('[account/deletion] restore failed:', error)
    return { ok: false, message: 'Could not restore the account.' }
  }
  if (!data || data.length === 0) {
    return { ok: false, message: 'This account is not scheduled for deletion.' }
  }

  await admin
    .from('account_deletions')
    .update({ restored_at: now })
    .eq('user_id', userId)
    .is('purged_at', null)
    .is('restored_at', null)

  return { ok: true }
}
