// What to ask somebody applying, now that writing code is cheap.
//
// ── Why the old question was worthless ────────────────────────────────────
// It asked "what have you actually built with X?" in 50 to 250 words. That is
// a request for fluent prose about past work, which is the single cheapest
// thing a language model produces, and every student applying has one open in
// another tab. The answers were indistinguishable and the poster learned
// nothing from them.
//
// ── What separates people now ─────────────────────────────────────────────
// Not execution. Deciding what to build, what to cut, and what will break —
// and being willing to commit to an answer. A model hedges, covers both
// sides, and stays general because generality is safe. A person who has read
// this particular brief picks one option and names what they are giving up.
//
// So every question here has the same shape: a forced choice with a
// consequence, answered in under sixty words. None of it is AI-proof and
// pretending otherwise would be dishonest — what it does is make a generated
// answer visibly generic next to a considered one, which a poster can spot in
// seconds. The verified record is the part that cannot be prompted; this is
// the part that says whether somebody thought about the work.

export type QuestionKind = 'cut' | 'tradeoff' | 'risk' | 'assumption' | 'critique'

export interface ApplicationQuestion {
  id: string
  kind: QuestionKind
  prompt: string
  /** Shown under the box. Says what a good answer does, not how to write. */
  hint: string
}

/**
 * The house style for every question, whoever wrote it.
 *
 * Used as the fallback set and as the instruction to the agent that writes
 * listing-specific ones. Kept in one place so a generated question cannot
 * quietly become an essay prompt again.
 */
export const QUESTION_RULES = `Every question must:
- Force one choice with a consequence, never invite an essay or a summary of past work.
- Be answerable in under sixty words by somebody who has read this brief, and be hard to answer well by somebody who has not.
- Be specific to THIS project — name its actual features, constraints or users. A question that would fit any listing is a wasted question.
- Ask what they would do here, not what they have done before. The record already covers what they have done.

Never ask:
- "Tell us about a time you..." or anything else answerable from a CV.
- "Why are you interested in this role?" — nobody has ever learned anything from the answer.
- Anything with a single correct answer, which tests recall rather than judgement.`

/**
 * The questions used when a listing has none of its own.
 *
 * Deliberately still good rather than placeholder. A poster who never runs the
 * generator should get something worth reading, and these two are the kinds
 * that travel best: both need somebody to have actually read the brief, and
 * neither can be answered well in general terms.
 */
export const FALLBACK_QUESTIONS: ApplicationQuestion[] = [
  {
    id: 'fallback-cut',
    kind: 'cut',
    prompt: 'If this had to ship in half the time, what would you cut first — and what breaks if that turns out to be the wrong call?',
    hint: 'Name one thing, and the risk you are accepting. A list of three is a way of not choosing.',
  },
  {
    id: 'fallback-assumption',
    kind: 'assumption',
    prompt: 'What does this brief not tell you that you would need to know? Say what you would assume in the meantime so you could start today.',
    hint: 'The gap, and your working assumption. Not a list of questions for the poster.',
  },
]

export const KIND_LABEL: Record<QuestionKind, string> = {
  cut: 'What you would drop',
  tradeoff: 'The trade you would make',
  risk: 'What breaks first',
  assumption: 'What is missing',
  critique: 'What is wrong with it',
}

/**
 * How many to ask.
 *
 * Two. One is a coin toss and cannot show whether somebody is consistently
 * thoughtful; three is where people abandon a form, and an application nobody
 * finishes teaches the poster nothing about anybody.
 */
export const QUESTION_COUNT = 2

/**
 * Read a listing's stored questions, falling back when there are none.
 *
 * Tolerant on purpose. These come out of a jsonb column written by an agent,
 * so a malformed row must degrade to the fallback rather than leave somebody
 * staring at a drawer with no questions and a permanently grey button.
 */
export function questionsFor(stored: unknown): ApplicationQuestion[] {
  if (!Array.isArray(stored)) return FALLBACK_QUESTIONS

  const parsed = stored
    .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
    .map((q, i) => ({
      id: typeof q.id === 'string' && q.id ? q.id : `q${i}`,
      kind: (typeof q.kind === 'string' && q.kind in KIND_LABEL ? q.kind : 'tradeoff') as QuestionKind,
      prompt: typeof q.prompt === 'string' ? q.prompt : '',
      hint: typeof q.hint === 'string' ? q.hint : '',
    }))
    .filter((q) => q.prompt.length > 10)
    .slice(0, QUESTION_COUNT)

  return parsed.length > 0 ? parsed : FALLBACK_QUESTIONS
}
