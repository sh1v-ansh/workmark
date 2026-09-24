/** Shared by the server (saving a brief) and the page (showing one as it streams). */

/** How long the brief says it takes, as the 1 to 5 the table stores. */
const TIME_TO_DIFFICULTY: [RegExp, number][] = [
  [/weekend/i, 1],
  [/few days/i, 2],
  [/week or two/i, 3],
  [/several weeks/i, 4],
  [/month/i, 5],
]

/**
 * Split a streamed brief into its title, the markdown body stored and shown,
 * and the difficulty read from its **Time:** line.
 */
export function parseBriefMarkdown(text: string): { title: string; body: string; difficulty: number } {
  const trimmed = text.trim()
  const lines = trimmed.split('\n')
  const titleLine = lines.findIndex((l) => /^#\s+/.test(l))
  const title = titleLine >= 0 ? lines[titleLine].replace(/^#\s+/, '').trim() : 'A project for you'
  const body = (titleLine >= 0 ? lines.slice(titleLine + 1) : lines).join('\n').trim()
  const time = body.match(/\*\*Time:\*\*\s*(.+)/)?.[1] ?? ''
  const difficulty = TIME_TO_DIFFICULTY.find(([re]) => re.test(time))?.[1] ?? 3
  return { title: title.slice(0, 120), body, difficulty }
}


/** Plain text of a markdown brief: the "What you'll build" paragraph, or the first paragraph. For cards. */
export function briefSummary(body: string): string {
  const section = body.match(/##\s*What you'll build\s*\n+([\s\S]*?)(\n##|\n*$)/i)?.[1]
  const firstPara = body.split('\n\n').find((p) => p.trim() && !/^(#|\*\*Time)/.test(p.trim()))
  return (section ?? firstPara ?? body).replace(/[*`#]/g, '').replace(/\s+/g, ' ').trim()
}

/** The **Time:** line of a brief, if it has one. */
export function briefTime(body: string): string | null {
  return body.match(/\*\*Time:\*\*\s*(.+)/)?.[1]?.trim() ?? null
}
