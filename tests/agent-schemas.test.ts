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
  // Schemas are no longer policed keyword by keyword — client.ts runs every
  // one through the SDK's transformJSONSchema, which keeps what structured
  // outputs supports and folds the rest into the description. What matters is
  // that it is still being applied: without it, an unsupported keyword is a
  // 400 on every call to that agent, discovered only by deploying.
  it('sends every schema through the SDK transform', () => {
    const client = readFileSync(path.join(AGENTS, 'client.ts'), 'utf-8')
    expect(client).toMatch(/import \{ transformJSONSchema \}/)
    expect(client).toMatch(/schema: transformJSONSchema\(args\.schema\)/)
    // And nothing bypasses it by building its own request.
    const bypass = agentSources().filter(
      (a) => a.file !== 'client.ts' && /output_config|messages\.create\(/.test(a.text),
    )
    expect(bypass.map((b) => b.file)).toEqual([])
  })

  // What the transform actually keeps, pinned so an SDK upgrade that narrows
  // it fails here rather than in production.
  it('keeps the keywords our schemas rely on', async () => {
    const { transformJSONSchema } = await import('@anthropic-ai/sdk/lib/transform-json-schema')
    const out = transformJSONSchema({
      type: 'object',
      properties: { xs: { type: 'array', minItems: 5, items: { type: 'string' } } },
      required: ['xs'],
      additionalProperties: false,
    }) as Record<string, unknown>

    expect(out.type).toBe('object')
    expect(out.required).toEqual(['xs'])
    expect(out.additionalProperties).toBe(false)
    // The unsupported floor survives as an instruction rather than vanishing.
    const xs = (out.properties as Record<string, { description?: string }>).xs
    expect(xs.description).toMatch(/minItems/)
  })

  it('has at least one schema to check, so this cannot pass by finding nothing', () => {
    const withSchemas = agentSources().filter((a) => a.text.includes('const SCHEMA'))
    expect(withSchemas.length).toBeGreaterThan(3)
  })
})
