// Who someone is, and what that lets them do.
//
// Until this existed there was one kind of account. The human review queue
// was a CLI script whose reviewer was "whoever holds the service key" — the
// same credential that runs migrations — with no scoping and no record of
// who read whose file.
//
// Roles are read from the database rather than from the login token. A token
// claim is faster and is the usual advice, but it goes stale: revoking
// someone's admin wouldn't take effect until their session refreshed.
// Volume here is small and admin is the sensitive role, so the lookup wins.

import type { SupabaseClient } from '@supabase/supabase-js'

export const ROLES = ['student', 'faculty', 'admin'] as const
export type Role = (typeof ROLES)[number]

export type AccountStatus = 'active' | 'suspended' | 'declined'

export interface Account {
  id: string
  roles: Role[]
  status: AccountStatus
  facultyVerifiedAt: string | null
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

/**
 * The signed-in user's account, or null if they aren't signed in.
 *
 * Returns null for a suspended account too: everything downstream asks
 * "what may this person do", and the answer for a suspended account is
 * nothing, so a caller that forgets to check status still fails closed.
 */
export async function getAccount(supabase: SupabaseClient): Promise<Account | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('accounts')
    .select('id, roles, status, faculty_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || data.status !== 'active') return null

  return {
    id: data.id,
    roles: (data.roles ?? []).filter(isRole),
    status: data.status,
    facultyVerifiedAt: data.faculty_verified_at,
  }
}

/**
 * The account row as it actually is, including inactive ones.
 *
 * `getAccount` deliberately returns null for anything that isn't active, so
 * every authorization path fails closed without having to know why. That is
 * the right default and it stays. But a few places need the distinction:
 * someone whose faculty claim is awaiting approval is not the same as
 * someone who is signed out, and treating them the same bounces them
 * between /login and /faculty forever.
 *
 * Use this only for routing and for telling someone what's happening. Never
 * for deciding what they may do — that is `getAccount` and `hasRole`.
 */
export async function getAccountRecord(supabase: SupabaseClient): Promise<Account | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('accounts')
    .select('id, roles, status, faculty_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    roles: (data.roles ?? []).filter(isRole),
    status: data.status as AccountStatus,
    facultyVerifiedAt: data.faculty_verified_at,
  }
}

export function hasRole(account: Account | null, role: Role): boolean {
  return !!account && account.roles.includes(role)
}

/**
 * Faculty whose claim has actually been checked.
 *
 * The distinction matters because verification gates the *weight* an
 * attestation carries, not access to the account. Someone can declare
 * themselves faculty and start posting immediately; what they don't get
 * until a person confirms it is the higher weight. That makes lying about
 * it worthless, which is the point.
 */
export function isVerifiedFaculty(account: Account | null): boolean {
  return hasRole(account, 'faculty') && !!account?.facultyVerifiedAt
}

// ─── Staff audit ─────────────────────────────────────────────────────────────

export type AdminSubject =
  | 'review_request' | 'dispute' | 'unresolved_skill' | 'job' | 'account' | 'student_file'

/**
 * Record a staff action — including a read.
 *
 * Logging reads is unusual and deliberate. An admin opening a student's file
 * is a person reading a consumer record about someone else; internally
 * that's permitted, but "who looked at this, and when" is the first question
 * after any complaint and it cannot be answered retroactively.
 *
 * Best-effort by design: a logging failure must not block the staff action
 * itself, since the alternative is a queue that stops working when the audit
 * table has a bad day. It is logged loudly instead.
 */
export async function recordAdminAction(
  admin: SupabaseClient,
  args: {
    adminId: string
    action: string
    subjectType: AdminSubject
    subjectId: string
    studentId?: string | null
    detail?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.from('admin_actions').insert({
    admin_id: args.adminId,
    action: args.action,
    subject_type: args.subjectType,
    subject_id: args.subjectId,
    student_id: args.studentId ?? null,
    detail: args.detail ?? null,
  })
  if (error) console.error('[auth/roles] admin action not recorded:', error, args)
}
