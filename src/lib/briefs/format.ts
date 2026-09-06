/**
 * A brief is stored as one text column shaped "Title\n\nBody".
 *
 * That is a slightly odd storage decision and it is the existing one, so
 * this is where it gets read. It was being re-implemented at each call site,
 * and the second implementation split on a single newline rather than a
 * blank line — which silently truncates every title at the first line wrap.
 * One function, so the format has one definition.
 */
export interface SplitBrief {
  title: string
  body: string
}

/** A first "line" longer than this is a paragraph that happens to be first. */
const MAX_TITLE_CHARS = 100

export function splitBriefText(text: string | null | undefined): SplitBrief {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return { title: 'Untitled project', body: '' }

  const [first, ...rest] = trimmed.split('\n\n')
  const title = first.replace(/^#+\s*/, '').trim()
  const body = rest.join('\n\n').trim()

  // No blank line, or a first paragraph too long to be a heading: keep the
  // whole thing as the body rather than putting a paragraph in an <h2>.
  if (!body || title.length > MAX_TITLE_CHARS) {
    return { title: 'A project for you', body: trimmed }
  }
  return { title, body }
}
