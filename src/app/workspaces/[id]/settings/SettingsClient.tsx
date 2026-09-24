'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { ROLE_LABEL } from '@/lib/workspace/labels'
import { WORK_ROLES, MAX_WORKSPACE_MEMBERS } from '@/lib/workspace/membership'
import type { WorkspaceDetail, TeamMember } from '@/lib/workspace/queries'

function displayName(m: TeamMember): string {
  return m.name ?? (m.handle ? `@${m.handle}` : 'A teammate')
}

/**
 * Everything about the project that is not the work.
 *
 * Read once or twice a term, which is why it is no longer underneath the
 * board. The order is the order somebody needs it: the repository is what
 * makes any of this count, the role is one select, the team is the long
 * section, and closing the project is last — after everything else, where
 * nobody reaches it by accident.
 */
export default function SettingsClient({
  workspace,
  userId,
  finishedCount,
  repoOptions,
}: {
  workspace: WorkspaceDetail
  userId: string
  finishedCount: number
  repoOptions: { fullName: string; isPrivate: boolean }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  // Asks GitHub again which repositories Workmark can see, so a repository
  // created a minute ago shows up without reconnecting.
  async function refreshRepos() {
    setRefreshing(true)
    try {
      await fetch('/api/github/repos/sync', { method: 'POST' })
      router.refresh()
    } finally {
      setRefreshing(false)
    }
  }
  const [busy, setBusy] = useState<string | null>(null)
  const [invitee, setInvitee] = useState('')
  const [repo, setRepo] = useState(workspace.repoFullName ?? '')
  const [closing, setClosing] = useState(false)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const isOwner = workspace.yourRole === 'owner'
  const isDraft = workspace.status === 'draft'
  const isClosed = workspace.status === 'closed'
  const you = workspace.members.find((m) => m.isYou)
  const teamSize = workspace.members.length + workspace.invited.length

  async function call(key: string, url: string, init: RequestInit, okMessage?: string) {
    setBusy(key)
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      if (okMessage) toast(okMessage, 'success')
      router.refresh()
      return true
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  const linkRepo = () => call('repo', `/api/workspaces/${workspace.id}/repo`,
    { method: 'POST', body: JSON.stringify({ repoFullName: repo }) }, 'Repository linked.')

  const invite = async () => {
    const ok = await call('invite', `/api/workspaces/${workspace.id}/members`,
      { method: 'POST', body: JSON.stringify({ identifier: invitee }) }, 'Invitation sent.')
    if (ok) setInvitee('')
  }

  const setWorkRole = (value: string) => call('role', `/api/workspaces/${workspace.id}/members/${userId}`,
    { method: 'PATCH', body: JSON.stringify({ workRole: value || null }) }, 'Role updated.')

  const leave = () => call('leave', `/api/workspaces/${workspace.id}/members/${userId}`,
    { method: 'DELETE', body: JSON.stringify({}) }, 'You left the project.')

  async function openRemoval() {
    if (!removing) return
    const ok = await call('removal', `/api/workspaces/${workspace.id}/removals`, {
      method: 'POST',
      body: JSON.stringify({ targetAccountId: removing.accountId, reason: removeReason }),
    }, 'The team has been asked.')
    if (ok) { setRemoving(null); setRemoveReason('') }
  }

  const approveRemoval = (id: string) =>
    call(`approve-${id}`, `/api/workspaces/${workspace.id}/removals/${id}`,
      { method: 'POST' }, 'Your vote is counted.')

  const withdrawRemoval = (id: string) =>
    call(`withdraw-${id}`, `/api/workspaces/${workspace.id}/removals/${id}`,
      { method: 'DELETE' }, 'Request withdrawn.')

  async function closeProject() {
    const ok = await call('close', `/api/workspaces/${workspace.id}/close`, { method: 'POST' })
    if (ok) setClosing(false)
  }

  return (
    <>
      {/* ── Repository ── */}
      <Card style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, marginBottom: 4 }}>Repository</h2>
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
          One repository per project. Everyone&apos;s commits are read through it and matched back
          to whoever wrote them, so each person gets credit for their own work.
        </p>

        {repoOptions.length === 0 ? (
          // The empty-GitHub case: most first-years have nothing to pick
          // yet, so the way forward is to make the repository, not to be
          // told none exist.
          <div>
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
              No repositories yet. Create an empty one on GitHub for this project, then refresh.
              If GitHub asks, give Workmark access to it.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button href="https://github.com/new" variant="accent" size="sm">Create a repository on GitHub</Button>
              <Button variant="outline" size="sm" onClick={refreshRepos} busyLabel={refreshing ? 'Refreshing…' : null}>Refresh</Button>
              <Link href="/student/github" style={{ fontSize: 13, color: C.accent, alignSelf: 'center' }}>GitHub settings</Link>
            </div>
          </div>
        ) : isOwner ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="dk-input"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              aria-label="Repository"
              style={{ flex: '1 1 240px', maxWidth: 420 }}
            >
              <option value="">Choose a repository…</option>
              {repoOptions.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}{r.isPrivate ? ' (private)' : ''}
                </option>
              ))}
            </select>
            <Button
              onClick={linkRepo}
              disabled={!repo || repo === workspace.repoFullName}
              // A real wait, not a fakeable one: this reaches GitHub. So it
              // gets an honest label and a spinner rather than a button that
              // looks broken for two seconds.
              busyLabel={busy === 'repo' ? 'Linking…' : null}
            >
              {workspace.repoFullName ? 'Change' : 'Link'}
            </Button>
          </div>
        ) : (
          <p style={{ fontSize: T.body, color: C.text, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name="github" size={15} />{workspace.repoFullName ?? 'Not linked yet'}
          </p>
        )}
      </Card>

      {/* ── Your role ── */}
      <Card style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, marginBottom: 4 }}>What you work on</h2>
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
          Agreed between you, not assigned. Workmark uses it to put each task on the right
          person when it drafts a plan — and anyone can move a task afterwards.
        </p>
        <select
          className="dk-input"
          // Working alone with nothing chosen reads as Everything, because
          // that is what it means: every task comes to you.
          value={you?.workRole ?? (workspace.members.length === 1 ? 'fullstack' : '')}
          onChange={(e) => setWorkRole(e.target.value)}
          disabled={busy === 'role'}
          aria-label="What you work on"
          style={{ maxWidth: 260 }}
        >
          {workspace.members.length > 1 && <option value="">Not set</option>}
          {WORK_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </Card>

      {/* ── Team ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text }}>Team</h2>
          <span style={{ fontSize: T.meta, color: C.textFaint }}>{teamSize} of {MAX_WORKSPACE_MEMBERS}</span>
        </div>
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
          Everyone needs GitHub connected before they can join — otherwise their work
          can&apos;t be counted as theirs.
        </p>

        <div style={{ display: 'grid', gap: 1, marginBottom: workspace.invited.length || isOwner ? 16 : 0 }}>
          {workspace.members.map((m) => (
            <div key={m.accountId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.borderFaint}` }}>
              <div>
                <p style={{ fontSize: T.body, color: C.text }}>
                  {displayName(m)}{m.isYou ? ' (you)' : ''}
                </p>
                <p style={{ fontSize: T.meta, color: C.textFaint }}>
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                  {m.workRole ? ` · ${ROLE_LABEL[m.workRole]}` : ''}
                </p>
              </div>
              {m.isYou ? (
                <Button variant="quiet" size="sm" onClick={leave} disabled={busy === 'leave'}>
                  Leave
                </Button>
              ) : !isClosed && !workspace.removals.some((r) => r.targetAccountId === m.accountId) ? (
                // Offered to every member, not just the owner. Removal is a
                // vote precisely because it is not the owner's to decide,
                // and an owner who is the problem is the case that matters.
                <Button variant="quiet" size="sm" onClick={() => { setRemoving(m); setRemoveReason('') }}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {workspace.invited.map((m) => (
            <div key={m.accountId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.borderFaint}` }}>
              <div>
                <p style={{ fontSize: T.body, color: C.textMuted }}>{displayName(m)}</p>
                <p style={{ fontSize: T.meta, color: C.textGhost }}>Invited — hasn&apos;t answered yet</p>
              </div>
            </div>
          ))}
        </div>

        {isOwner && teamSize < MAX_WORKSPACE_MEMBERS && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="dk-input"
              value={invitee}
              onChange={(e) => setInvitee(e.target.value)}
              placeholder="@handle or name@university.edu"
              aria-label="Invite by handle or email"
              maxLength={254}
              style={{ flex: '1 1 240px', maxWidth: 360 }}
            />
            <Button onClick={invite} disabled={!invitee.trim()} busyLabel={busy === 'invite' ? 'Inviting…' : null}>
              Invite
            </Button>
          </div>
        )}

        {/* An open vote, shown to everyone including the person it is about.
            Being removed takes work off your record, and finding that out
            afterwards from a board you can no longer open is the version of
            this that would be indefensible. */}
        {workspace.removals.map((r) => (
          <div
            key={r.id}
            style={{
              marginTop: 14, padding: '12px 14px', borderRadius: R.md,
              border: `1px solid ${C.border}`, background: C.bgAlt,
            }}
          >
            <p style={{ fontSize: T.bodySm, color: C.text, fontWeight: 600, marginBottom: 4 }}>
              {r.isYou
                ? 'The team has been asked to remove you'
                : `Remove ${r.targetName ?? 'a teammate'}?`}
            </p>
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
              {r.reason}
            </p>
            <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: r.isYou ? 0 : 10 }}>
              {r.approvals} of {r.needed} needed
              {r.requestedByName ? ` · asked by ${r.requestedByName}` : ''}
            </p>
            {!r.isYou && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.youApproved ? (
                  <span style={{ fontSize: T.meta, color: C.textFaint, alignSelf: 'center' }}>
                    You agreed.
                  </span>
                ) : (
                  <Button size="sm" disabled={busy === `approve-${r.id}`} onClick={() => approveRemoval(r.id)}>
                    Agree
                  </Button>
                )}
                {r.requestedBy === userId && (
                  <Button variant="quiet" size="sm" disabled={busy === `withdraw-${r.id}`} onClick={() => withdrawRemoval(r.id)}>
                    Withdraw
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Said plainly rather than discovered when a button refuses to
            work. Between peers, removal is not one person's decision. */}
        {isOwner && workspace.members.length > 1 && (
          <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.6, marginTop: 14, borderTop: `1px solid ${C.borderFaint}`, paddingTop: 12 }}>
            Anyone can leave whenever they want. Someone who has already contributed work can
            only be removed if most of the team agrees.
          </p>
        )}
      </Card>

      {/* Finishing the project, last, where nobody reaches it by accident.
          Quiet styling on purpose — this is not the action the page is
          encouraging, it is the one available when the work is done. */}
      {isOwner && !isDraft && !isClosed && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borderFaint}` }}>
          <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 4 }}>
            Finished with this project?
          </p>
          <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.6, marginBottom: 11, maxWidth: '60ch' }}>
            Closing writes everyone&apos;s verified work to their record. The board stops
            accepting new work, so finish anything outstanding first.
          </p>
          <Button variant="outline" onClick={() => setClosing(true)} disabled={busy === 'close'}>
            Close this project
          </Button>
        </div>
      )}

      {/* What it does, before it is done, in the words somebody would use. */}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing ? displayName(removing) : ''}?`}
      >
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
          If they have already contributed work, this goes to the rest of the team and needs
          most of them to agree. If they have not, they are removed straight away.
          They are shown the reason either way.
        </p>
        <label htmlFor="removal-reason" style={{ display: 'block', fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
          Why?
        </label>
        <textarea
          id="removal-reason"
          className="dk-input"
          value={removeReason}
          onChange={(e) => setRemoveReason(e.target.value)}
          placeholder="Hasn't responded in three weeks and their tasks are blocking the rest of us."
          rows={3}
          minLength={10}
          maxLength={2000}
          style={{ marginBottom: 6, resize: 'vertical' }}
        />
        <p style={{ fontSize: T.meta, color: C.textGhost, marginBottom: 18 }}>
          At least 10 characters. The person is shown this.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="quiet" onClick={() => setRemoving(null)}>Cancel</Button>
          <Button
            onClick={openRemoval}
            disabled={removeReason.trim().length < 10}
            busyLabel={busy === 'removal' ? 'Asking…' : null}
          >
            Ask the team
          </Button>
        </div>
      </Modal>

      {/* The count is in the dialog rather than only on the button because
          "6 tasks" is the fact that tells an owner whether they are closing
          too early. */}
      <Modal open={closing} onClose={() => setClosing(false)} title="Close this project?">
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.65, marginBottom: 14 }}>
          {finishedCount === 0
            ? 'Nothing here has been verified yet, so there is nothing to put on anybody’s record. Submit your finished work and run a check first.'
            : `${finishedCount} ${finishedCount === 1 ? 'task has' : 'tasks have'} been verified. Closing reads the repository once for each person and writes what they demonstrated to their record.`}
        </p>
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.65, marginBottom: 18 }}>
          This cannot be undone from here, and the board stops accepting new work.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="quiet" onClick={() => setClosing(false)}>Not yet</Button>
          <Button
            onClick={closeProject}
            disabled={finishedCount === 0}
            busyLabel={busy === 'close' ? 'Closing…' : null}
          >
            Close the project
          </Button>
        </div>
      </Modal>
    </>
  )
}
