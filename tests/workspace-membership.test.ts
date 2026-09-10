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
  approvalsNeeded,
  removalCarried,
  assigneeForRole,
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

  it('lets an owner remove someone who never contributed', () => {
    expect(canRemove([owner, other], 'a', 'b', false)).toBeNull()
  })

  // The rule that matters: the person who created the project must not be
  // able to drop a teammate the day before it closes and keep the work.
  it('will not let an owner remove a contributor on their own', () => {
    expect(canRemove([owner, other], 'a', 'b', true))
      .toBe('This person has contributed work. Open a removal request so the team can agree.')
  })

  it('does not let a member remove anyone else', () => {
    expect(canRemove([owner, other], 'b', 'a', false)).toBe('Only an owner can remove someone.')
  })

  // Leaving is a different act from being removed, and needs no permission —
  // including for somebody who has contributed plenty.
  it('lets a plain member leave on their own', () => {
    expect(canRemove([owner, other], 'b', 'b', true)).toBeNull()
  })

  it('will not let the last owner walk out', () => {
    expect(canRemove([owner, other], 'a', 'a', false))
      .toBe('A workspace needs at least one owner — make someone else an owner first.')
  })

  it('lets an owner leave once there is a second one', () => {
    expect(canRemove([owner, member('b', 'owner')], 'a', 'a', false)).toBeNull()
  })

  it('refuses to remove somebody who was never on the team', () => {
    expect(canRemove([owner], 'a', 'ghost', false)).toBe('That person is not on this team.')
  })
})

describe('removal by agreement', () => {
  // The person being removed neither counts nor votes. On a team of four
  // that is two of the remaining three.
  it('needs a majority of the other members', () => {
    const four = [member('a', 'owner'), member('b'), member('c'), member('d')]
    expect(approvalsNeeded(four, 'b')).toBe(2)
    expect(removalCarried(four, 'b', 1)).toBe(false)
    expect(removalCarried(four, 'b', 2)).toBe(true)
  })

  it('on a pair, the other person alone is enough', () => {
    const two = [member('a', 'owner'), member('b')]
    expect(approvalsNeeded(two, 'b')).toBe(1)
    expect(removalCarried(two, 'b', 1)).toBe(true)
  })
})

describe('assigneeForRole', () => {
  const team = [
    member('a', 'owner'),
    member('b'),
    member('c'),
  ]
  team[0].work_role = 'fullstack'
  team[1].work_role = 'backend'
  team[2].work_role = 'design'

  it('prefers an exact match', () => {
    expect(assigneeForRole(team, 'backend')).toBe('b')
  })

  it('falls back to a generalist', () => {
    expect(assigneeForRole(team, 'ml')).toBe('a')
  })

  // Better unassigned than dumped on whoever happens to be listed first.
  it('leaves a task unassigned when nobody fits', () => {
    const specialists = [member('b'), member('c')]
    specialists[0].work_role = 'backend'
    specialists[1].work_role = 'design'
    expect(assigneeForRole(specialists, 'ml')).toBeNull()
    expect(assigneeForRole(team, null)).toBeNull()
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
