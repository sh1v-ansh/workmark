// Who may do what inside a workspace.
//
// These rules also exist in SQL — is_workspace_member, is_workspace_owner and
// set_workspace_member_role in v05_0025 — and that is deliberate, not
// duplication to be tidied away. The database rules are the ones that hold
// when something goes wrong; these are the ones that let a route answer
// "you cannot do that" with a sentence instead of a constraint violation,
// and let the UI grey out a button before anybody clicks it.
//
// If the two ever disagree, the database is right. Which is why these are
// pure functions with tests rather than a second implementation with its
// own opinions.

export type MemberRole = 'owner' | 'member'

/**
 * What somebody actually does, as opposed to what they may manage.
 *
 * MemberRole is permission. This is the job, agreed between the students
 * themselves — the planner reads it to put each task on the right person,
 * and anyone can reassign afterwards. Not exclusive: two people can both be
 * backend, and 'fullstack' matches anything.
 */
export const WORK_ROLES = [
  'backend', 'frontend', 'fullstack', 'mobile',
  'data', 'ml', 'infra', 'design', 'other',
] as const
export type WorkRole = (typeof WORK_ROLES)[number]

/** Who a task wants. A task with no match stays unassigned rather than
 *  landing on whoever happens to be listed first. */
export function assigneeForRole(rows: MemberRow[], wanted: WorkRole | null): string | null {
  if (!wanted) return null
  const active = activeMembers(rows)
  const exact = active.find((r) => r.work_role === wanted)
  if (exact) return exact.account_id
  const generalist = active.find((r) => r.work_role === 'fullstack')
  return generalist ? generalist.account_id : null
}

export interface MemberRow {
  account_id: string
  role: MemberRole
  work_role?: WorkRole | null
  accepted_at: string | null
  removed_at: string | null
}

/**
 * A team is small on purpose.
 *
 * The evidence this produces is about what one person did. Past a certain
 * size, a contribution stops being legible — "twelve people shipped this"
 * says nothing about any of them — and the project stops being something a
 * student can point at and claim.
 */
export const MAX_WORKSPACE_MEMBERS = 4

/** On the team right now: accepted the invitation, and not since removed. */
export function isActiveMember(row: MemberRow): boolean {
  return row.accepted_at !== null && row.removed_at === null
}

/** Invited, hasn't answered yet. Grants nothing until they do. */
export function isPendingInvite(row: MemberRow): boolean {
  return row.accepted_at === null && row.removed_at === null
}

export function activeMembers(rows: MemberRow[]): MemberRow[] {
  return rows.filter(isActiveMember)
}

export function roleOf(rows: MemberRow[], accountId: string): MemberRole | null {
  const row = rows.find((r) => r.account_id === accountId && isActiveMember(r))
  return row ? row.role : null
}

export function isOwner(rows: MemberRow[], accountId: string): boolean {
  return roleOf(rows, accountId) === 'owner'
}

/** The reason an action is refused, or null if it is allowed. */
export type Refusal = string | null

export function canInvite(rows: MemberRow[], actorId: string): Refusal {
  if (!isOwner(rows, actorId)) return 'Only an owner can invite people.'
  // Pending invitations count against the cap. Otherwise an owner can send
  // twenty and the team silently exceeds the limit as they are accepted.
  const taken = rows.filter((r) => isActiveMember(r) || isPendingInvite(r)).length
  if (taken >= MAX_WORKSPACE_MEMBERS) {
    return `A workspace holds at most ${MAX_WORKSPACE_MEMBERS} people.`
  }
  return null
}

/**
 * These are peers, not employees.
 *
 * "The owner can remove you" is the wrong rule between students, and the one
 * most open to abuse — the person who created the project could drop a
 * teammate the day before it closes and keep the work. So it depends on
 * whether the person has actually done anything:
 *
 *   leaving           always allowed, by anyone
 *   never contributed an owner may remove them, with a reason on the record
 *   has contributed   needs a majority of the OTHER members to agree
 *
 * Mirrors remove_workspace_member in v05_0029. Removal never erases
 * evidence — whatever they finished stays theirs.
 */
export function canRemove(
  rows: MemberRow[],
  actorId: string,
  targetId: string,
  targetHasContributed: boolean,
): Refusal {
  // Leaving is not the same act as being removed, and needs no permission.
  if (actorId === targetId) {
    return lastOwnerGuard(rows, actorId)
  }
  if (!isOwner(rows, actorId)) return 'Only an owner can remove someone.'
  if (roleOf(rows, targetId) === null) return 'That person is not on this team.'
  if (targetHasContributed) {
    return 'This person has contributed work. Open a removal request so the team can agree.'
  }
  return null
}

/** How many approvals a removal request still needs. Majority of the others;
 *  the person being removed does not count and does not vote. */
export function approvalsNeeded(rows: MemberRow[], targetId: string): number {
  const others = activeMembers(rows).filter((r) => r.account_id !== targetId).length
  return Math.floor(others / 2) + 1
}

export function removalCarried(rows: MemberRow[], targetId: string, approvals: number): boolean {
  return approvals >= approvalsNeeded(rows, targetId)
}

export function canDemote(rows: MemberRow[], actorId: string, targetId: string): Refusal {
  if (!isOwner(rows, actorId)) return 'Only an owner can change roles.'
  if (roleOf(rows, targetId) === null) return 'That person is not on this team.'
  return targetId === actorId ? lastOwnerGuard(rows, actorId) : null
}

export function canCloseWorkspace(rows: MemberRow[], actorId: string): Refusal {
  return isOwner(rows, actorId) ? null : 'Only an owner can close a workspace.'
}

/**
 * A workspace must always have somebody who can manage it.
 *
 * Without this the last owner can step down or walk out and leave a
 * workspace nobody can invite to, close, or hand over — which is not a
 * permissions problem, it is a row that has to be fixed by hand.
 *
 * Mirrors the same check inside set_workspace_member_role.
 */
function lastOwnerGuard(rows: MemberRow[], accountId: string): Refusal {
  if (!isOwner(rows, accountId)) return null
  const owners = activeMembers(rows).filter((r) => r.role === 'owner')
  if (owners.length <= 1) {
    return 'A workspace needs at least one owner — make someone else an owner first.'
  }
  return null
}
