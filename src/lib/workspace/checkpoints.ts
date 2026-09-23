// The two short questions worth asking, and the many that are not.
//
// ── What this is for ──────────────────────────────────────────────────────
// Everything else Workmark measures is read off timestamps: what moved, when,
// how far off an estimate was. All of it describes what happened and none of
// it knows what the student *meant* to happen.
//
// A stated approach, written down before the work starts, is a prediction.
// The diff afterwards is the outcome. Holding those two next to each other is
// the only thing in this product that can say "you planned a queue and built
// a cron loop" — and that is a genuinely new signal, not a better-formatted
// version of one that already existed.
//
// ── Why it is two questions and not a workflow ────────────────────────────
// A workspace that interrogates you is one people stop opening, and every
// checkpoint that is not worth answering teaches somebody to dismiss the next
// one — including the one that mattered.
//
// So: asked at moments the student is already stopping to think, never on a
// schedule, never twice, and skippable in one click. `skipped_at` exists in
// the schema for exactly that, and a checkpoint you cannot skip is one people
// lie to rather than one they answer.
//
// - `before`  once, when a card enters Doing. The prediction.
// - `blocked` only when they flag themselves blocked. They are already typing
//             a reason, so this costs them nothing extra.
// - `after`   deliberately not built. Submission already asks what changed,
//             and a second prompt at the same moment is the one that gets
//             dismissed.
//
// ── Cost ──────────────────────────────────────────────────────────────────
// Nothing here calls a model. The question is written by the planner in the
// call that created the task, and the answer is read by the verifier in the
// call that checks the work. Capture is free and reasoning happens where it
// is already being paid for.

export type CheckpointKind = 'before' | 'blocked' | 'after'

export interface Checkpoint {
  id: string
  taskId: string
  kind: CheckpointKind
  question: string
  answer: string | null
  askedAt: string | null
  answeredAt: string | null
  skippedAt: string | null
}

/**
 * What to ask before somebody starts, when the planner did not write one.
 *
 * Deliberately about approach rather than intent. "What are you going to try
 * first?" has an answer somebody can give in fifteen seconds and be wrong
 * about, which is what makes it worth comparing with the diff. "How will you
 * approach this task?" invites a paragraph and predicts nothing.
 */
export const DEFAULT_BEFORE = 'What are you going to try first?'

export const BLOCKED_QUESTION = 'What have you tried so far?'

/** How short an answer can be and still be an answer. */
export const MIN_ANSWER = 8

/**
 * Is this checkpoint still waiting?
 *
 * Skipped counts as settled. Somebody who dismissed the question has answered
 * it — with "not now" — and asking again would be the behaviour that makes
 * people stop reading these.
 */
export function isOpen(checkpoint: Checkpoint): boolean {
  return checkpoint.answeredAt === null && checkpoint.skippedAt === null
}

/**
 * Should a `before` checkpoint be created as this card enters Doing?
 *
 * Only on the first entry, and only for a leaf. A parent card entering Doing
 * is a container being opened, not work being started, and asking about its
 * approach would be asking about three different pieces at once.
 */
export function wantsBefore(args: {
  toStatus: string
  hadStartedBefore: boolean
  hasChildren: boolean
  existing: Checkpoint[]
}): boolean {
  if (args.toStatus !== 'doing') return false
  if (args.hadStartedBefore) return false
  if (args.hasChildren) return false
  return !args.existing.some((c) => c.kind === 'before')
}

/**
 * The one waiting to be answered on this task, if any.
 *
 * The board shows at most one. Two questions at once is a form, and a form is
 * a thing people close.
 */
export function pending(checkpoints: Checkpoint[]): Checkpoint | null {
  return checkpoints.find(isOpen) ?? null
}

export function answered(checkpoints: Checkpoint[]): Checkpoint[] {
  return checkpoints.filter((c) => c.answeredAt !== null && (c.answer ?? '').trim().length > 0)
}

/**
 * What a student predicted, for the verifier to read against the diff.
 *
 * Returns an empty string when nothing was answered, and the caller then
 * sends nothing at all rather than a heading with no content underneath — a
 * prompt that says "Stated approach: (none)" invites the model to comment on
 * the absence, which is not the student's failing and not useful to anybody.
 */
export function approachForVerifier(checkpoints: Checkpoint[]): string {
  const said = answered(checkpoints)
  if (said.length === 0) return ''

  return said
    .map((c) => {
      const when = c.kind === 'before'
        ? 'Before starting, they said they would'
        : c.kind === 'blocked'
          ? 'While stuck, they said they had tried'
          : 'Afterwards they said'
      return `${when}: ${(c.answer ?? '').trim()}`
    })
    .join('\n')
}

/**
 * Was the answer long enough to mean anything?
 *
 * Short on purpose. Fifteen words is a real answer to "what will you try
 * first", and a floor set any higher turns a fifteen-second question into a
 * writing task, which is how this feature would start being skipped.
 */
export function answerRefusal(answer: string): string | null {
  return answer.trim().length >= MIN_ANSWER
    ? null
    : 'A few words is enough, but it needs a few.'
}
