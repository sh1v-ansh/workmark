// Talking on a project, and the one rule that keeps it affordable.
//
// Two kinds of message share this table. Teammates talking to each other,
// which costs nothing and should never be mediated by anything. And questions
// put to Workmark, which cost money.
//
// ── The rule that matters ─────────────────────────────────────────────────
// The agent answers only when it is named. Not "when a message looks like a
// question", not "when nobody has replied in an hour" — only when somebody
// typed @workmark. Every other trigger is unbounded spend by construction,
// and worse, an assistant that answers everything is one a team cannot talk
// around. A student asking a teammate "should we just drop the export?" is
// having a conversation, not filing a support ticket.
//
// ── Why threads are per task ──────────────────────────────────────────────
// A task thread carries its own context: the card, its acceptance criteria,
// what the checker said, and the handful of messages above. That is a small
// prompt and a good answer. A project-wide thread would need the whole board
// to answer anything specific, which is both a worse answer and a more
// expensive one.
//
// Pure, so the route and the board agree about who is being addressed and
// when the agent should stop.

/** What the agent answers to. Matched case-insensitively, at a word boundary.
 *  '@lead' is what the board shows, since the agent speaks as the project's
 *  tech lead; '@workmark' still works so older habits and threads do not
 *  silently stop getting answers. */
export const MENTION = '@lead'
const MENTION_PATTERN = '(?:@lead|@workmark)'

/**
 * How many times the agent will answer in one thread.
 *
 * Six, and then it suggests something else. Two reasons, and the second is
 * the important one. A thread that has gone six rounds without resolving is
 * not going to resolve on the seventh — what it needs is a smaller task or a
 * person. And an assistant that will answer forever is one somebody can leave
 * running against a repository all night.
 */
export const MAX_AGENT_TURNS = 6

export interface Message {
  id: string
  taskId: string | null
  senderId: string | null
  senderKind: 'member' | 'agent'
  body: string
  createdAt: string | null
}

/**
 * Is Workmark being asked, or are two people talking?
 *
 * Word boundary rather than a bare `includes`, so "email me at
 * hi@workmarks.org" does not summon anything. The trailing boundary is what
 * that case turns on.
 */
export function mentionsAgent(body: string): boolean {
  return new RegExp(`(^|\\s)${MENTION_PATTERN}\\b`, 'i').test(body)
}

/**
 * The question, with the mention taken out so the agent is not answering its
 * own name.
 *
 * Whitespace is collapsed afterwards, because removing a mention from the
 * middle of a sentence leaves a double space behind and that ends up in the
 * prompt.
 */
export function stripMention(body: string): string {
  return body
    .replace(new RegExp(`(^|\\s)${MENTION_PATTERN}\\b`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface ThreadState {
  /** Messages in this thread, oldest first. */
  messages: Message[]
}

export function agentTurnsUsed(thread: ThreadState): number {
  return thread.messages.filter((m) => m.senderKind === 'agent').length
}

/**
 * Should the agent answer this message?
 *
 * Returns a refusal to show instead, or null to go ahead. A refusal is shown
 * rather than swallowed: somebody who typed @workmark and got silence assumes
 * the feature is broken, and the honest answer — "this thread has gone far
 * enough, here is what to do instead" — is more useful than the seventh
 * reply would have been.
 */
export function shouldAnswer(body: string, thread: ThreadState): string | null {
  if (!mentionsAgent(body)) return 'not-mentioned'
  if (stripMention(body).length < 3) {
    return 'Ask a question after the mention and Workmark will have a go.'
  }
  if (agentTurnsUsed(thread) >= MAX_AGENT_TURNS) {
    return `Workmark has answered ${MAX_AGENT_TURNS} times on this task. If it is still not clear, the task is probably too big — try breaking it up, or ask a teammate.`
  }
  return null
}

/**
 * The last few messages, for context.
 *
 * Bounded because a long thread is mostly people agreeing, and every line is
 * prompt tokens on a call somebody is waiting for. Six is enough to carry
 * what is being discussed without paying for the whole history.
 */
export function recentContext(thread: ThreadState, limit = 6): Message[] {
  return thread.messages.slice(-limit)
}

/**
 * The thread as prose, for the agent to read.
 *
 * Names are deliberately not included — the agent is answering a technical
 * question about a task, and who said what changes nothing about the answer
 * while adding a way to get somebody's name wrong.
 */
export function threadForAgent(thread: ThreadState, limit = 6): string {
  return recentContext(thread, limit)
    .map((m) => `${m.senderKind === 'agent' ? 'Workmark' : 'Student'}: ${m.body}`)
    .join('\n')
}
