// A month, as data rather than a widget.
//
// ── The rule everything here follows ──────────────────────────────────────
// Dates in this product are DATE columns: `tasks.due_on`, `sprints.starts_on`,
// `sprints.ends_on`, `workspaces.deadline`. They are days, not moments. The
// string '2026-09-16' means the sixteenth, everywhere, for everybody.
//
// `new Date('2026-09-16')` parses that as midnight UTC, and every local getter
// on the result then reports the fifteenth for anybody west of Greenwich. A
// calendar built that way shows every deadline one box early for most of the
// Americas — including, for instance, Massachusetts.
//
// So: no Date is ever constructed from one of these strings for display, and
// nothing is ever read with getDate() or getMonth(). Arithmetic goes through
// Date.UTC on the parts and comes straight back out as a string. The only
// place a real clock is read is the caller deciding what "today" is, and it
// passes that in as a string too.
//
// ── Why no library ───────────────────────────────────────────────────────
// A month grid is thirty-five boxes and one modulo. FullCalendar is two
// hundred kilobytes of interaction model for a view nobody interacts with,
// and it would bring its own opinions about timezones to a product whose
// dates do not have one.

const DAY = 86_400_000

/** 'YYYY-MM-DD' → UTC milliseconds. Never used for display, only to count. */
function stamp(date: string): number {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
}

/** UTC milliseconds → 'YYYY-MM-DD'. toISOString is UTC, which is the point. */
function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return iso(stamp(date) + days * DAY)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((stamp(to) - stamp(from)) / DAY)
}

/** Monday-first, because a working week is Monday to Friday. */
export function weekdayIndex(date: string): number {
  return (new Date(stamp(date)).getUTCDay() + 6) % 7
}

export interface Cell {
  date: string
  /** False for the leading and trailing days borrowed from other months. */
  inMonth: boolean
  isToday: boolean
}

export interface MonthView {
  /** 'YYYY-MM'. */
  month: string
  label: string
  weeks: Cell[][]
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const year = +month.slice(0, 4)
  const index = +month.slice(5, 7) - 1 + delta
  return iso(Date.UTC(year, index, 1)).slice(0, 7)
}

/**
 * The grid.
 *
 * Always whole weeks, so the rows line up under the weekday headings, and
 * always six of them — a month that fits in five would otherwise make the
 * panel change height as somebody pages through it, which reads as the layout
 * breaking rather than as a shorter month.
 */
export function monthView(month: string, today: string): MonthView {
  const first = `${month}-01`
  const start = addDays(first, -weekdayIndex(first))

  const weeks: Cell[][] = []
  for (let w = 0; w < 6; w++) {
    const week: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d)
      week.push({ date, inMonth: date.slice(0, 7) === month, isToday: date === today })
    }
    weeks.push(week)
  }

  return {
    month,
    label: `${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`,
    weeks,
  }
}

export interface DatedTask {
  id: string
  title: string
  status: string
  dueOn: string | null
}

/**
 * Tasks on the day they are due.
 *
 * Only what has a date. A board is mostly undated work, and a calendar that
 * invented a position for it would be showing something that is not true.
 */
export function byDueDate(tasks: DatedTask[]): Map<string, DatedTask[]> {
  const out = new Map<string, DatedTask[]>()
  for (const task of tasks) {
    if (!task.dueOn) continue
    const bucket = out.get(task.dueOn)
    if (bucket) bucket.push(task)
    else out.set(task.dueOn, [task])
  }
  return out
}

export type SpanPosition = 'single' | 'start' | 'middle' | 'end' | null

/**
 * Where a cell sits inside a range, so a band can be drawn across a week.
 *
 * Returns null when the day is outside it. Used for both the sprint and the
 * project deadline, which is a range of one.
 */
export function spanAt(range: { from: string; to: string }, date: string): SpanPosition {
  if (date < range.from || date > range.to) return null
  if (range.from === range.to) return 'single'
  if (date === range.from) return 'start'
  if (date === range.to) return 'end'
  return 'middle'
}

/**
 * Is this day worth drawing attention to?
 *
 * Overdue only counts for work that is not finished. A task delivered late is
 * a fact for the record, not something to still be flagging in red on a
 * calendar somebody is using to plan the week ahead.
 */
export function isOverdue(task: DatedTask, today: string): boolean {
  if (!task.dueOn) return false
  if (task.status === 'verified' || task.status === 'accepted' || task.status === 'abandoned') return false
  return task.dueOn < today
}
