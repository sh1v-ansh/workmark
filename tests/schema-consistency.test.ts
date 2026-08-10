import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Static check that every table and column the app queries actually
// exists in schema.sql.
//
// This catches the single most expensive bug class in this project's
// history: the Phase 0 rebuild dropped tables that pages kept querying,
// and nothing surfaced it until a page 500'd against production. A
// TypeScript build can't catch it — supabase-js takes table and column
// names as plain strings — so it needs its own check.
//
// It parses the schema rather than hitting a database, so it runs in CI
// with no credentials and fails the moment code and schema diverge.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf-8')

/** Strip SQL line comments so commented-out DDL never counts as real. */
function stripComments(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, '')
}

function parseTables(sql: string): Map<string, Set<string>> {
  const clean = stripComments(sql)
  const tables = new Map<string, Set<string>>()
  const tableRe = /create table (?:if not exists )?([a-z_]+)\s*\(([\s\S]*?)\n\);/g
  let m: RegExpExecArray | null
  while ((m = tableRe.exec(clean)) !== null) {
    const [, name, body] = m
    const cols = new Set<string>()
    for (const line of body.split('\n')) {
      // A column definition starts a line with an identifier; constraints
      // (primary key, unique, check, foreign key) do not name new columns.
      const col = line.match(/^\s{2}([a-z_]+)\s+/)
      if (col && !['primary', 'unique', 'check', 'foreign', 'constraint'].includes(col[1])) {
        cols.add(col[1])
      }
    }
    tables.set(name, cols)
  }

  // ALTER TABLE ... ADD COLUMN, so migrations mirrored into schema.sql count.
  const alterRe = /alter table ([a-z_]+)[\s\S]*?add column (?:if not exists )?([a-z_]+)/g
  while ((m = alterRe.exec(clean)) !== null) {
    tables.get(m[1])?.add(m[2])
  }
  return tables
}

function parseViews(sql: string, tables: Map<string, Set<string>>): Map<string, Set<string>> {
  const clean = stripComments(sql)
  const views = new Map<string, Set<string>>()
  const viewRe = /create (?:or replace )?view ([a-z_]+) as\s*select\s+([\s\S]*?)\nfrom\s+([a-z_]+)/g
  let m: RegExpExecArray | null
  while ((m = viewRe.exec(clean)) !== null) {
    const [, viewName, selectList, sourceTable] = m
    // `select se.*` inherits every column of the source table.
    views.set(
      viewName,
      /\*/.test(selectList) ? new Set(tables.get(sourceTable) ?? []) : new Set(),
    )
  }
  return views
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, acc)
    else if (/\.(ts|tsx)$/.test(full)) acc.push(full)
  }
  return acc
}

const TABLES = parseTables(SCHEMA)
const VIEWS = parseViews(SCHEMA, TABLES)
const QUERYABLE = new Map([...TABLES, ...VIEWS])
const FILES = sourceFiles(path.join(ROOT, 'src'))

/**
 * Splits a PostgREST select list at top level, so an embedded resource
 * like `listings(title, poster_id)` stays one item instead of leaking
 * its inner columns into the parent's column check.
 */
function splitSelect(select: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of select) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

describe('schema.sql parses', () => {
  it('finds the expected core tables', () => {
    for (const t of ['students', 'listings', 'applications', 'engagements', 'skill_evidence', 'artifacts', 'disputes']) {
      expect(TABLES.has(t), `missing table ${t}`).toBe(true)
    }
  })

  it('finds the current_skill_evidence view and inherits its columns', () => {
    expect(VIEWS.has('current_skill_evidence')).toBe(true)
    // `select se.*` — so anything on skill_evidence is readable through it.
    expect(VIEWS.get('current_skill_evidence')!.has('difficulty_cleared')).toBe(true)
    expect(VIEWS.get('current_skill_evidence')!.has('retracted_at')).toBe(true)
  })

  it('picks up columns added via alter table', () => {
    expect(TABLES.get('github_repo_grants')!.has('scan_enabled')).toBe(true)
    expect(TABLES.get('skill_evidence')!.has('retracted_at')).toBe(true)
  })
})

describe('every table the app queries exists', () => {
  it('has no .from() against an unknown table', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = readFileSync(file, 'utf-8')
      for (const m of src.matchAll(/\.from\(['"]([a-z_]+)['"]\)/g)) {
        if (!QUERYABLE.has(m[1])) {
          offenders.push(`${path.relative(ROOT, file)} → ${m[1]}`)
        }
      }
    }
    expect(offenders, `queries against tables not in schema.sql:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('every column the app selects exists', () => {
  it('has no .select() naming an unknown column', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = readFileSync(file, 'utf-8')
      // Only literal .from('x').select('...') pairs on the same line or
      // adjacent — a dynamically built query isn't statically checkable,
      // and this deliberately checks what it can rather than nothing.
      for (const m of src.matchAll(/\.from\(['"]([a-z_]+)['"]\)\s*\n?\s*\.select\(\s*['"]([^'"]+)['"]/g)) {
        const [, table, select] = m
        const cols = QUERYABLE.get(table)
        if (!cols || cols.size === 0) continue

        for (const part of splitSelect(select)) {
          if (part === '*' || part.includes('(')) continue // embeds checked separately
          const bare = part.split(':').pop()!.trim() // handle `alias:column`
          if (!bare || bare === '*') continue
          if (!cols.has(bare)) {
            offenders.push(`${path.relative(ROOT, file)} → ${table}.${bare}`)
          }
        }
      }
    }
    expect(offenders, `selects of columns not in schema.sql:\n${offenders.join('\n')}`).toEqual([])
  })

  it('has no embedded resource naming an unknown table', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = readFileSync(file, 'utf-8')
      for (const m of src.matchAll(/\.select\(\s*['"]([^'"]+)['"]/g)) {
        for (const part of splitSelect(m[1])) {
          const embed = part.match(/^([a-z_]+)\(/)
          if (embed && !QUERYABLE.has(embed[1])) {
            offenders.push(`${path.relative(ROOT, file)} → ${embed[1]}(...)`)
          }
        }
      }
    }
    expect(offenders, `embedded resources not in schema.sql:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('columns the app writes exist', () => {
  it('has no .eq()/.is() filter on an unknown column', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = readFileSync(file, 'utf-8')
      // The chain must stop at the next .from( — inside a Promise.all
      // several queries sit adjacent, and a greedy window would attribute
      // the second query's filters to the first query's table.
      for (const m of src.matchAll(/\.from\(['"]([a-z_]+)['"]\)((?:(?!\.from\()[\s\S]){0,400})/g)) {
        const [, table, chain] = m
        const cols = QUERYABLE.get(table)
        if (!cols || cols.size === 0) continue
        for (const f of chain.matchAll(/\.(?:eq|neq|is|gte|lte|gt|lt|in)\(\s*['"]([a-z_]+)['"]/g)) {
          if (!cols.has(f[1])) offenders.push(`${path.relative(ROOT, file)} → ${table}.${f[1]}`)
        }
      }
    }
    expect(offenders, `filters on columns not in schema.sql:\n${offenders.join('\n')}`).toEqual([])
  })

  it('has no .insert()/.update()/.upsert() naming an unknown column', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = readFileSync(file, 'utf-8')
      for (const m of src.matchAll(
        /\.from\(['"]([a-z_]+)['"]\)\s*\n?\s*\.(?:insert|update|upsert)\(\s*\{([\s\S]*?)\n\s*\}/g,
      )) {
        const [, table, objectBody] = m
        const cols = QUERYABLE.get(table)
        if (!cols || cols.size === 0) continue
        // Top-level keys only — a nested object is a jsonb value, and its
        // keys are data rather than column names.
        let depth = 0
        for (const line of objectBody.split('\n')) {
          const key = depth === 0 ? line.match(/^\s*([a-z_]+)\s*:/) : null
          if (key && !cols.has(key[1])) {
            offenders.push(`${path.relative(ROOT, file)} → ${table}.${key[1]}`)
          }
          depth += (line.match(/[{[]/g) ?? []).length - (line.match(/[}\]]/g) ?? []).length
        }
      }
    }
    expect(offenders, `writes to columns not in schema.sql:\n${offenders.join('\n')}`).toEqual([])
  })
})
