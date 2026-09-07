'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/Toast'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { WORK_ROLES, type WorkRole } from '@/lib/workspace/membership'
import {
  BOARD_COLUMNS, COLUMN_LABEL, COLUMN_HINT, canMoveTo, byBoardOrder,
  type TaskStatus,
} from '@/lib/workspace/tasks'
import type { BoardTask, TeamMember } from '@/lib/workspace/queries'

const ROLE_LABEL: Record<WorkRole, string> = {
  backend: 'Backend', frontend: 'Frontend', fullstack: 'Full-stack', mobile: 'Mobile',
  data: 'Data', ml: 'ML / AI', infra: 'Infra', design: 'Design', other: 'Other',
}

interface Draft {
  title: string
  detail: string
  acceptanceCriteria: string
  assigneeId: string
  suggestedRole: string
  estimateHours: string
  difficulty: string
  dueOn: string
  priority: string
  verifiable: boolean
}

const EMPTY: Draft = {
  title: '', detail: '', acceptanceCriteria: '', assigneeId: '', suggestedRole: '',
  estimateHours: '', difficulty: '', dueOn: '', priority: 'normal', verifiable: true,
}

export default function Board({
  workspaceId,
  tasks,
  members,
}: {
  workspaceId: string
  tasks: BoardTask[]
  members: TeamMember[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<BoardTask | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [reason, setReason] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [blocking, setBlocking] = useState<BoardTask | null>(null)
  const [blockReason, setBlockReason] = useState('')

  const nameOf = (id: string | null) =>
    id ? members.find((m) => m.accountId === id)?.name ?? 'Someone' : null

  async function send(url: string, init: RequestInit, okMessage?: string) {
    setBusy(true)
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
      setBusy(false)
    }
  }

  function draftBody(d: Draft) {
    return {
      title: d.title,
      detail: d.detail,
      acceptanceCriteria: d.acceptanceCriteria,
      assigneeId: d.assigneeId || null,
      suggestedRole: d.suggestedRole || null,
      estimateHours: d.estimateHours,
      difficulty: d.difficulty,
      dueOn: d.dueOn,
      priority: d.priority,
      verifiable: d.verifiable,
    }
  }

  async function createTask() {
    const ok = await send(`/api/workspaces/${workspaceId}/tasks`,
      { method: 'POST', body: JSON.stringify(draftBody(draft)) }, 'Task added.')
    if (ok) { setCreating(false); setDraft(EMPTY) }
  }

  async function saveTask() {
    if (!editing) return
    const ok = await send(`/api/workspaces/${workspaceId}/tasks/${editing.id}`,
      { method: 'PATCH', body: JSON.stringify({ ...draftBody(draft), reason: reason || null }) }, 'Saved.')
    if (ok) { setEditing(null); setReason('') }
  }

  const move = (task: BoardTask, to: TaskStatus) =>
    send(`/api/workspaces/${workspaceId}/tasks/${task.id}`,
      { method: 'PATCH', body: JSON.stringify({ status: to }) })

  async function toggleBlocked(task: BoardTask) {
    if (task.blockedAt) {
      await send(`/api/workspaces/${workspaceId}/tasks/${task.id}`,
        { method: 'PATCH', body: JSON.stringify({ blocked: false }) }, 'Unblocked.')
    } else {
      setBlocking(task)
      setBlockReason('')
    }
  }

  async function confirmBlock() {
    if (!blocking) return
    const ok = await send(`/api/workspaces/${workspaceId}/tasks/${blocking.id}`,
      { method: 'PATCH', body: JSON.stringify({ blocked: true, blockedReason: blockReason }) },
      'Flagged as blocked.')
    if (ok) setBlocking(null)
  }

  function openEdit(task: BoardTask) {
    setEditing(task)
    setReason('')
    setDraft({
      title: task.title,
      detail: task.detail ?? '',
      acceptanceCriteria: task.acceptanceCriteria ?? '',
      assigneeId: task.assigneeId ?? '',
      suggestedRole: task.suggestedRole ?? '',
      estimateHours: task.estimateHours === null ? '' : String(task.estimateHours),
      difficulty: task.difficulty === null ? '' : String(task.difficulty),
      dueOn: task.dueOn ?? '',
      priority: task.priority,
      verifiable: task.verifiable,
    })
  }

  // Changing an estimate or a deadline is the one edit worth a sentence.
  // Prompting on every field would train people to ignore the box.
  const estimateChanged = editing && draft.estimateHours !== (editing.estimateHours === null ? '' : String(editing.estimateHours))
  const deadlineChanged = editing && draft.dueOn !== (editing.dueOn ?? '')

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text }}>Board</h2>
        <Button size="sm" onClick={() => { setDraft(EMPTY); setCreating(true) }}>Add task</Button>
      </div>

      <div className="nb-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {BOARD_COLUMNS.map((column) => {
          const inColumn = tasks.filter((t) => t.status === column).sort(byBoardOrder)
          const refusal = dragging
            ? canMoveTo(tasks.find((t) => t.id === dragging)!.status, column)
            : null

          return (
            <div
              key={column}
              onDragOver={(e) => { if (!refusal) e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                const task = tasks.find((t) => t.id === dragging)
                setDragging(null)
                if (!task || task.status === column) return
                const stop = canMoveTo(task.status, column)
                if (stop) { toast(stop, 'error'); return }
                move(task, column)
              }}
              style={{
                flex: '0 0 236px', background: C.surfaceAlt, borderRadius: R.lg, padding: 11,
                border: `1px solid ${dragging && !refusal ? C.accentBorder : 'transparent'}`,
                opacity: dragging && refusal ? 0.45 : 1,
                transition: 'opacity 120ms ease, border-color 120ms ease',
              }}
            >
              <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 2 }}>
                {COLUMN_LABEL[column]}{' '}
                <span style={{ fontWeight: 400, color: C.textGhost }}>{inColumn.length}</span>
              </p>
              <p style={{ fontSize: T.meta, color: C.textGhost, marginBottom: 10, lineHeight: 1.45 }}>
                {COLUMN_HINT[column]}
              </p>

              <div style={{ display: 'grid', gap: 8 }}>
                {inColumn.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => setDragging(null)}
                    style={{
                      background: C.surface, border: `1px solid ${task.blockedAt ? '#E4B9A6' : C.border}`,
                      borderRadius: R.md, padding: 11, cursor: 'grab',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(task)}
                      style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                    >
                      <p style={{ fontSize: T.bodySm, fontWeight: 500, color: C.text, lineHeight: 1.45, marginBottom: 6 }}>
                        {task.title}
                      </p>
                    </button>

                    {task.blockedAt && (
                      <p style={{ fontSize: T.meta, color: '#94500F', lineHeight: 1.45, marginBottom: 6 }}>
                        Blocked — {task.blockedReason}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: T.meta, color: C.textGhost }}>
                      {task.assigneeId && <span>{nameOf(task.assigneeId)}</span>}
                      {task.suggestedRole && <span>{ROLE_LABEL[task.suggestedRole]}</span>}
                      {task.estimateHours !== null && <span>{task.estimateHours}h</span>}
                      {task.difficulty !== null && <span>d{task.difficulty}</span>}
                      {task.dueOn && <span>due {task.dueOn}</span>}
                      {!task.verifiable && <span>no code</span>}
                    </div>

                    {/* Drag is not reachable by keyboard or on a phone, so the
                        same moves exist as a plain control. */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 9, alignItems: 'center' }}>
                      <select
                        value={task.status}
                        onChange={(e) => {
                          const to = e.target.value as TaskStatus
                          const stop = canMoveTo(task.status, to)
                          if (stop) { toast(stop, 'error'); return }
                          move(task, to)
                        }}
                        disabled={busy}
                        aria-label={`Move ${task.title}`}
                        style={{
                          fontSize: T.meta, padding: '3px 5px', borderRadius: R.sm,
                          border: `1px solid ${C.border}`, background: C.bg, color: C.textMuted, flex: 1,
                        }}
                      >
                        {BOARD_COLUMNS.map((c) => (
                          <option key={c} value={c} disabled={!!canMoveTo(task.status, c) && c !== task.status}>
                            {COLUMN_LABEL[c]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleBlocked(task)}
                        disabled={busy}
                        title={task.blockedAt ? 'Unblock' : 'Flag blocked'}
                        style={{
                          fontSize: T.meta, padding: '3px 7px', borderRadius: R.sm, cursor: 'pointer',
                          border: `1px solid ${C.border}`, background: C.bg,
                          color: task.blockedAt ? '#94500F' : C.textGhost,
                        }}
                      >
                        {task.blockedAt ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </article>
                ))}

                {inColumn.length === 0 && (
                  <p style={{ fontSize: T.meta, color: C.textGhost, padding: '10px 2px' }}>Nothing here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <TaskDialog
        open={creating}
        title="Add a task"
        draft={draft}
        setDraft={setDraft}
        members={members}
        busy={busy}
        onClose={() => setCreating(false)}
        onSave={createTask}
        saveLabel="Add task"
      />

      <TaskDialog
        open={editing !== null}
        title="Edit task"
        draft={draft}
        setDraft={setDraft}
        members={members}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={saveTask}
        saveLabel="Save"
        reason={reason}
        setReason={setReason}
        askReason={!!(estimateChanged || deadlineChanged)}
      />

      <Modal open={blocking !== null} onClose={() => setBlocking(null)} title="What is blocking this?">
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
          Saying so early counts for more than quietly missing the date. Waiting on a teammate,
          an unclear requirement, an external service — whatever it is.
        </p>
        <textarea
          className="dk-input"
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="The events API only allows 100 requests an hour and I need more."
          style={{ marginBottom: 18, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="quiet" onClick={() => setBlocking(null)}>Cancel</Button>
          <Button onClick={confirmBlock} disabled={busy || blockReason.trim().length < 3}>Flag blocked</Button>
        </div>
      </Modal>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: 'block', fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 5 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: C.textGhost }}> — {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function TaskDialog({
  open, title, draft, setDraft, members, busy, onClose, onSave, saveLabel,
  reason, setReason, askReason,
}: {
  open: boolean
  title: string
  draft: Draft
  setDraft: (d: Draft) => void
  members: TeamMember[]
  busy: boolean
  onClose: () => void
  onSave: () => void
  saveLabel: string
  reason?: string
  setReason?: (r: string) => void
  askReason?: boolean
}) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value })

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <Field label="What needs doing">
        <input className="dk-input" value={draft.title} maxLength={200}
          onChange={(e) => set('title', e.target.value)} placeholder="Implement Google sign-in" />
      </Field>

      <Field label="Done means" hint="what the check will look for">
        <textarea className="dk-input" value={draft.acceptanceCriteria} rows={2} maxLength={4000}
          onChange={(e) => set('acceptanceCriteria', e.target.value)}
          placeholder="A user can sign in with Google and stays signed in after a refresh. Tests cover the callback."
          style={{ resize: 'vertical' }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Estimate" hint="hours">
          <input className="dk-input" type="number" min={0.25} max={200} step={0.25}
            value={draft.estimateHours} onChange={(e) => set('estimateHours', e.target.value)} placeholder="4" />
        </Field>
        <Field label="How hard" hint="1–10">
          <input className="dk-input" type="number" min={1} max={10} step={1}
            value={draft.difficulty} onChange={(e) => set('difficulty', e.target.value)} placeholder="6" />
        </Field>
        <Field label="Due">
          <input className="dk-input" type="date" value={draft.dueOn} onChange={(e) => set('dueOn', e.target.value)} />
        </Field>
        <Field label="Priority">
          <select className="dk-input" value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Who">
          <select className="dk-input" value={draft.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            <option value="">Nobody yet</option>
            {members.map((m) => (
              <option key={m.accountId} value={m.accountId}>{m.name ?? m.handle ?? 'Teammate'}</option>
            ))}
          </select>
        </Field>
        <Field label="Kind of work">
          <select className="dk-input" value={draft.suggestedRole} onChange={(e) => set('suggestedRole', e.target.value)}>
            <option value="">Any</option>
            {WORK_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
      </div>

      {/* Without this, the checker looks for commits on a task that was never
          going to have any and fails honest work for having no code. */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.bodySm, color: C.textMuted, marginBottom: 14 }}>
        <input type="checkbox" checked={!draft.verifiable}
          onChange={(e) => set('verifiable', !e.target.checked)} />
        This one has no code — research, design, talking to someone
      </label>

      {askReason && setReason && (
        <Field label="Why did this change?" hint="optional, and worth more than you would think">
          <input className="dk-input" value={reason ?? ''} maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The API turned out to be rate limited, so this needs a cache first." />
        </Field>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Button variant="quiet" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={busy || draft.title.trim().length < 2}>{saveLabel}</Button>
      </div>
    </Modal>
  )
}
