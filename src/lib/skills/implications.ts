// "Using X means you used Y."
//
// The scan recorded the tool a student named and stopped there, which is
// why a project built on Supabase — a Postgres database, with SQL
// migrations and row-level security — recorded "Supabase" and never
// "PostgreSQL". The dependency list says the tool; the skill underneath it
// has to be stated somewhere, and this is that somewhere.
//
// Rules here must be things that are ALWAYS true, not usually true.
// Supabase is Postgres, full stop. Prisma is not any particular database —
// its schema file says which, so that's a detector's job (see
// parsePrismaSchema), not a rule here. When in doubt, leave it out: a wrong
// implication puts a skill on someone's record that they can't defend in a
// dispute, which is worse than a missing one they can add later.
//
// Keys and values are taxonomy skill ids (see seed_skills_taxonomy.sql),
// applied after canonicalization so an alias like "supabase-js" and a
// display name like "Supabase" both land on the same rule.

/** skill id -> skill ids it necessarily implies. */
export const SKILL_IMPLIES: Record<string, string[]> = {
  // Managed Postgres. The whole product is a Postgres database.
  'supabase-platform': ['postgresql', 'sql'],

  // Every relational database implies SQL. Someone with Postgres evidence
  // and no SQL on their record is a gap that reads as an error.
  'postgresql': ['sql'],
  'mysql': ['sql'],
  'sqlite': ['sql'],

  // Orchestration implies the thing being orchestrated.
  'kubernetes': ['docker'],
}

/**
 * Expand a set of detected skill ids with everything they imply.
 *
 * Runs to a fixed point so a chain resolves in one call — Supabase implies
 * Postgres, and Postgres implies SQL, so Supabase alone yields all three.
 * Iteration is capped because a cycle in the table (a → b → a) would
 * otherwise spin forever, and the table is hand-maintained.
 */
export function applyImplications(skillIds: Iterable<string>): {
  all: Set<string>
  /** implied id -> the id that caused it, for provenance. */
  causedBy: Map<string, string>
} {
  const all = new Set(skillIds)
  const causedBy = new Map<string, string>()

  for (let pass = 0; pass < 5; pass++) {
    let grew = false
    for (const id of Array.from(all)) {
      for (const implied of SKILL_IMPLIES[id] ?? []) {
        if (all.has(implied)) continue
        all.add(implied)
        causedBy.set(implied, id)
        grew = true
      }
    }
    if (!grew) break
  }

  return { all, causedBy }
}
