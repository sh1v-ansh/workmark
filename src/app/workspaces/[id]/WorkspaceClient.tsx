'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C, F, R, T } from '@/lib/theme/dark-tokens'
import { WORK_ROLES, MAX_WORKSPACE_MEMBERS, type WorkRole } from '@/lib/workspace/membership'
import Board from './Board'
import type { WorkspaceDetail, TeamMember, BoardTask, TaskVerdict } from '@/lib/workspace/queries'

const ROLE_LABEL: Record<WorkRole, string> = {
  backend: 'Backend', frontend: 'Frontend', fullstack: 'Full-stack', mobile: 'Mobile',
  data: 'Data', ml: 'ML / AI', infra: 'Infrastructure', design: 'Design', other: 'Other',
}

function displayName(m: TeamMember): string {
  return m.name ?? (m.handle ? `@${m.handle}` : 'A teammate')
}

export default function WorkspaceClient({
  workspace,
  tasks,
  verdicts,
  userId,
  repoOptions,
}: {
  workspace: WorkspaceDetail
  tasks: BoardTask[]
  verdicts: TaskVerdict[]
  userId: string
  repoOptions: { fullName: string; isPrivate: boolean }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [invitee, setInvitee] = useState('')
  const [repo, setRepo] = useState(workspace.repoFullName ?? '')

  const isOwner = workspace.yourRole === 'owner'
  const isDraft = workspace.status === 'draft'
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

  const start = () => call('start', `/api/workspaces/${workspace.id}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }, 'Project started.')

  const leave = () => call('leave', `/api/workspaces/${workspace.id}/members/${userId}`,
    { method: 'DELETE', body: JSON.stringify({}) }, 'You left the project.')

  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px 72px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/workspaces" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.meta, color: C.textFaint, textDecoration: 'none', marginBottom: 18 }}>
          ← All projects
        </Link>

        <header style={{ marginBottom: 26 }}>
          <h1 style={{ fontFamily: F.display, fontSize: T.display, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 8 }}>
            {workspace.title}
          </h1>
          {workspace.summary && (
            <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.65, maxWidth: '62ch' }}>{workspace.summary}</p>
          )}
        </header>

        {/* The board is the page once work has started. Setup and settings
            move below it — they are read once and the board is read daily. */}
        {!isDraft && (
          <div style={{ marginBottom: 26 }}>
            <Board workspaceId={workspace.id} tasks={tasks} verdicts={verdicts} members={workspace.members} />
          </div>
        )}

        {/* Setup, and only while it is needed. Once the project has started
            this whole block disappears rather than sitting there ticked. */}
        {isDraft && (
          <Card focal style={{ marginBottom: 18 }}>
            <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text, marginBottom: 5 }}>Finish setting up</p>
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
              A project needs a repository before it can start — that is what Workmark reads to
              turn the work into evidence. Add anyone building it with you now or later.
            </p>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: T.bodySm, color: C.textSub, lineHeight: 1.9 }}>
              <li style={{ color: workspace.repoFullName ? C.textFaint : C.textSub }}>
                {workspace.repoFullName ? `Repository linked — ${workspace.repoFullName}` : 'Link the GitHub repository'}
              </li>
              <li style={{ color: you?.workRole ? C.textFaint : C.textSub }}>
                {you?.workRole ? `Your role — ${ROLE_LABEL[you.workRole]}` : 'Say what you work on'}
              </li>
              <li style={{ color: C.textFaint }}>Invite anyone working with you (optional)</li>
            </ol>
            {isOwner && (
              <div style={{ marginTop: 18 }}>
                <Button onClick={start} disabled={!workspace.repoFullName || busy === 'start'}>
                  {busy === 'start' ? 'Starting…' : 'Start the project'}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* ── Repository ── */}
        <Card style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, marginBottom: 4 }}>Repository</h2>
          <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
            One repository per project. Everyone&apos;s commits are read through it and matched back
            to whoever wrote them, so each person gets credit for their own work.
          </p>

          {repoOptions.length === 0 ? (
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6 }}>
              Workmark can&apos;t see any of your repositories yet.{' '}
              <Link href="/student/github" style={{ color: C.accent }}>Connect GitHub</Link> first.
            </p>
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
              <Button onClick={linkRepo} disabled={!repo || repo === workspace.repoFullName || busy === 'repo'}>
                {busy === 'repo' ? 'Linking…' : workspace.repoFullName ? 'Change' : 'Link'}
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
            value={you?.workRole ?? ''}
            onChange={(e) => setWorkRole(e.target.value)}
            disabled={busy === 'role'}
            aria-label="What you work on"
            style={{ maxWidth: 260 }}
          >
            <option value="">Not set</option>
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
                {m.isYou && (
                  <Button variant="quiet" size="sm" onClick={leave} disabled={busy === 'leave'}>
                    Leave
                  </Button>
                )}
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
              <Button onClick={invite} disabled={!invitee.trim() || busy === 'invite'}>
                {busy === 'invite' ? 'Inviting…' : 'Invite'}
              </Button>
            </div>
          )}

          {/* Said plainly rather than discovered when a button refuses to
              work. Between peers, removal is not one person's decision. */}
          {isOwner && workspace.members.length > 1 && (
            <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.6, marginTop: 14, borderTop: `1px solid ${C.borderFaint}`, paddingTop: 12 }}>
              Anyone can leave whenever they want. Someone who has already contributed work can
              only be removed if most of the team agrees.
            </p>
          )}
        </Card>
      </div>
    </main>
  )
}
