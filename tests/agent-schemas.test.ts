import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Every agent schema, checked against what structured outputs actually
 * accepts — rather than against what JSON Schema allows.
 *
 * This exists because two schemas shipped with `minItems` above 1 and every
 * call to both returned 400. Nothing caught it: the schemas are valid JSON
 * Schema, TypeScript is happy with them, and the failure only appears when a
 * real request is made. A unit test that reads the source is the cheapest
 * thing that can fail on the way in.
 */

const AGENTS = path.join(process.cwd(), 'src/lib/agents')

function agentSources(): { file: string; text: string }[] {
  return readdirSync(AGENTS)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(path.join(AGENTS, f), 'utf-8') }))
}

describe('structured output schemas', () => {
  // "For 'array' type, 'minItems' values other than 0 or 1 are not supported".
  // A floor higher than one belongs in the prompt and in a check after
  // parsing, not in the schema.
  it('never sets minItems above 1', () => {
    const offenders: string[] = []
    for (const { file, text } of agentSources()) {
      for (const m of text.matchAll(/minItems:\s*([A-Za-z0-9_]+)/g)) {
        const raw = m[1]
        const value = /^\d+$/.test(raw) ? Number(raw) : null
        // A named constant is a floor somebody meant, which is exactly the
        // mistake — only a literal 0 or 1 is safe here.
        if (value === null || value > 1) offenders.push(`${file}: minItems: ${raw}`)
      }
    }
    expect(offenders, `structured outputs rejects these:\n${offenders.join('\n')}`).toEqual([])
  })

  it('has at least one schema to check, so this cannot pass by finding nothing', () => {
    const withSchemas = agentSources().filter((a) => a.text.includes('const SCHEMA'))
    expect(withSchemas.length).toBeGreaterThan(3)
  })
})
