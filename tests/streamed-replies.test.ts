import { describe, it, expect } from 'vitest'
import { splitHelperReply } from '@/lib/agents/helper'
import { parseScopeReply } from '@/lib/agents/kickoff'

describe('splitHelperReply', () => {
  it('keeps a plain answer as the body', () => {
    expect(splitHelperReply('Check the env file.')).toEqual({ body: 'Check the env file.', suggestedSubtask: null })
  })
  it('pulls the subtask line out of the body', () => {
    const out = splitHelperReply('You need the database running first.\nSUBTASK: Set up local Postgres | The API cannot start without it')
    expect(out.body).toBe('You need the database running first.')
    expect(out.suggestedSubtask).toEqual({ title: 'Set up local Postgres', why: 'The API cannot start without it' })
  })
})

describe('parseScopeReply', () => {
  it('reads the verdict and both paragraphs', () => {
    const out = parseScopeReply('VERDICT: scattered\n\nThree unrelated areas.\n\nFinish the API first.')
    expect(out).toEqual({ verdict: 'scattered', reasoning: 'Three unrelated areas.', suggestion: 'Finish the API first.' })
  })
  it('never falls to worth_it when the verdict is missing', () => {
    expect(parseScopeReply('No verdict here.').verdict).toBe('light')
  })
})
