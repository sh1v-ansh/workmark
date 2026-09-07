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

export interface MemberRow {
  account_id: string
  role: MemberRole
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
export const MAX_WORKSPACE_MEMBERS = 6

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

export function canRemove(rows: MemberRow[], actorId: string, targetId: string): Refusal {
  // Leaving is not the same act as removing somebody, and an owner is not
  // needed to do it. Anyone on the team may leave.
  if (actorId === targetId) {
    return lastOwnerGuard(rows, actorId)
  }
  if (!isOwner(rows, actorId)) return 'Only an owner can remove someone.'
  if (roleOf(rows, targetId) === null) return 'That person is not on this team.'
  return null
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
