// The staff queue: everything waiting on a person, in one list.
//
// Six features write data intended for a human to act on, and until now none
// of them had anywhere to be seen. Work submitted for review reached a CLI
// script. Disputes that needed a person reached nothing at all — with a
// 30-day statutory clock running on them. Skills that didn't match were
// dropped. Failed scans told nobody.
//
// There is deliberately NO queue table. Each source stays the source of
// truth and gets a small adapter that maps it into a common shape. A
// separate queue table would need dual writes on every path and would
// eventually disagree with reality, which is the classic version of this
// bug — a queue saying a dispute is open after it was resolved is worse than
// no queue.
//
// Two of the six orphans are deliberately NOT here. The fairness audit data
// is a report, not a work item, and recalibration is a scheduled job, not a
// work item. Forcing them into a list of things to click would misrepresent
// both.

import type { SupabaseClient } from '@supabase/supabase-js'

export type QueueKind =
  | 'review_request'
  | 'dispute'
  | 'unresolved_skill'
  | 'failed_job'
  | 'faculty_verification'

export type Severity = 'overdue' | 'due_soon' | 'normal'

export interface QueueItem {
  kind: QueueKind
  id: string
  /** What this is, in one line. */
  title: string
  /** Extra context — the note, the reason it failed, the near-matches. */
  detail: string | null
  /** Who it concerns, when that's a person. */
  subjectName: string | null
  subjectId: string | null
  createdAt: string
  /** Only disputes have a real deadline; null everywhere else. */
  dueAt: string | null
  severity: Severity
  /** Sorting weight — higher surfaces first within the same severity. */
  weight: number
}

/** A dispute this close to its deadline is called out before it's late. */
const DUE_SOON_DAYS = 7

export function severityFor(dueAt: string | null, now: Date): Severity {
  if (!dueAt) return 'normal'
  const days = (Date.parse(dueAt) - now.getTime()) / 86_400_000
  if (days < 0) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'due_soon'
  return 'normal'
}

const SEVERITY_ORDER: Record<Severity, number> = { overdue: 0, due_soon: 1, normal: 2 }

/**
 * Overdue first, then approaching a deadline, then by weight, then oldest.
 *
 * Age last rather than first on purpose: an unmatched skill seen 200 times
 * matters more than one seen once, even if the rare one has been sitting
 * there longer. Within equal weight, oldest wins.
 */
export function sortQueue(items: QueueItem[]): QueueItem[] {
  return items.slice().sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    if (a.severity !== 'normal') {
      // Both have deadlines — the nearer one first.
      const byDue = Date.parse(a.dueAt!) - Date.parse(b.dueAt!)
      if (byDue !== 0) return byDue
    }
    if (a.weight !== b.weight) return b.weight - a.weight
    return Date.parse(a.createdAt) - Date.parse(b.createdAt)
  })
}

// ─── Adapters ────────────────────────────────────────────────────────────────
// One per source. Each is independent, so a source that errors costs its own
// items and not the whole queue.

async function reviewRequests(admin: SupabaseClient, now: Date): Promise<QueueItem[]> {
  const { data } = await admin
    .from('review_requests')
    .select('id, student_id, url, note, requested_at, students(full_name)')
    .eq('status', 'pending')
    .order('requested_at')

  return (data ?? []).map((r) => {
    const student = r.students as unknown as { full_name: string | null } | null
    return {
      kind: 'review_request' as const,
      id: r.id,
      title: r.url,
      detail: r.note,
      subjectName: student?.full_name ?? null,
      subjectId: r.student_id,
      createdAt: r.requested_at,
      dueAt: null,
      severity: 'normal' as const,
      // A person is waiting on this with no way to chase it, so it outranks
      // the housekeeping items.
      weight: 50,
    }
  })
}

async function disputes(admin: SupabaseClient, now: Date): Promise<QueueItem[]> {
  const { data } = await admin
    .from('disputes')
    .select('id, student_id, evidence_id, category, detail, status, filed_at, due_at, students(full_name)')
    .in('status', ['open', 'reinvestigating', 'resolved_manual'])
    .order('due_at')

  return (data ?? []).map((d) => {
    const student = d.students as unknown as { full_name: string | null } | null
    return {
      kind: 'dispute' as const,
      id: d.id,
      title: `Dispute · ${d.category}`,
      detail: d.detail,
      subjectName: student?.full_name ?? null,
      subjectId: d.student_id,
      createdAt: d.filed_at,
      dueAt: d.due_at,
      severity: severityFor(d.due_at, now),
      // The only kind with a legal deadline. Even before the clock bites,
      // it outranks everything else.
      weight: 100,
    }
  })
}

async function unresolvedSkills(admin: SupabaseClient): Promise<QueueItem[]> {
  const { data } = await admin
    .from('unresolved_skills')
    .select('id, raw_string, candidates, seen_count, first_seen_at, example_source')
    .eq('status', 'pending')
    .order('seen_count', { ascending: false })
    .limit(60)

  return (data ?? []).map((u) => {
    const candidates = (u.candidates ?? []) as { canonicalName?: string; similarity?: number }[]
    const near = candidates
      .slice(0, 3)
      .map((c) => `${c.canonicalName ?? '?'} (${Math.round((c.similarity ?? 0) * 100)}%)`)
      .join(', ')
    return {
      kind: 'unresolved_skill' as const,
      id: u.id,
      title: `"${u.raw_string}" didn't match anything`,
      detail: [
        `Seen ${u.seen_count} time${u.seen_count === 1 ? '' : 's'}`,
        near ? `Closest: ${near}` : null,
        u.example_source ? `e.g. ${u.example_source}` : null,
      ].filter(Boolean).join(' · '),
      subjectName: null,
      subjectId: null,
      createdAt: u.first_seen_at,
      dueAt: null,
      severity: 'normal' as const,
      // Frequency is the signal: a name 200 students hit is a gap in the
      // taxonomy, one seen once is probably a typo. Capped so a single very
      // common miss can't bury everything else.
      weight: Math.min(u.seen_count, 40),
    }
  })
}

async function failedJobs(admin: SupabaseClient): Promise<QueueItem[]> {
  const { data } = await admin
    .from('jobs')
    .select('id, student_id, kind, error, result, finished_at, students(full_name)')
    .eq('status', 'failed')
    .order('finished_at', { ascending: false })
    .limit(40)

  return (data ?? []).map((j) => {
    const student = j.students as unknown as { full_name: string | null } | null
    return {
      kind: 'failed_job' as const,
      id: j.id,
      title: `Scan failed · ${j.kind}`,
      detail: j.error ?? 'No reason recorded.',
      subjectName: student?.full_name ?? null,
      subjectId: j.student_id,
      createdAt: j.finished_at ?? new Date(0).toISOString(),
      dueAt: null,
      severity: 'normal' as const,
      weight: 30,
    }
  })
}

async function facultyVerifications(admin: SupabaseClient): Promise<QueueItem[]> {
  // Faculty accounts nobody has confirmed yet. They are open and working —
  // the account isn't gated on this — but until it's actioned their claim
  // shows as pending everywhere it's displayed, including to students.
  const { data } = await admin
    .from('accounts')
    .select('id, created_at, faculty_requested_at, display_name, institution')
    .contains('roles', ['faculty'])
    .is('faculty_verified_at', null)
    .eq('status', 'active')
    .order('faculty_requested_at', { nullsFirst: false })

  if (!data || data.length === 0) return []

  return data.map((a) => {
    const requestedAt = a.faculty_requested_at ?? a.created_at
    return {
      kind: 'faculty_verification' as const,
      id: a.id,
      title: a.display_name ? `Confirm ${a.display_name}` : 'Confirm a faculty account',
      detail: a.institution ? `Claims faculty at ${a.institution}` : 'Claims to be faculty',
      subjectName: a.display_name ?? null,
      subjectId: a.id,
      createdAt: requestedAt,
      dueAt: null,
      severity: 'normal' as const,
      // Middling. Nobody is blocked — the account works — but their claim
      // reads "pending" to every student who sees it, so leaving it sitting
      // costs a real professor credibility they may well be owed.
      weight: 55,
    }
  })
}

/**
 * Everything waiting on a person.
 *
 * Sources are fetched in parallel and each is allowed to fail alone: one
 * broken adapter costs its own items rather than emptying the queue, which
 * matters most for the one source with a legal deadline attached.
 */
export async function loadQueue(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ items: QueueItem[]; failedSources: QueueKind[] }> {
  const sources: [QueueKind, Promise<QueueItem[]>][] = [
    ['dispute', disputes(admin, now)],
    ['review_request', reviewRequests(admin, now)],
    ['faculty_verification', facultyVerifications(admin)],
    ['unresolved_skill', unresolvedSkills(admin)],
    ['failed_job', failedJobs(admin)],
  ]

  const settled = await Promise.allSettled(sources.map(([, p]) => p))
  const items: QueueItem[] = []
  const failedSources: QueueKind[] = []

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') items.push(...result.value)
    else {
      failedSources.push(sources[i][0])
      console.error(`[admin/queue] source ${sources[i][0]} failed:`, result.reason)
    }
  })

  return { items: sortQueue(items), failedSources }
}

export function countsByKind(items: QueueItem[]): Record<QueueKind, number> {
  const counts = {
    dispute: 0, review_request: 0, faculty_verification: 0,
    unresolved_skill: 0, failed_job: 0,
  } as Record<QueueKind, number>
  for (const i of items) counts[i.kind]++
  return counts
}
