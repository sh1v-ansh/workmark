'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import Modal from '@/components/ui/Modal'
import { C, F, R, T } from '@/lib/theme/dark-tokens'
import type { WorkspaceSummary, PendingInvitation, WorkspaceStatus } from '@/lib/workspace/queries'

const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  draft: 'Being set up',
  active: 'In progress',
  submitted: 'Submitted',
  closed: 'Finished',
  abandoned: 'Abandoned',
}

export default function WorkspacesClient({
  workspaces,
  invitations,
  githubConnected,
  userId,
}: {
  workspaces: WorkspaceSummary[]
  invitations: PendingInvitation[]
  githubConnected: boolean
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [answering, setAnswering] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not create that project.')
      router.push(`/workspaces/${data.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
      setBusy(false)
    }
  }

  async function answer(workspaceId: string, action: 'accept' | 'decline') {
    setAnswering(workspaceId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not do that.')
      toast(action === 'accept' ? 'You are on the project.' : 'Invitation declined.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setAnswering(null)
    }
  }

  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px 72px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: T.display, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 6 }}>
              Projects
            </h1>
            <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.6, maxWidth: '58ch' }}>
              Work you are doing, on your own or with other students. Each one has a board,
              a repository, and a record of what you planned against what happened.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>New project</Button>
        </header>

        {/* Invitations first. Somebody who has been asked to join a project
            needs to answer before anything else on this page matters. */}
        {invitations.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              {invitations.length === 1 ? 'You have an invitation' : `You have ${invitations.length} invitations`}
            </h2>
            {!githubConnected && (
              <p style={{ fontSize: T.bodySm, color: C.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
                Connect GitHub before joining — without it your commits can&apos;t be counted as yours.{' '}
                <Link href="/student/github" style={{ color: C.accent }}>Connect GitHub</Link>
              </p>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              {invitations.map((invite) => (
                <Card key={invite.workspaceId} focal>
                  <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text, marginBottom: 4 }}>{invite.title}</p>
                  <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
                    {invite.invitedByName ? `${invite.invitedByName} invited you.` : 'You were invited.'}
                    {invite.summary ? ` ${invite.summary}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      size="sm"
                      disabled={answering === invite.workspaceId || !githubConnected}
                      onClick={() => answer(invite.workspaceId, 'accept')}
                    >
                      Join the project
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      disabled={answering === invite.workspaceId}
                      onClick={() => answer(invite.workspaceId, 'decline')}
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {workspaces.length === 0 ? (
          <Card>
            <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.6 }}>
              No projects yet. Start one with your own idea, or from a project idea on{' '}
              <Link href="/me/briefs" style={{ color: C.accent }}>your briefs page</Link>.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {workspaces.map((w) => (
              <Card key={w.id} href={`/workspaces/${w.id}`} hoverable>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
                  <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>{w.title}</p>
                  <span style={{ fontSize: T.meta, color: w.status === 'draft' ? C.textFaint : C.textMuted, whiteSpace: 'nowrap' }}>
                    {STATUS_LABEL[w.status]}
                  </span>
                </div>
                {w.summary && (
                  <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>{w.summary}</p>
                )}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: T.meta, color: C.textFaint }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="users" size={13} />
                    {w.memberCount === 1 ? 'On your own' : `${w.memberCount} people`}
                  </span>
                  {w.repoFullName && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="github" size={13} />{w.repoFullName}
                    </span>
                  )}
                  {w.deadline && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="calendar" size={13} />Due {w.deadline}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New project">
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
          Name it and say what it is. You&apos;ll add the repository and anyone working with you next —
          the project starts once a repository is attached.
        </p>
        <label htmlFor="ws-title" style={{ display: 'block', fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
          Project name
        </label>
        <input
          id="ws-title"
          className="dk-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Campus event discovery app"
          maxLength={120}
          style={{ marginBottom: 14 }}
        />
        <label htmlFor="ws-summary" style={{ display: 'block', fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
          What is it? <span style={{ fontWeight: 400, color: C.textGhost }}>Optional</span>
        </label>
        <textarea
          id="ws-summary"
          className="dk-input"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A place students can find events happening on campus this week."
          rows={3}
          maxLength={2000}
          style={{ marginBottom: 20, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="quiet" onClick={() => setCreating(false)}>Cancel</Button>
          <Button onClick={create} disabled={busy || title.trim().length < 3}>
            {busy ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </Modal>
    </main>
  )
}
