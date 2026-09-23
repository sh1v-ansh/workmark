// What still stands between somebody and sending an application.
//
// ── The bug this replaces ─────────────────────────────────────────────────
// The submit button was disabled by `consented && words >= 50 && words <= 250`
// and said nothing about which of the three was failing. The skill ticks —
// the most visible control in the drawer — fed into none of it, so somebody
// could tick every requirement, write three careful sentences, and watch a
// grey button do nothing. The word counter did say "12 more needed", in the
// same faint grey it used for "good", so the one hint present read as status
// rather than as the reason.
//
// A disabled control that will not say why is the most annoying thing an
// interface can do, and here it sat at the end of the only flow that matters
// to a student.
//
// Pure so the drawer and the route give the same answer, and so the rules are
// arguable in a test rather than inferred from a button that will not move.

/**
 * How long an answer has to be.
 *
 * Short on purpose, and much shorter than the 50–250 words this replaces.
 * Length is where a language model wins: a fluent 200-word paragraph is the
 * cheapest thing in the world to generate and tells a poster nothing. Sixty
 * words forces a choice instead of an essay, and a considered choice is
 * visibly different from a generated one in a way prose is not.
 */
export const MIN_ANSWER_WORDS = 15
export const MAX_ANSWER_WORDS = 60

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export interface AnswerState {
  questionId: string
  text: string
}

export interface ApplicationDraft {
  answers: AnswerState[]
  consented: boolean
  /** How many questions this listing asks. */
  questionCount: number
}

/**
 * Everything still missing, in the order somebody would fix it.
 *
 * A list rather than a boolean, because the button needs a reason to show and
 * "something is wrong" is not one. Empty means ready to send.
 */
export function blockers(draft: ApplicationDraft): string[] {
  const out: string[] = []

  const answered = draft.answers.filter((a) => countWords(a.text) >= MIN_ANSWER_WORDS).length
  if (answered < draft.questionCount) {
    const left = draft.questionCount - answered
    out.push(
      left === draft.questionCount
        ? `Answer ${draft.questionCount === 1 ? 'the question' : 'both questions'} — at least ${MIN_ANSWER_WORDS} words each.`
        : `${left} question${left === 1 ? '' : 's'} still needs at least ${MIN_ANSWER_WORDS} words.`,
    )
  }

  const tooLong = draft.answers.filter((a) => countWords(a.text) > MAX_ANSWER_WORDS).length
  if (tooLong > 0) {
    out.push(`${tooLong === 1 ? 'An answer is' : `${tooLong} answers are`} over ${MAX_ANSWER_WORDS} words.`)
  }

  // Last, because it is one click and everything above is work.
  if (!draft.consented) out.push('Agree to share your verified record.')

  return out
}

export function canSubmit(draft: ApplicationDraft): boolean {
  return blockers(draft).length === 0
}

/**
 * How to colour a word count.
 *
 * Three states, not two. The old counter styled only "over the limit", so
 * being under the minimum — the far more common way to be stuck — looked
 * identical to being finished.
 */
export type CountTone = 'short' | 'ok' | 'over'

export function toneFor(words: number): CountTone {
  if (words === 0) return 'short'
  if (words < MIN_ANSWER_WORDS) return 'short'
  if (words > MAX_ANSWER_WORDS) return 'over'
  return 'ok'
}
