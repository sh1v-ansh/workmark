import { describe, it, expect } from 'vitest'
import {
  mentionsAgent, stripMention, shouldAnswer, agentTurnsUsed,
  recentContext, threadForAgent, MAX_AGENT_TURNS,
  type Message, type ThreadState,
} from '../src/lib/workspace/messages'

function msg(extra: Partial<Message> = {}): Message {
  return { id: 'm', taskId: 't', senderId: 'alice', senderKind: 'member', body: 'hi', createdAt: null, ...extra }
}
const thread = (messages: Message[]): ThreadState => ({ messages })

describe('mentionsAgent', () => {
  it('answers when named', () => {
    expect(mentionsAgent('@workmark why is this failing?')).toBe(true)
    expect(mentionsAgent('hey @Workmark any idea?')).toBe(true)
  })

  it('stays out of a conversation between people', () => {
    expect(mentionsAgent('should we just drop the export?')).toBe(false)
  })

  // The case the word boundary exists for. A bare `includes` would summon the
  // agent out of somebody's email address.
  it('is not summoned by an address that contains the word', () => {
    expect(mentionsAgent('mail me at hi@workmarks.org')).toBe(false)
  })

  it('needs a boundary before it too', () => {
    expect(mentionsAgent('team@workmark.org')).toBe(false)
  })
})

describe('stripMention', () => {
  it('leaves the question behind', () => {
    expect(stripMention('@workmark why does the test hang?')).toBe('why does the test hang?')
  })
  it('handles a mention mid-sentence', () => {
    expect(stripMention('hey @workmark any idea?')).toBe('hey any idea?')
  })
})

describe('shouldAnswer', () => {
  it('answers a real question', () => {
    expect(shouldAnswer('@workmark why does this hang?', thread([]))).toBeNull()
  })

  it('says nothing when it was not asked', () => {
    expect(shouldAnswer('drop the export?', thread([]))).toBe('not-mentioned')
  })

  it('asks for an actual question when the mention is bare', () => {
    expect(shouldAnswer('@workmark', thread([]))).toMatch(/Ask a question/i)
  })

  // A thread six rounds deep is not resolving on the seventh, and an
  // assistant that answers forever is one somebody can leave running all
  // night against a repository.
  it('stops after the turn cap and says what to do instead', () => {
    const used = thread(Array.from({ length: MAX_AGENT_TURNS }, (_, i) =>
      msg({ id: `a${i}`, senderKind: 'agent' })))
    expect(shouldAnswer('@workmark one more thing', used)).toMatch(/too big/i)
  })

  it('still answers on the last allowed turn', () => {
    const used = thread(Array.from({ length: MAX_AGENT_TURNS - 1 }, (_, i) =>
      msg({ id: `a${i}`, senderKind: 'agent' })))
    expect(shouldAnswer('@workmark why?', used)).toBeNull()
  })

  // People talking to each other never count against the cap.
  it('does not count member messages towards the cap', () => {
    const chatty = thread(Array.from({ length: 30 }, (_, i) => msg({ id: `m${i}` })))
    expect(agentTurnsUsed(chatty)).toBe(0)
    expect(shouldAnswer('@workmark why?', chatty)).toBeNull()
  })
})

describe('recentContext', () => {
  it('keeps only the last few', () => {
    const t = thread(Array.from({ length: 20 }, (_, i) => msg({ id: `m${i}`, body: `line ${i}` })))
    const got = recentContext(t, 6)
    expect(got).toHaveLength(6)
    expect(got[got.length - 1].body).toBe('line 19')
  })

  it('copes with a thread shorter than the limit', () => {
    expect(recentContext(thread([msg()]), 6)).toHaveLength(1)
  })
})

describe('threadForAgent', () => {
  // Names are left out on purpose: they change nothing about a technical
  // answer and add a way to get somebody's name wrong.
  it('labels by kind rather than by name', () => {
    const text = threadForAgent(thread([
      msg({ body: 'why does this hang?' }),
      msg({ id: 'a', senderKind: 'agent', senderId: null, body: 'Because the lock is held.' }),
    ]))
    expect(text).toBe('Student: why does this hang?\nWorkmark: Because the lock is held.')
    expect(text).not.toMatch(/alice/)
  })
})
