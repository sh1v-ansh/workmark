'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Bar } from '@/components/ui/Skeleton'
import { canAskForMore } from '@/lib/workspace/project-state'
import {
  currentSprint, progressOf, isOverdue, daysRemaining, type Sprint,
} from '@/lib/workspace/sprint'
import { MENTION, type Message } from '@/lib/workspace/messages'
import { pending, type Checkpoint } from '@/lib/workspace/checkpoints'
import { rankToday, emptyReason } from '@/lib/workspace/today'
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
  sprints,
  messages,
  checkpoints,
  members,
  dependencies,
  decisions,
  userId,
  workspaceStatus,
  readOnly = false,
}: {
  workspaceId: string
  tasks: BoardTask[]
  verdicts: TaskVerdict[]
  sprints: Sprint[]
  messages: [string, Message[]][]
  checkpoints: [string, Checkpoint[]][]
  members: TeamMember[]
  dependencies: TaskDependency[]
  decisions: TaskDecision[]
  userId: string
  /** Needed to answer "may I ask for more work" without a round trip. */
  workspaceStatus: string
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
  const [abandoning, setAbandoning] = useState<BoardTask | null>(null)
  const [abandonReason, setAbandonReason] = useState('')
  const [showAside, setShowAside] = useState(false)
  const [sprintGoal, setSprintGoal] = useState('')
  const [startingSprint, setStartingSprint] = useState(false)
  const [endingSprint, setEndingSprint] = useState(false)
  const [lastRetro, setLastRetro] = useState<string | null>(null)
  const [checkingScope, setCheckingScope] = useState(false)
  const [talking, setTalking] = useState<BoardTask | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [offered, setOffered] = useState<{ title: string; why: string } | null>(null)
  const [splitting, setSplitting] = useState<BoardTask | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const threadsByTask = new Map(messages)
  const checkpointsByTask = new Map(checkpoints)
  // At most one, and only on a card that is yours. A question about what
  // somebody else will try first is not yours to answer.
  const myPending = tasks
    .map((t) => ({ task: t, checkpoint: pending(checkpointsByTask.get(t.id) ?? []) }))
    .find((x) => x.checkpoint !== null && x.task.assigneeId === userId) ?? null
  const [checkpointAnswer, setCheckpointAnswer] = useState('')

  const [scopeCheck, setScopeCheck] = useState<
    { verdict: string; reasoning: string; suggestion: string } | null
  >(null)
  const [reviewVerdict, setReviewVerdict] = useState<HumanVerdict | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const verdictFor = new Map(verdicts.map((v) => [v.taskId, v]))
  const submittedCount = tasks.filter((t) => t.status === 'submitted').length
  const asideTasks = tasks.filter((t) => t.status === 'abandoned')

  // The same function the route uses to refuse, run here so the answer
  // arrives on hover instead of after a ten-second model call that was never
  // going to succeed. The route still decides — this only saves the wait.
  const askRefusal = canAskForMore({
    workspaceId, title: '', status: workspaceStatus, deadline: null, revisions: [],
    tasks: tasks.map((t) => ({
      id: t.id, title: t.title, status: t.status,
      difficulty: t.difficulty, estimateHours: t.estimateHours, dueOn: t.dueOn,
      assigneeId: t.assigneeId, startedAt: t.startedAt,
      blockedReason: t.blockedAt ? t.blockedReason : null,
      abandonedReason: t.abandonedReason,
      latestVerdict: verdictFor.get(t.id)?.verdict ?? null,
      verdictNote: verdictFor.get(t.id)?.notes ?? null,
      attempts: verdictFor.get(t.id)?.attempt ?? 0,
    })),
  })
  const boardTasks = tasks.filter((t) => t.status !== 'abandoned')

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
      submittedById: v?.submittedById ?? null,
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

  const sprint = currentSprint(sprints)
  const lastClosed = sprints.find((s) => s.closedAt !== null && s.retro) ?? null

  // A sort, not a judgement. See today.ts for why this is deliberately not a
  // model call — and why there is no "ask Workmark what to do today" button
  // when the task thread on each card already answers "how do I start this".
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayList = rankToday(
    tasks.map((t) => ({
      id: t.id, title: t.title, status: t.status, assigneeId: t.assigneeId,
      dueOn: t.dueOn, difficulty: t.difficulty, sprintId: t.sprintId,
      blockedAt: t.blockedAt, parentTaskId: t.parentTaskId,
    })),
    dependencies.map((d) => ({ taskId: d.taskId, dependsOnTaskId: d.dependsOnId })),
    { userId, sprintId: sprint?.id ?? null, today: todayISO },
  )


  async function startSprint() {
    const ok = await send(`/api/workspaces/${workspaceId}/sprints`,
      { method: 'POST', body: JSON.stringify({ goal: sprintGoal || null }) }, 'Week started.')
    if (ok) { setStartingSprint(false); setSprintGoal('') }
  }

  async function sendMessage() {
    if (!talking || !draftMessage.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${talking.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draftMessage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send that.')
      setDraftMessage('')
      // Said out loud rather than swallowed: somebody who typed a mention and
      // saw nothing happen concludes the feature is broken.
      if (data.note) toast(data.note, 'info')
      // Offered rather than added. The student decides, the same way they
      // would on a real job.
      setOffered(data.suggestedSubtask ?? null)
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setSending(false)
    }
  }

  async function settleCheckpoint(skip: boolean) {
    if (!myPending?.checkpoint) return
    const ok = await send(`/api/workspaces/${workspaceId}/checkpoints/${myPending.checkpoint.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ answer: skip ? null : checkpointAnswer }),
    }, skip ? 'Skipped.' : 'Noted.')
    if (ok) setCheckpointAnswer('')
  }

  async function addSubtask() {
    if (!splitting || subtaskTitle.trim().length < 2) return
    const ok = await send(`/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: subtaskTitle, parentTaskId: splitting.id }),
    }, 'Subtask added.')
    if (ok) setSubtaskTitle('')
  }

  async function addOfferedSubtask() {
    if (!talking || !offered) return
    const ok = await send(`/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: offered.title, detail: offered.why, parentTaskId: talking.id }),
    }, 'Added as a subtask.')
    if (ok) setOffered(null)
  }

  async function checkScopeNow() {
    if (!sprint) return
    setCheckingScope(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sprints/${sprint.id}/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not check this week.')
      setScopeCheck(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setCheckingScope(false)
    }
  }

  async function endSprint() {
    if (!sprint) return
    setEndingSprint(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sprints/${sprint.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not end the week.')
      // Shown straight away rather than only after the refresh: the review is
      // the thing they pressed the button for, and making them find it on a
      // reloaded page is how it goes unread.
      setLastRetro(data.retro ?? null)
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setEndingSprint(false)
    }
  }

  async function confirmAbandon() {
    if (!abandoning) return
    const ok = await send(`/api/workspaces/${workspaceId}/tasks/${abandoning.id}`,
      { method: 'PATCH', body: JSON.stringify({ status: 'abandoned', abandonedReason: abandonReason }) },
      'Set aside.')
    if (ok) setAbandoning(null)
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
            <Button size="sm" onClick={checkWork} busyLabel={checking ? 'Checking…' : null}>
              {`Check my work (${submittedCount})`}
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={draftPlan}
              disabled={askRefusal !== null}
              busyLabel={planning ? 'Thinking…' : null}
              // The reason, on the control itself. A disabled button with no
              // explanation is the most annoying thing an interface can do.
              title={askRefusal ?? undefined}
            >
              {tasks.length === 0 ? 'Draft a plan' : 'Give me more work'}
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

      {/* Three things, with why each is here.
          A strip rather than a page: twelve items is a competing view of the
          same board and people end up trusting neither. */}
      {!readOnly && workspaceStatus === 'active' && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 8 }}>
            Today
          </p>
          {todayList.length === 0 ? (
            <p style={{ fontSize: T.bodySm, color: C.textFaint, lineHeight: 1.6 }}>
              {emptyReason(
                tasks.map((t) => ({
                  id: t.id, title: t.title, status: t.status, assigneeId: t.assigneeId,
                  dueOn: t.dueOn, difficulty: t.difficulty, sprintId: t.sprintId,
                  blockedAt: t.blockedAt, parentTaskId: t.parentTaskId,
                })),
                { userId },
              )}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {todayList.map(({ task, reason }, i) => (
                <button
                  key={task.id}
                  onClick={() => {
                    const full = tasks.find((t) => t.id === task.id)
                    if (full) openEdit(full)
                  }}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left',
                    padding: '9px 12px', borderRadius: R.md, cursor: 'pointer',
                    border: `1px solid ${i === 0 ? C.border : C.borderFaint}`,
                    background: i === 0 ? C.surfaceAlt : C.surface,
                  }}
                >
                  <span style={{ fontSize: T.bodySm, color: C.text, flex: 1, minWidth: 0 }}>
                    {task.title}
                  </span>
                  {/* The reason, not just the rank. A list with no explanation
                      is one people re-sort in their head and then ignore. */}
                  <span style={{ fontSize: T.meta, color: C.textFaint, flexShrink: 0 }}>
                    {reason}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* One question, once, as work starts.
          A strip rather than a modal on purpose: a dialog in front of the
          board at the moment somebody sits down to work is the thing that
          teaches people to dismiss these without reading. This waits. */}
      {myPending?.checkpoint && !readOnly && (
        <div style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: R.md,
          border: `1px solid ${C.border}`, background: C.surfaceAlt,
        }}>
          <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 4 }}>
            {myPending.task.title}
          </p>
          <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text, marginBottom: 9 }}>
            {myPending.checkpoint.question}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="dk-input"
              value={checkpointAnswer}
              onChange={(e) => setCheckpointAnswer(e.target.value)}
              placeholder="A few words is enough"
              maxLength={2000}
              style={{ flex: '1 1 280px' }}
            />
            <Button size="sm" onClick={() => settleCheckpoint(false)} disabled={busy || checkpointAnswer.trim().length < 8}>
              Save
            </Button>
            {/* Skipping is a real answer. A question nobody can dismiss is one
                people make something up for, and an invented prediction is
                worse than none — the checker would hold the diff against it. */}
            <Button variant="quiet" size="sm" onClick={() => settleCheckpoint(true)} disabled={busy}>
              Skip
            </Button>
          </div>
        </div>
      )}

      {/* The week.
          The one place a student commits to an amount of work before doing it
          and is then shown what happened, which is the most informative thing
          this board records. Above the columns because it frames them: these
          six columns are this week's work, not an undated pile. */}
      {!readOnly && workspaceStatus === 'active' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '11px 14px',
          borderRadius: R.md, border: `1px solid ${sprint && isOverdue(sprint, new Date()) ? '#E4B9A6' : C.borderFaint}`,
          background: C.surfaceAlt,
        }}>
          {sprint ? (
            <>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text }}>
                  {sprint.name}
                  {sprint.goal ? <span style={{ fontWeight: 400, color: C.textMuted }}> — {sprint.goal}</span> : null}
                </p>
                <p style={{ fontSize: T.meta, color: C.textFaint, marginTop: 3 }}>
                  {(() => {
                    const p = progressOf(sprint, tasks)
                    const left = daysRemaining(sprint, new Date())
                    const when = left > 0
                      ? `${left} day${left === 1 ? '' : 's'} left`
                      : left === 0 ? 'ends today' : `${-left} day${left === -1 ? '' : 's'} over`
                    // Set-aside counted separately, never folded into either
                    // side: it is not done and it is not outstanding.
                    return `${p.done} of ${p.committed - p.setAside} done` +
                      (p.setAside > 0 ? `, ${p.setAside} set aside` : '') +
                      ` · ${when}`
                  })()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Before, not after. A review says what happened; this says
                    "that is three weeks of work" while there is still time to
                    change it. */}
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={checkScopeNow}
                  busyLabel={checkingScope ? 'Checking…' : null}
                >
                  Is this doable?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={endSprint}
                  busyLabel={endingSprint ? 'Reviewing…' : null}
                >
                  End the week
                </Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  No week running
                </p>
                <p style={{ fontSize: T.meta, color: C.textFaint }}>
                  Commit to what you will finish, and find out how close you got.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStartingSprint(true)}>
                Start a week
              </Button>
            </>
          )}
        </div>
      )}

      {/* Last week's review, until they start the next one. The thing somebody
          actually wants while deciding what to commit to. */}
      {!sprint && lastClosed?.retro && (
        <div style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: R.md,
          border: `1px solid ${C.borderFaint}`, background: C.bg,
        }}>
          <p style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 6 }}>
            {lastClosed.name} review
          </p>
          <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
            {lastClosed.retro}
          </p>
        </div>
      )}

      <div className="nb-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {BOARD_COLUMNS.map((column) => {
          // Children are drawn under their parent rather than as cards of
          // their own, so a task broken into three does not take four slots
          // in a column and read as four separate pieces of work.
          const inColumn = boardTasks
            .filter((t) => t.status === column && t.parentTaskId === null)
            .sort(byBoardOrder)
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
                      onClick={() => {
                    const full = tasks.find((t) => t.id === task.id)
                    if (full) openEdit(full)
                  }}
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
                      <button
                        type="button"
                        onClick={() => { setSplitting(task); setSubtaskTitle('') }}
                        title="Break this into pieces"
                        style={{
                          fontSize: T.meta, padding: '3px 7px', borderRadius: R.sm, cursor: 'pointer',
                          border: `1px solid ${C.border}`, background: C.bg, color: C.textGhost,
                        }}
                      >
                        Split
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTalking(task); setDraftMessage('') }}
                        title="Discuss this task, or ask Workmark"
                        style={{
                          fontSize: T.meta, padding: '3px 7px', borderRadius: R.sm, cursor: 'pointer',
                          border: `1px solid ${C.border}`, background: C.bg, color: C.textGhost,
                        }}
                      >
                        {(() => {
                          const n = (threadsByTask.get(task.id) ?? []).length
                          return n > 0 ? `Discuss (${n})` : 'Discuss'
                        })()}
                      </button>
                      {/* Only where it is a real answer. Verified work cannot
                          be taken back, and nothing in Backlog was ever
                          attempted, so offering it there is noise. */}
                      {(task.status === 'doing' || task.status === 'submitted') && (
                        <button
                          type="button"
                          onClick={() => { setAbandoning(task); setAbandonReason('') }}
                          disabled={busy}
                          title="Tried this and it did not work out"
                          style={{
                            fontSize: T.meta, padding: '3px 7px', borderRadius: R.sm, cursor: 'pointer',
                            border: `1px solid ${C.border}`, background: C.bg, color: C.textGhost,
                          }}
                        >
                          Set aside
                        </button>
                      )}
                    </div>
                    {(() => {
                      const kids = tasks.filter((k) => k.parentTaskId === task.id)
                      if (kids.length === 0) return null
                      const done = kids.filter((k) => k.status === 'verified' || k.status === 'accepted').length
                      return (
                        <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${C.borderFaint}` }}>
                          <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 5 }}>
                            {done} of {kids.length} pieces done
                          </p>
                          {kids.map((k) => (
                            <p
                              key={k.id}
                              style={{
                                fontSize: T.meta, lineHeight: 1.5, color: C.textMuted,
                                textDecoration: k.status === 'abandoned' ? 'line-through' : 'none',
                              }}
                            >
                              {k.status === 'verified' || k.status === 'accepted' ? '✓ ' : '· '}{k.title}
                            </p>
                          ))}
                        </div>
                      )
                    })()}
                  </article>
                ))}

                {/* Where the plan is about to land.
                    A model call takes the better part of ten seconds, and for
                    all of it the board used to look exactly as it had before
                    the button was pressed. Drawing the cards in the column
                    they will appear in turns a wait into something visibly in
                    progress, and it costs nothing. */}
                {planning && column === 'backlog' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <Bar key={i} height={78} radius={10} style={{ opacity: 1 - i * 0.22 }} />
                    ))}
                  </div>
                )}
                {inColumn.length === 0 && !(planning && column === 'backlog') && (
                  <p style={{ fontSize: T.meta, color: C.textGhost, padding: '10px 2px' }}>Nothing here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Set-aside work, under the board rather than in it.
          A seventh column of things that did not happen is one nobody wants
          to look at every day, but hiding these entirely would be worse: the
          reason somebody wrote down is the whole value of setting a card
          aside instead of leaving it in Doing forever, and it is what the
          planner reads before writing the next task. */}
      {asideTasks.length > 0 && (
        <div style={{ marginTop: 20, borderTop: `1px solid ${C.borderFaint}`, paddingTop: 14 }}>
          <button
            onClick={() => setShowAside((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none',
              padding: 0, cursor: 'pointer', fontSize: T.meta, fontWeight: 600, color: C.textFaint,
            }}
          >
            {showAside ? '▾' : '▸'} Set aside ({asideTasks.length})
          </button>
          {showAside && (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {asideTasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '10px 12px', borderRadius: R.md,
                    border: `1px solid ${C.borderFaint}`, background: C.surfaceAlt,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <p style={{ fontSize: T.bodySm, color: C.textMuted, textDecoration: 'line-through' }}>
                      {t.title}
                    </p>
                    {!readOnly && (
                      <button
                        onClick={() => move(t, 'planned')}
                        style={{
                          flexShrink: 0, background: 'none', border: 'none', padding: 0,
                          cursor: 'pointer', fontSize: T.meta, color: C.accent,
                        }}
                      >
                        Pick it back up
                      </button>
                    )}
                  </div>
                  {t.abandonedReason && (
                    <p style={{ fontSize: T.meta, color: C.textFaint, lineHeight: 1.55, marginTop: 4 }}>
                      {t.abandonedReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* The task thread.
          Per task rather than project-wide, because a task thread carries its
          own context — the card, its criteria, what the checker said — which
          is both a better answer and a cheaper one than handing a model the
          whole board to answer something specific. */}
      <Modal
        open={talking !== null}
        onClose={() => { setTalking(null); setDraftMessage('') }}
        title="Discussion"
        subtitle={talking?.title}
      >
        {talking && (
          <>
            {(threadsByTask.get(talking.id) ?? []).length === 0 ? (
              <p style={{ fontSize: T.bodySm, color: C.textFaint, lineHeight: 1.6, marginBottom: 16 }}>
                Nothing here yet. Talk to your team, or type {MENTION} to ask Workmark about this task.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
                {(threadsByTask.get(talking.id) ?? []).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 12px', borderRadius: R.md,
                      background: m.senderKind === 'agent' ? C.surfaceAlt : C.surface,
                      border: `1px solid ${m.senderKind === 'agent' ? C.border : C.borderFaint}`,
                    }}
                  >
                    <p style={{ fontSize: T.meta, fontWeight: 600, color: C.textFaint, marginBottom: 4 }}>
                      {m.senderKind === 'agent' ? 'Workmark' : (nameOf(m.senderId) ?? 'Someone')}
                    </p>
                    <p style={{ fontSize: T.bodySm, color: C.textSub, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {m.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {offered && !readOnly && (
              <div style={{
                marginBottom: 14, padding: '11px 13px', borderRadius: R.md,
                border: `1px solid ${C.border}`, background: C.bgAlt,
              }}>
                <p style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 5 }}>
                  Looks like more work
                </p>
                <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                  {offered.title}
                </p>
                <p style={{ fontSize: T.meta, color: C.textMuted, lineHeight: 1.55, marginBottom: 10 }}>
                  {offered.why}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" onClick={addOfferedSubtask} disabled={busy}>Add as a subtask</Button>
                  <Button variant="quiet" size="sm" onClick={() => setOffered(null)}>No thanks</Button>
                </div>
              </div>
            )}

            {!readOnly && (
              <>
                <textarea
                  className="dk-input"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder={`Ask your team, or ${MENTION} to ask Workmark`}
                  rows={3}
                  maxLength={4000}
                  style={{ marginBottom: 6, resize: 'vertical' }}
                />
                {/* Said up front, because the limit is the point rather than a
                    disappointment: it explains, it does not write the code. */}
                <p style={{ fontSize: T.meta, color: C.textGhost, marginBottom: 14, lineHeight: 1.5 }}>
                  Workmark answers when you name it. It will explain and point you at things — it will not
                  write the task for you, because then the record would be about the wrong person.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    onClick={sendMessage}
                    disabled={!draftMessage.trim()}
                    busyLabel={sending ? 'Sending…' : null}
                  >
                    Send
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={scopeCheck !== null}
        onClose={() => setScopeCheck(null)}
        title={
          scopeCheck?.verdict === 'too_much' ? 'This is more than a week'
            : scopeCheck?.verdict === 'tight' ? 'Tight, but possible'
              : 'This looks about right'
        }
      >
        {scopeCheck && (
          <>
            <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.7, marginBottom: 14 }}>
              {scopeCheck.reasoning}
            </p>
            <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 5 }}>
                What to change
              </p>
              <p style={{ fontSize: T.bodySm, color: C.textSub, lineHeight: 1.65 }}>
                {scopeCheck.suggestion}
              </p>
            </div>
            {/* Nothing is applied. It is advice, and the plan stays theirs. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setScopeCheck(null)}>Got it</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={splitting !== null}
        onClose={() => { setSplitting(null); setSubtaskTitle('') }}
        title="Break this up"
        subtitle={splitting?.title}
      >
        {splitting && (
          <>
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
              One level, not a tree. Each piece is checked on its own, and the parent counts once —
              splitting a task does not make it worth more.
            </p>
            {tasks.filter((k) => k.parentTaskId === splitting.id).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {tasks.filter((k) => k.parentTaskId === splitting.id).map((k) => (
                  <p key={k.id} style={{ fontSize: T.bodySm, color: C.textSub, lineHeight: 1.7 }}>· {k.title}</p>
                ))}
              </div>
            )}
            <input
              className="dk-input"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="Set the callback URL in the provider dashboard"
              maxLength={200}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="quiet" onClick={() => { setSplitting(null); setSubtaskTitle('') }}>Done</Button>
              <Button onClick={addSubtask} disabled={busy || subtaskTitle.trim().length < 2}>Add piece</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={startingSprint} onClose={() => setStartingSprint(false)} title="Start a week">
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
          A week runs for seven days. At the end you get a review of what you committed to against
          what actually happened — including the reasons you gave when something moved, which is
          the part that matters.
        </p>
        <label htmlFor="sprint-goal" style={{ display: 'block', fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
          What is this week for? <span style={{ fontWeight: 400, color: C.textGhost }}>Optional</span>
        </label>
        <input
          id="sprint-goal"
          className="dk-input"
          value={sprintGoal}
          onChange={(e) => setSprintGoal(e.target.value)}
          placeholder="Get sign-in working end to end"
          maxLength={500}
          style={{ marginBottom: 20 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="quiet" onClick={() => setStartingSprint(false)}>Cancel</Button>
          <Button onClick={startSprint} disabled={busy}>Start</Button>
        </div>
      </Modal>

      {/* The review, the moment it arrives. */}
      <Modal open={lastRetro !== null} onClose={() => setLastRetro(null)} title="How the week went">
        <p style={{ fontSize: T.body, color: C.textMuted, lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: 20 }}>
          {lastRetro}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => setLastRetro(null)}>Got it</Button>
        </div>
      </Modal>

      {/* Setting work aside.
          Worded so that using it honestly does not feel like an admission.
          A student who spent four days finding out an approach does not work
          has learned something, and the alternative on offer before this
          existed was to leave the card in Doing forever or move it to
          Verified and lie. */}
      <Modal
        open={abandoning !== null}
        onClose={() => setAbandoning(null)}
        title="Set this aside"
      >
        {abandoning && (
          <>
            <p style={{ fontSize: T.bodySm, fontWeight: 500, color: C.text, marginBottom: 10 }}>
              {abandoning.title}
            </p>
            <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
              This does not count against you. What you found out is the useful part, and it is
              what gets read when the next task is written. You can pick it back up any time.
            </p>
            <label htmlFor="abandon-reason" style={{ display: 'block', fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
              What happened?
            </label>
            <textarea
              id="abandon-reason"
              className="dk-input"
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
              placeholder="The library does not support streaming on this runtime, so the whole approach needs rethinking."
              rows={3}
              maxLength={2000}
              style={{ marginBottom: 6, resize: 'vertical' }}
            />
            <p style={{ fontSize: T.meta, color: C.textGhost, marginBottom: 18 }}>
              At least 10 characters.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="quiet" onClick={() => setAbandoning(null)}>Cancel</Button>
              <Button onClick={confirmAbandon} disabled={busy || abandonReason.trim().length < 10}>
                Set aside
              </Button>
            </div>
          </>
        )}
      </Modal>

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
