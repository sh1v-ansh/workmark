'use client'

import { useState } from 'react'
import { C, R, T } from '@/lib/theme/dark-tokens'
import {
  monthView, shiftMonth, monthOf, byDueDate, spanAt, isOverdue,
  type DatedTask,
} from '@/lib/workspace/calendar'
import type { Sprint } from '@/lib/workspace/sprint'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * The month, with the week drawn across it.
 *
 * A board answers "what is there"; this answers "when". They are different
 * questions and a student planning a week needs the second one, which six
 * columns of cards cannot show — a deadline is invisible on a kanban board
 * until it has passed.
 *
 * Deliberately read-only. Dragging a card to a date would make this a second
 * way to edit the board, and two editors of the same data is how they start
 * disagreeing. Clicking a day opens the card; changing the date happens where
 * every other field on a task is changed.
 *
 * Every date here is a plain string. See calendar.ts for why that matters and
 * what it prevents.
 */
export default function Calendar({
  tasks,
  sprints,
  deadline,
  onOpenTask,
}: {
  tasks: DatedTask[]
  sprints: Sprint[]
  /** The project's own end date, when it has one. */
  deadline: string | null
  onOpenTask: (taskId: string) => void
}) {
  // Read once, here, and passed down as a string. Nothing below this line
  // touches a clock.
  const today = new Date().toISOString().slice(0, 10)
  const [month, setMonth] = useState(monthOf(today))

  const view = monthView(month, today)
  const dated = byDueDate(tasks)
  const open = sprints.find((s) => s.closedAt === null) ?? null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>{view.label}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['‹', -1], ['Today', 0], ['›', 1]].map(([label, delta]) => (
            <button
              key={String(label)}
              onClick={() => setMonth(delta === 0 ? monthOf(today) : shiftMonth(month, delta as number))}
              style={{
                fontSize: T.meta, padding: '4px 10px', borderRadius: R.sm, cursor: 'pointer',
                border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
        {WEEKDAYS.map((day) => (
          <p key={day} style={{ fontSize: T.meta, color: C.textFaint, textAlign: 'center', paddingBottom: 6 }}>
            {day}
          </p>
        ))}

        {view.weeks.flat().map((cell) => {
          const due = dated.get(cell.date) ?? []
          const inSprint = open ? spanAt({ from: open.startsOn, to: open.endsOn }, cell.date) : null
          const isDeadline = deadline !== null && deadline === cell.date

          return (
            <div
              key={cell.date}
              style={{
                minHeight: 86,
                padding: '5px 6px',
                background: cell.inMonth ? C.surface : C.bg,
                border: `1px solid ${cell.isToday ? C.accent : C.borderFaint}`,
                borderRadius: R.sm,
                // The week as a tint across its days rather than a bar, so it
                // reads as context behind the work instead of another row
                // competing with it.
                boxShadow: inSprint ? `inset 0 2px 0 0 ${C.accent}` : undefined,
                opacity: cell.inMonth ? 1 : 0.45,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                <span style={{
                  fontSize: T.meta,
                  fontWeight: cell.isToday ? 700 : 400,
                  color: cell.isToday ? C.accent : C.textFaint,
                }}>
                  {/* Sliced, not parsed. Turning this into a Date to read the
                      day back off it is the bug calendar.ts exists to avoid. */}
                  {Number(cell.date.slice(8, 10))}
                </span>
                {isDeadline && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>DUE</span>
                )}
              </div>

              {due.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  onClick={() => onOpenTask(task.id)}
                  title={task.title}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    marginTop: 3, padding: '2px 4px', borderRadius: 4, border: 'none',
                    fontSize: 13, lineHeight: 1.35,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    background: isOverdue(task, today) ? '#FDECEC' : C.surfaceAlt,
                    color: isOverdue(task, today) ? '#94170F' : C.textMuted,
                    textDecoration: task.status === 'verified' || task.status === 'accepted'
                      ? 'line-through' : 'none',
                  }}
                >
                  {task.title}
                </button>
              ))}
              {due.length > 3 && (
                <p style={{ fontSize: 13, color: C.textGhost, marginTop: 2 }}>+{due.length - 3} more</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
