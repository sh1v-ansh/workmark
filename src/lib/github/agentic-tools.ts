import { detection, type Detection } from './detectors'

/**
 * Which AI coding tools a repository shows evidence of.
 *
 * The taxonomy has had claude-code, cursor-ai and github-copilot in it since
 * the beginning, each with a comment describing the artifact that would
 * prove it. Nothing ever read those artifacts, so all three were unreachable
 * — a student who had built their whole project with Claude Code got no
 * credit for it, because nothing looked.
 *
 * Three signals, strongest first:
 *
 *   contributor — the tool's bot account appears in the repo's contributor
 *                 list. It committed. There is nothing to argue about.
 *   co-author   — a Co-Authored-By trailer on the student's own commits.
 *                 This is how Claude Code actually marks its work, so in
 *                 practice it is the signal that fires most.
 *   config      — a CLAUDE.md, a .cursorrules, a copilot-instructions file.
 *                 Real and checkable, but it proves the repo was set up for
 *                 the tool rather than that the tool did anything.
 *
 * All three are weaker than a dependency in a lockfile, and one of them is
 * weaker than it looks: a commit trailer is a line of text the author
 * controls, so a determined student could write one by hand. That is worth
 * knowing and not worth guarding against — the same is true of a README,
 * and the cost of a wrong answer here is a chip on a profile rather than a
 * level on a skill anyone hires against.
 */

interface ToolSignature {
  /** The taxonomy token this canonicalizes to. */
  raw: string
  label: string
  /** Bot logins, lowercased, that mean this tool committed. */
  logins: string[]
  /** Matched against Co-Authored-By trailer values, lowercased. */
  coAuthors: RegExp
  /** Matched against repository paths. */
  configPaths: RegExp
}

const TOOLS: ToolSignature[] = [
  {
    raw: 'Claude Code',
    label: 'Claude Code',
    logins: ['claude', 'claude[bot]', 'claude-code', 'claude-code[bot]', 'anthropic-claude[bot]'],
    // "Claude <noreply@anthropic.com>", "Claude Opus 4.5 <noreply@anthropic.com>",
    // "Claude Code <...>" — the display name varies by version, the address
    // does not, so the address is what this leans on.
    coAuthors: /(^|\s|<)(claude[^<]*<[^>]*@anthropic\.com>|claude(\s+code)?\s*<)/i,
    configPaths: /^(claude\.md|\.claude\/)/i,
  },
  {
    raw: 'GitHub Copilot',
    label: 'GitHub Copilot',
    logins: ['copilot', 'copilot[bot]', 'github-copilot[bot]', 'copilot-swe-agent[bot]'],
    coAuthors: /copilot[^<]*<[^>]*(github\.com|users\.noreply\.github\.com)>/i,
    configPaths: /^(\.github\/copilot-instructions\.md)/i,
  },
  {
    raw: 'Cursor',
    label: 'Cursor',
    logins: ['cursoragent', 'cursor[bot]', 'cursor-agent[bot]'],
    coAuthors: /cursoragent|cursor[^<]*<[^>]*cursor\.(com|sh)>/i,
    configPaths: /^(\.cursorrules|\.cursor\/)/i,
  },
]

export interface AgenticToolInput {
  /** Every contributor login on the repo, from the contributor stats. */
  contributorLogins: string[]
  /** The student's own commit messages, for their trailers. */
  commitMessages: string[]
  /** Every path in the repo tree. */
  paths: string[]
}

/**
 * `where` is written for the student, because it is what the record shows
 * them when they ask why a skill is on it. "A bot committed" is not an
 * answer; "claude[bot] is a contributor" is.
 */
export function detectAgenticTools(input: AgenticToolInput): Detection[] {
  const logins = new Set(input.contributorLogins.map((l) => l.toLowerCase()))
  const found: Detection[] = []

  for (const tool of TOOLS) {
    const login = tool.logins.find((l) => logins.has(l))
    if (login) {
      found.push(detection(tool.raw, 'collaboration', `${login} is a contributor`))
      continue
    }

    // Only the trailers, not the whole message. A commit that says "stop
    // using copilot for this" is not evidence of using Copilot.
    const coAuthored = input.commitMessages.some((message) =>
      trailerValues(message).some((value) => tool.coAuthors.test(value)),
    )
    if (coAuthored) {
      found.push(detection(tool.raw, 'collaboration', `co-authored ${tool.label} commits`))
      continue
    }

    const path = input.paths.find((p) => tool.configPaths.test(p))
    if (path) {
      found.push(detection(tool.raw, 'collaboration', path))
    }
  }

  return found
}

/** The value side of every Co-Authored-By trailer in a commit message. */
export function trailerValues(message: string): string[] {
  const values: string[] = []
  for (const line of (message ?? '').split('\n')) {
    const match = /^\s*co-authored-by:\s*(.+)$/i.exec(line)
    if (match) values.push(match[1].trim())
  }
  return values
}
