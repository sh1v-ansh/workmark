import { Fragment } from 'react'
import { C, F } from '@/lib/theme/dark-tokens'

/**
 * A small, safe markdown renderer for AI-written text (project briefs).
 *
 * Handles what those texts use: # / ## / ### headings, - and 1. lists,
 * paragraphs, **bold**, *italic* and `code`. Everything is built as React
 * elements, never injected as HTML, so model output cannot put markup or
 * scripts on the page. Half-written input (mid-stream) renders sensibly.
 */
export default function Markdown({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks = parseBlocks(text)
  return (
    <div style={{ display: 'grid', gap: compact ? 8 : 12 }}>
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          const size = b.level === 1 ? 20 : b.level === 2 ? 15 : 14
          return (
            <p key={i} style={{
              fontFamily: F.display, fontSize: size, fontWeight: 600, color: C.text,
              letterSpacing: '-0.01em', marginTop: i === 0 ? 0 : 4,
            }}>
              {inline(b.text)}
            </p>
          )
        }
        if (b.kind !== 'p') {
          const List = b.kind === 'ul' ? 'ul' : 'ol'
          return (
            <List key={i} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 5, fontSize: 14, lineHeight: 1.6, color: C.textSub, listStyle: b.kind === 'ul' ? 'disc' : 'decimal' }}>
              {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
            </List>
          )
        }
        return (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: C.textSub }}>{inline(b.text)}</p>
        )
      })}
    </div>
  )
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }

function parseBlocks(text: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') })
    para = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const bullet = line.match(/^[-*]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    if (!line) { flush(); continue }
    if (heading) { flush(); out.push({ kind: 'h', level: heading[1].length, text: heading[2] }); continue }
    if (bullet || numbered) {
      flush()
      const kind = bullet ? 'ul' : 'ol'
      const item = (bullet ?? numbered)![1]
      const last = out[out.length - 1]
      if (last && last.kind === kind) last.items.push(item)
      else out.push({ kind, items: [item] })
      continue
    }
    para.push(line)
  }
  flush()
  return out
}

/** **bold**, *italic* and `code`, as elements. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(part)) return <code key={i} style={{ fontFamily: F.mono, fontSize: '0.92em', background: C.surfaceAlt, padding: '1px 5px', borderRadius: 4 }}>{part.slice(1, -1)}</code>
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

export { briefSummary, briefTime } from '@/lib/briefs/parse'
