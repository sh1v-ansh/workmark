'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import {
  canReview, outcomeFor, HUMAN_VERDICTS, HUMAN_VERDICT_LABEL, HUMAN_VERDICT_HINT,
  type HumanVerdict, type ReviewableTask,
} from '@/lib/workspace/review'
import type { MemberRow } from '@/lib/workspace/membership'
import type {
  BoardTask, TeamMember, TaskVerdict, TaskDependency, TaskDecision,
} from '@/lib/workspace/queries'

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

const VERDICT_TONE: Record<string, { colour: string; label: string }> = {
  verified: { colour: '#14663D', label: 'Verified' },
  needs_work: { colour: '#94500F', label: 'Needs work' },
  unverifiable: { colour: '#5A6172', label: 'Needs a person' },
  human_verified: { colour: '#14663D', label: 'Confirmed by a teammate' },
  pending: { colour: '#5A6172', label: 'Waiting to be checked' },
}

export default function Board({
  workspaceId,
  tasks,
  verdicts,
  members,
  dependencies,
  decisions,
  userId,
  readOnly = false,
}: {
  workspaceId: string
  tasks: BoardTask[]
  verdicts: TaskVerdict[]
  members: TeamMember[]
  dependencies: TaskDependency[]
  decisions: TaskDecision[]
  userId: string
  /** A closed project. The board becomes the record of what happened. */
  readOnly?: boolean
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
  const [planning, setPlanning] = useState(false)
  const [checking, setChecking] = useState(false)
  const [reviewing, setReviewing] = useState<BoardTask | null>(null)
  const [reviewVerdict, setReviewVerdict] = useState<HumanVerdict | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const verdictFor = new Map(verdicts.map((v) => [v.taskId, v]))
  const submittedCount = tasks.filter((t) => t.status === 'submitted').length

  // workspace.members is already only the people actually on the team, so
  // every row here is active by construction. Shaped into MemberRow so the
  // board and the API answer "may I review this" with the same function
  // rather than two implementations that drift.
  const memberRows: MemberRow[] = members.map((m) => ({
    account_id: m.accountId,
    role: m.role,
    work_role: m.workRole,
    accepted_at: m.acceptedAt,
    removed_at: null,
  }))

  const reviewableOf = (task: BoardTask): ReviewableTask => {
    const v = verdictFor.get(task.id)
    return {
      id: task.id,
      status: task.status,
      assigneeId: task.assigneeId,
      latestVerdict: v?.verdict ?? null,
      humanVerdict: v?.humanVerdict ?? null,
    }
  }

  const mayReview = (task: BoardTask) =>
    !readOnly && canReview(memberRows, userId, reviewableOf(task)) === null

  // Work somebody else is blocked on. Surfaced at the top rather than left to
  // be found among six columns: a queue nobody can see is a queue nobody
  // clears, and every card in it is a student waiting.
  const needsYou = tasks.filter(mayReview)

  // What a card is still waiting on, shown rather than enforced. Only
  // unfinished blockers count: a dependency that is done is history, and
  // listing it would leave a warning on the card forever.
  const decisionsFor = new Map<string, TaskDecision[]>()
  for (const d of decisions) {
    decisionsFor.set(d.taskId, [...(decisionsFor.get(d.taskId) ?? []), d])
  }

  const titleOf = new Map(tasks.map((t) => [t.id, t.title]))
  const doneIds = new Set(
    tasks.filter((t) => t.status === 'verified' || t.status === 'accepted').map((t) => t.id),
  )
  const blockersFor = new Map<string, string[]>()
  for (const edge of dependencies) {
    if (doneIds.has(edge.dependsOnId)) continue
    const title = titleOf.get(edge.dependsOnId)
    if (!title) continue
    blockersFor.set(edge.taskId, [...(blockersFor.get(edge.taskId) ?? []), title])
  }

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

  function openReview(task: BoardTask) {
    setReviewing(task)
    setReviewVerdict(null)
    setReviewNote('')
  }

  /**
   * Record one person's answer.
   *
   * The note and the choice are deliberately not cleared on failure — a
   * reviewer who typed three sentences and hit a network error should find
   * them still there.
   */
  async function submitReview() {
    if (!reviewing || !reviewVerdict) return
    const ok = await send(
      `/api/workspaces/${workspaceId}/tasks/${reviewing.id}/review`,
      { method: 'POST', body: JSON.stringify({ verdict: reviewVerdict, note: reviewNote || null }) },
      outcomeFor(reviewVerdict).message,
    )
    if (ok) setReviewing(null)
  }

  async function draftPlan() {
    setPlanning(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/plan`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not draft a plan.')
      toast(`${data.count} tasks drafted — edit or delete whatever does not fit.`, 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setPlanning(false)
    }
  }

  async function checkWork() {
    setChecking(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/verify`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not run the check.')
      toast(
        data.queued
          ? data.message
          : `${data.verified} verified, ${data.needsWork} needing work, ${data.toAPerson} for a teammate.`,
        'success',
      )
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setChecking(false)
    }
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
        <div style={{ display: 'flex', gap: 8 }}>
          {readOnly && (
            <span style={{ fontSize: T.meta, color: C.textGhost, alignSelf: 'center' }}>
              Finished — this is the record now
            </span>
          )}
          {!readOnly && submittedCount > 0 && (
            <Button size="sm" onClick={checkWork} disabled={checking}>
              {checking ? 'Checking…' : `Check my work (${submittedCount})`}
            </Button>
          )}
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={draftPlan} disabled={planning}>
              {planning ? 'Drafting…' : tasks.length === 0 ? 'Draft a plan' : 'Suggest more tasks'}
            </Button>
          )}
          {!readOnly && (
            <Button size="sm" onClick={() => { setDraft(EMPTY); setCreating(true) }}>Add task</Button>
          )}
        </div>
      </div>

      {/* Work other people are blocked on, put where somebody will see it.
          The checker sends two kinds of task here — work with no code to
          look at, and work it has already failed twice — and both stop dead
          until a person answers. */}
      {needsYou.length > 0 && (
        <div style={{
          background: C.surfaceAlt, border: `1px solid ${C.accentBorder}`, borderRadius: R.lg,
          padding: '13px 15px', marginBottom: 16,
        }}>
          <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text, marginBottom: 3 }}>
            {needsYou.length === 1
              ? 'One task needs you to look at it'
              : `${needsYou.length} tasks need you to look at them`}
          </p>
          <p style={{ fontSize: T.meta, color: C.textMuted, lineHeight: 1.5, marginBottom: 11, maxWidth: '64ch' }}>
            Workmark could not check these on its own. A teammate has to say whether the work
            does what the task asked — until somebody does, they are stuck.
          </p>
          <div style={{ display: 'grid', gap: 7 }}>
            {needsYou.map((task) => (
              <div
                key={task.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: R.md, padding: '9px 11px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: T.bodySm, color: C.text, lineHeight: 1.45 }}>{task.title}</p>
                  <p style={{ fontSize: T.meta, color: C.textGhost, marginTop: 2 }}>
                    {nameOf(task.assigneeId) ?? 'Unassigned'}
                    {!task.verifiable && ' · marked as having no code'}
                  </p>
                </div>
                <Button size="sm" onClick={() => openReview(task)} disabled={busy}>Review</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Said once, above the board, rather than on every card. The point is
          that the plan is theirs from the moment it lands — what they keep,
          reshape and throw out is the thing worth measuring. */}
      {tasks.length === 0 && (
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14, maxWidth: '62ch' }}>
          Workmark can draft a first plan from what this project is. It will get some of it wrong —
          edit it, reorder it, throw tasks out and add your own. The plan is yours once it lands.
        </p>
      )}

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
                    draggable={!readOnly}
                    onDragStart={() => { if (!readOnly) setDragging(task.id) }}
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
                      {task.origin === 'ai_proposed' && (
                        <p style={{ fontSize: T.meta, color: C.textGhost, marginBottom: 6 }}>
                          Suggested — edit it or throw it out
                        </p>
                      )}
                    </button>

                    {(() => {
                      const v = verdictFor.get(task.id)
                      if (!v || v.verdict === 'pending') return null
                      const tone = VERDICT_TONE[v.verdict] ?? VERDICT_TONE.pending
                      return (
                        <div style={{ marginBottom: 7 }}>
                          <p style={{ fontSize: T.meta, fontWeight: 600, color: tone.colour, marginBottom: 2 }}>
                            {tone.label}
                            {v.confidence !== null && ` · ${Math.round(v.confidence * 100)}% sure`}
                          </p>
                          {v.notes && (
                            <p style={{ fontSize: T.meta, color: C.textMuted, lineHeight: 1.45 }}>{v.notes}</p>
                          )}
                          {/* The free checks, shown as themselves. A student
                              who disagrees with the verdict can see exactly
                              which fact it was resting on. */}
                          <ul style={{ listStyle: 'none', margin: '5px 0 0', padding: 0 }}>
                            {v.checks.map((c) => (
                              <li key={c.id} style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.5 }}>
                                {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✕' : '?'} {c.label}
                              </li>
                            ))}
                          </ul>

                          {/* Who answered, when a person did. An answer from
                              the person who did the work is a different claim
                              from a teammate's, and the card should not blur
                              the two. */}
                          {v.humanVerdict && v.humanActorId && (
                            <p style={{ fontSize: T.meta, color: C.textGhost, marginTop: 5, lineHeight: 1.5 }}>
                              {v.humanActorId === userId
                                ? 'You answered this'
                                : `${nameOf(v.humanActorId)} answered this`}
                            </p>
                          )}

                          {mayReview(task) && (
                            <div style={{ marginTop: 8 }}>
                              <Button size="sm" onClick={() => openReview(task)} disabled={busy}>
                                Review this
                              </Button>
                            </div>
                          )}

                          {/* Said plainly, because the alternative is somebody
                              waiting on a button that is never going to appear
                              for them. */}
                          {v.verdict === 'unverifiable' && !v.humanVerdict && task.assigneeId === userId && (
                            <p style={{ fontSize: T.meta, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                              A teammate has to confirm this one. If nobody on the project can,
                              Workmark will look at it.
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {task.blockedAt && (
                      <p style={{ fontSize: T.meta, color: '#94500F', lineHeight: 1.45, marginBottom: 6 }}>
                        Blocked — {task.blockedReason}
                      </p>
                    )}

                    {/* Said, not enforced. Starting this anyway is allowed and
                        is itself worth knowing about. */}
                    {(blockersFor.get(task.id)?.length ?? 0) > 0 && (
                      <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.45, marginBottom: 6 }}>
                        Waiting on {blockersFor.get(task.id)!.slice(0, 2).join(', ')}
                        {blockersFor.get(task.id)!.length > 2
                          && ` and ${blockersFor.get(task.id)!.length - 2} more`}
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
                        same moves exist as a plain control. Both go away once
                        the project is closed — the board stops being a place
                        to work and becomes the record of what happened. */}
                    <div hidden={readOnly} style={{ display: 'flex', gap: 6, marginTop: 9, alignItems: 'center' }}>
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

      {/* Still openable on a closed project — being unable to read the
          acceptance criteria of your own finished work would be a real loss.
          Just not saveable. */}
      <TaskDialog
        open={editing !== null}
        title={readOnly ? 'Task' : 'Edit task'}
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
        readOnly={readOnly}
        history={editing ? decisionsFor.get(editing.id) ?? [] : []}
        nameOf={nameOf}
      />

      {/* One question, four answers, one button. The answers are ordered by
          how often each is the true one, and only the first is styled as a
          primary action — the dialog should not read as though confirming is
          what a good teammate does. */}
      <Modal
        open={reviewing !== null}
        onClose={() => setReviewing(null)}
        title={reviewing ? `Does this work?` : 'Review'}
      >
        {reviewing && (
          <>
            <p style={{ fontSize: T.bodySm, fontWeight: 500, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>
              {reviewing.title}
            </p>
            <p style={{ fontSize: T.meta, color: C.textGhost, marginBottom: 12 }}>
              {nameOf(reviewing.assigneeId) ?? 'Somebody'} submitted this
            </p>

            {reviewing.acceptanceCriteria && (
              <div style={{
                background: C.surfaceAlt, borderRadius: R.md, padding: '10px 12px', marginBottom: 14,
              }}>
                <p style={{ fontSize: T.meta, fontWeight: 600, color: C.textSub, marginBottom: 4 }}>
                  What it was supposed to do
                </p>
                <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {reviewing.acceptanceCriteria}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gap: 7, marginBottom: 14 }}>
              {HUMAN_VERDICTS.map((verdict) => {
                const selected = reviewVerdict === verdict
                return (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() => setReviewVerdict(verdict)}
                    aria-pressed={selected}
                    style={{
                      textAlign: 'left', cursor: 'pointer', width: '100%',
                      background: selected ? C.surfaceAlt : C.surface,
                      border: `1px solid ${selected ? C.accentBorder : C.border}`,
                      borderRadius: R.md, padding: '11px 13px',
                      transition: 'border-color 120ms ease, background 120ms ease',
                    }}
                  >
                    <span style={{
                      display: 'block', fontSize: T.bodySm,
                      fontWeight: selected ? 600 : 500, color: C.text, marginBottom: 2,
                    }}>
                      {HUMAN_VERDICT_LABEL[verdict]}
                    </span>
                    <span style={{ display: 'block', fontSize: T.meta, color: C.textMuted, lineHeight: 1.5 }}>
                      {HUMAN_VERDICT_HINT[verdict]}
                    </span>
                  </button>
                )
              })}
            </div>

            <Field
              label="Anything to add?"
              hint={reviewVerdict === 'works' ? 'optional' : 'what needs fixing'}
            >
              <textarea
                className="dk-input"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Signed in fine on my machine, but the redirect drops the query string."
                style={{ resize: 'vertical' }}
              />
            </Field>

            {/* Said before the button rather than after the click. Confirming
                is the one action here that puts something on somebody's
                permanent record. */}
            {reviewVerdict === 'works' && (
              <p style={{ fontSize: T.meta, color: C.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
                This moves the task to Verified and counts toward{' '}
                {nameOf(reviewing.assigneeId) ?? 'their'} record.
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="quiet" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button onClick={submitReview} disabled={busy || reviewVerdict === null}>
                {busy ? 'Saving…' : 'Save answer'}
              </Button>
            </div>
          </>
        )}
      </Modal>

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
  reason, setReason, askReason, readOnly = false, history = [], nameOf,
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
  readOnly?: boolean
  /** Every answer ever given about this task, oldest first. */
  history?: TaskDecision[]
  nameOf?: (id: string | null) => string | null
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

      {/* How the answer was reached, not just what it was.
          A student who disagrees with a verdict needs to be able to see what
          it rested on and who changed it — a dispute you cannot see the basis
          of is one you cannot make. Trigger-written, so nothing here is a
          summary somebody chose to show. */}
      {history.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.borderFaint}`, paddingTop: 13, marginBottom: 14 }}>
          <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>
            How this was decided
          </p>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
            {history.map((d, i) => (
              <li key={`${d.decidedAt}-${i}`} style={{ fontSize: T.meta, lineHeight: 1.55 }}>
                <span style={{ color: C.text, fontWeight: 500 }}>
                  {VERDICT_TONE[d.verdict]?.label ?? d.verdict}
                </span>
                <span style={{ color: C.textGhost }}>
                  {' · '}
                  {d.decidedBy === 'person'
                    ? `${nameOf?.(d.actorId) ?? 'A person'} answered`
                    : 'Workmark checked it'}
                  {d.confidence !== null && ` · ${Math.round(d.confidence * 100)}% sure`}
                  {' · '}
                  {new Date(d.decidedAt).toLocaleDateString()}
                </span>
                {d.note && (
                  <span style={{ display: 'block', color: C.textMuted, marginTop: 2 }}>{d.note}</span>
                )}
              </li>
            ))}
          </ol>
          <p style={{ fontSize: T.meta, color: C.textGhost, lineHeight: 1.55, marginTop: 9 }}>
            If something here is wrong, you can challenge it from{' '}
            <Link href="/me/file" style={{ color: C.textMuted }}>your file</Link>.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Button variant="quiet" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && (
          <Button onClick={onSave} disabled={busy || draft.title.trim().length < 2}>{saveLabel}</Button>
        )}
      </div>
    </Modal>
  )
}
