'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { C, T } from '@/lib/theme/dark-tokens'
import { ROLE_LABEL } from '@/lib/workspace/labels'
import type { WorkspaceDetail } from '@/lib/workspace/queries'

/**
 * What a project looks like before it has started.
 *
 * The board route rather than the settings one, because this is the screen
 * somebody lands on and it has to say what is left to do. The three steps
 * themselves live on Settings — the checklist points at them instead of
 * duplicating the repo picker, the role select and the invite box here, which
 * is how the old single page ended up rendering all of them at once.
 */
export default function DraftSetup({ workspace }: { workspace: WorkspaceDetail }) {
  const router = useRouter()
  const { toast } = useToast()
  const [starting, setStarting] = useState(false)

  const isOwner = workspace.yourRole === 'owner'
  const you = workspace.members.find((m) => m.isYou)

  async function start() {
    setStarting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      toast('Project started.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setStarting(false)
    }
  }

  const settings = `/workspaces/${workspace.id}/settings`

  return (
    <Card focal>
      <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text, marginBottom: 5 }}>Finish setting up</p>
      <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 16, maxWidth: '60ch' }}>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        <Button href={settings} variant={workspace.repoFullName ? 'outline' : 'ink'}>
          {workspace.repoFullName ? 'Settings' : 'Link a repository'}
        </Button>
        {isOwner && (
          <Button
            variant="accent"
            onClick={start}
            disabled={!workspace.repoFullName}
            busyLabel={starting ? 'Starting…' : null}
            // The reason, on the control. A disabled button with no
            // explanation is the most annoying thing an interface can do.
            title={workspace.repoFullName ? undefined : 'Link a repository first — it is what the work is read from.'}
          >
            Start the project
          </Button>
        )}
      </div>

      {/* Said here rather than discovered by a member wondering why there is
          no button. */}
      {!isOwner && (
        <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.6, marginTop: 12 }}>
          Whoever set this up starts it. You can link the repository and set your role in the
          meantime.
        </p>
      )}
    </Card>
  )
}
