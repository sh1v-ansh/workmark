import { describe, it, expect } from 'vitest'
import {
  MAX_WORKSPACE_MEMBERS,
  isActiveMember,
  isPendingInvite,
  roleOf,
  isOwner,
  canInvite,
  canRemove,
  canDemote,
  canCloseWorkspace,
  type MemberRow,
  type MemberRole,
} from '../src/lib/workspace/membership'

function member(
  account_id: string,
  role: MemberRole = 'member',
  state: 'active' | 'pending' | 'removed' = 'active',
): MemberRow {
  return {
    account_id,
    role,
    accepted_at: state === 'pending' ? null : '2026-01-01T00:00:00Z',
    removed_at: state === 'removed' ? '2026-02-01T00:00:00Z' : null,
  }
}

describe('membership states', () => {
  it('an invitation grants nothing until it is accepted', () => {
    const invited = member('b', 'member', 'pending')
    expect(isPendingInvite(invited)).toBe(true)
    expect(isActiveMember(invited)).toBe(false)
    expect(roleOf([invited], 'b')).toBeNull()
  })

  // Removal sets a timestamp rather than deleting the row, so who was on a
  // team and when they left survives. That must not read as membership.
  it('a removed member is not on the team', () => {
    const gone = member('b', 'owner', 'removed')
    expect(isActiveMember(gone)).toBe(false)
    expect(isOwner([gone], 'b')).toBe(false)
  })
})

describe('canInvite', () => {
  const owner = member('a', 'owner')

  it('is owners only', () => {
    expect(canInvite([owner, member('b')], 'a')).toBeNull()
    expect(canInvite([owner, member('b')], 'b')).toBe('Only an owner can invite people.')
  })

  it('refuses somebody who is not on the team at all', () => {
    expect(canInvite([owner], 'stranger')).toBe('Only an owner can invite people.')
  })

  // The cap has to count invitations that have been sent but not answered.
  // Counting only accepted members lets an owner send twenty and watch the
  // team quietly exceed the limit as they trickle in.
  it('counts pending invitations against the cap', () => {
    const team: MemberRow[] = [owner]
    for (let i = 1; i < MAX_WORKSPACE_MEMBERS; i++) {
      team.push(member(`p${i}`, 'member', 'pending'))
    }
    expect(team.length).toBe(MAX_WORKSPACE_MEMBERS)
    expect(canInvite(team, 'a')).toBe(`A workspace holds at most ${MAX_WORKSPACE_MEMBERS} people.`)
  })

  it('does not count people who have left', () => {
    const team: MemberRow[] = [owner]
    for (let i = 1; i < MAX_WORKSPACE_MEMBERS; i++) {
      team.push(member(`r${i}`, 'member', 'removed'))
    }
    expect(canInvite(team, 'a')).toBeNull()
  })
})

describe('canRemove', () => {
  const owner = member('a', 'owner')
  const other = member('b', 'member')

  it('lets an owner remove a member', () => {
    expect(canRemove([owner, other], 'a', 'b')).toBeNull()
  })

  it('does not let a member remove anyone else', () => {
    expect(canRemove([owner, other], 'b', 'a')).toBe('Only an owner can remove someone.')
  })

  // Leaving is a different act from being removed, and needs no permission.
  it('lets a plain member leave on their own', () => {
    expect(canRemove([owner, other], 'b', 'b')).toBeNull()
  })

  it('will not let the last owner walk out', () => {
    expect(canRemove([owner, other], 'a', 'a'))
      .toBe('A workspace needs at least one owner — make someone else an owner first.')
  })

  it('lets an owner leave once there is a second one', () => {
    expect(canRemove([owner, member('b', 'owner')], 'a', 'a')).toBeNull()
  })

  it('refuses to remove somebody who was never on the team', () => {
    expect(canRemove([owner], 'a', 'ghost')).toBe('That person is not on this team.')
  })
})

describe('canDemote and canCloseWorkspace', () => {
  const owner = member('a', 'owner')

  it('is owners only, and the last owner cannot demote themselves', () => {
    expect(canDemote([owner, member('b', 'owner')], 'a', 'b')).toBeNull()
    expect(canDemote([owner, member('b')], 'b', 'a')).toBe('Only an owner can change roles.')
    expect(canDemote([owner, member('b')], 'a', 'a'))
      .toBe('A workspace needs at least one owner — make someone else an owner first.')
  })

  it('lets only an owner close the workspace', () => {
    expect(canCloseWorkspace([owner], 'a')).toBeNull()
    expect(canCloseWorkspace([owner, member('b')], 'b')).toBe('Only an owner can close a workspace.')
  })
})
