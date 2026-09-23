import type { SupabaseClient } from '@supabase/supabase-js'

/** One student on the People tab of Find work. */
export interface PersonCard {
  id: string
  name: string
  line: string
  availability: string | null
  handle: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  /** Their strongest verified skills, best first. */
  topSkills: { name: string; level: number }[]
}

/** A project the viewer can invite somebody into. */
export interface InvitableProject {
  id: string
  title: string
}

const TOP_SKILLS = 5
const MAX_PEOPLE = 60

/**
 * Students who chose to be found, for the People tab.
 *
 * The rows come through the viewer's own session, so the directory policy
 * decides who is visible: only students with open_to_collab on. Only the
 * basic, self-described columns are selected here.
 *
 * Their verified skills are read with the service role, and only for those
 * students. Opting in to being found is opting in to being judged on your
 * work, and the skill names and levels are what a public profile already
 * shows. Nothing deeper (evidence, track record) leaves this function.
 */
export async function loadPeople(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  viewerId: string,
): Promise<PersonCard[]> {
  const { data: rows } = await supabase
    .from('students')
    .select('id, full_name, university, major, degree_type, graduation_year, availability, github_url, linkedin_url, handle')
    .eq('open_to_collab', true)
    .neq('id', viewerId)
    .order('created_at', { ascending: false })
    .limit(MAX_PEOPLE)
  const people = rows ?? []
  if (people.length === 0) return []

  const { data: evidence } = await admin
    .from('current_skill_evidence')
    .select('student_id, skill_id, difficulty_cleared, skills(canonical_name)')
    .in('student_id', people.map((p) => p.id))

  const best = new Map<string, Map<string, { name: string; level: number }>>()
  for (const e of evidence ?? []) {
    const name = (e.skills as unknown as { canonical_name: string } | null)?.canonical_name ?? e.skill_id
    const mine = best.get(e.student_id) ?? new Map<string, { name: string; level: number }>()
    const seen = mine.get(e.skill_id)
    if (!seen || e.difficulty_cleared > seen.level) mine.set(e.skill_id, { name, level: e.difficulty_cleared })
    best.set(e.student_id, mine)
  }

  return people.map((p) => ({
    id: p.id,
    name: p.full_name ?? 'Student',
    line: [
      [p.degree_type, p.major].filter(Boolean).join(' '),
      p.university,
      p.graduation_year ? `Class of ${p.graduation_year}` : null,
    ].filter(Boolean).join(' · '),
    availability: p.availability ?? null,
    handle: p.handle ?? null,
    githubUrl: p.github_url ?? null,
    linkedinUrl: p.linkedin_url ?? null,
    topSkills: Array.from(best.get(p.id)?.values() ?? [])
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))
      .slice(0, TOP_SKILLS),
  }))
}

/** Projects the viewer owns and could invite somebody into. */
export async function loadInvitableProjects(
  supabase: SupabaseClient,
  viewerId: string,
): Promise<InvitableProject[]> {
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, title, status)')
    .eq('account_id', viewerId)
    .eq('role', 'owner')
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
  return (data ?? [])
    .map((row) => row.workspaces as unknown as { id: string; title: string; status: string } | null)
    .filter((w): w is { id: string; title: string; status: string } => !!w && w.status !== 'closed' && w.status !== 'abandoned')
    .map((w) => ({ id: w.id, title: w.title }))
}
