import { describe, it, expect } from 'vitest'
import {
  blockers, canSubmit, countWords, toneFor,
  MIN_ANSWER_WORDS, MAX_ANSWER_WORDS, type ApplicationDraft,
} from '../src/lib/applications/gate'
import { questionsFor, FALLBACK_QUESTIONS, QUESTION_COUNT } from '../src/lib/applications/questions'

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')

function draft(extra: Partial<ApplicationDraft> = {}): ApplicationDraft {
  return {
    answers: [
      { questionId: 'a', text: words(MIN_ANSWER_WORDS) },
      { questionId: 'b', text: words(MIN_ANSWER_WORDS) },
    ],
    consented: true,
    questionCount: 2,
    ...extra,
  }
}

describe('countWords', () => {
  it('is zero for empty and whitespace', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n ')).toBe(0)
  })
  it('collapses runs of whitespace', () => {
    expect(countWords('one   two\n\nthree')).toBe(3)
  })
})

describe('blockers', () => {
  it('is empty when everything is done', () => {
    expect(blockers(draft())).toEqual([])
    expect(canSubmit(draft())).toBe(true)
  })

  // The actual bug: ticking every skill and writing something short left a
  // grey button with no reason on it.
  it('says how many answers are still too short', () => {
    const d = draft({ answers: [{ questionId: 'a', text: words(3) }, { questionId: 'b', text: words(MIN_ANSWER_WORDS) }] })
    expect(blockers(d)[0]).toMatch(/1 question still needs/i)
  })

  it('names the minimum when nothing is answered', () => {
    const d = draft({ answers: [{ questionId: 'a', text: '' }, { questionId: 'b', text: '' }] })
    expect(blockers(d)[0]).toMatch(new RegExp(`${MIN_ANSWER_WORDS} words`))
  })

  it('catches an answer that is too long', () => {
    const d = draft({ answers: [{ questionId: 'a', text: words(MAX_ANSWER_WORDS + 5) }, { questionId: 'b', text: words(20) }] })
    expect(blockers(d).some((b) => /over 60 words/i.test(b))).toBe(true)
  })

  // Last in the list because it is one click and everything above is work.
  it('asks for consent last', () => {
    const d = draft({ consented: false, answers: [{ questionId: 'a', text: '' }, { questionId: 'b', text: '' }] })
    expect(blockers(d)).toHaveLength(2)
    expect(blockers(d)[1]).toMatch(/verified record/i)
  })

  it('blocks on consent alone', () => {
    expect(canSubmit(draft({ consented: false }))).toBe(false)
  })
})

describe('toneFor', () => {
  it('marks an empty or short answer as short, not fine', () => {
    expect(toneFor(0)).toBe('short')
    expect(toneFor(MIN_ANSWER_WORDS - 1)).toBe('short')
  })
  it('is ok inside the range', () => {
    expect(toneFor(MIN_ANSWER_WORDS)).toBe('ok')
    expect(toneFor(MAX_ANSWER_WORDS)).toBe('ok')
  })
  it('is over past the limit', () => {
    expect(toneFor(MAX_ANSWER_WORDS + 1)).toBe('over')
  })
})

describe('questionsFor', () => {
  it('falls back when a listing has none', () => {
    expect(questionsFor(null)).toEqual(FALLBACK_QUESTIONS)
    expect(questionsFor([])).toEqual(FALLBACK_QUESTIONS)
  })

  // These come out of a jsonb column written by an agent. A malformed row
  // must not leave somebody staring at a drawer with no questions.
  it('falls back on malformed rows rather than rendering nothing', () => {
    expect(questionsFor([{ nope: 1 }, 'string'])).toEqual(FALLBACK_QUESTIONS)
  })

  it('reads well-formed questions', () => {
    const q = questionsFor([{ id: 'x', kind: 'cut', prompt: 'What would you drop and why?', hint: 'One thing.' }])
    expect(q).toHaveLength(1)
    expect(q[0].kind).toBe('cut')
  })

  it('never asks more than the cap', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, kind: 'risk', prompt: 'A long enough prompt here', hint: '' }))
    expect(questionsFor(many)).toHaveLength(QUESTION_COUNT)
  })

  it('defaults an unknown kind rather than dropping the question', () => {
    expect(questionsFor([{ id: 'x', kind: 'nonsense', prompt: 'A long enough prompt here', hint: '' }])[0].kind).toBe('tradeoff')
  })
})
