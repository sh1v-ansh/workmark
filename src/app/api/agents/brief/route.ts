import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateBrief } from '@/lib/agents/brief'
import { agentsAvailable } from '@/lib/agents/client'

// A brief is cheap to generate and worthless in bulk — the point is one
// project the student actually builds, not a catalogue to browse. The cap
// is on unstarted briefs specifically, so completing one always frees a
// slot; a student who keeps building never hits it.
const MAX_OPEN_BRIEFS = 5

/**
 * POST /api/agents/brief
 *
 * Generates a private project brief for the signed-in student and saves
 * it to project_briefs. Never a listing, never visible to anyone else,
 * and never evidence — building it produces a repo, and the repo produces
 * evidence through the ordinary scan path like any other project.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Project suggestions are not configured on this deployment.' },
      { status: 503 },
    )
  }

  let body: { skillId?: string; targetRole?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.skillId) {
    return NextResponse.json({ error: 'Pick a skill to build toward.' }, { status: 400 })
  }

  const { count } = await supabase
    .from('project_briefs')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .is('completed_at', null)
  if ((count ?? 0) >= MAX_OPEN_BRIEFS) {
    return NextResponse.json(
      { error: `You have ${MAX_OPEN_BRIEFS} project ideas open already. Build one, or delete some first.` },
      { status: 400 },
    )
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const brief = await generateBrief(admin, user.id, body.skillId, body.targetRole?.trim() || null)
    if (!brief) {
      return NextResponse.json({ error: 'Could not generate a project idea. Try again.' }, { status: 502 })
    }

    // Written under the student's own session — project_briefs has a
    // manage-own policy, and the brief genuinely is theirs.
    const { data: saved, error } = await supabase
      .from('project_briefs')
      .insert({
        student_id: user.id,
        target_skill_id: brief.targetSkillId,
        target_role: body.targetRole?.trim() || null,
        brief_text: `${brief.title}\n\n${brief.briefText}`,
        difficulty: brief.difficulty,
      })
      .select('id')
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, id: saved.id, brief })
  } catch (err) {
    console.error('[api/agents/brief] failed:', err)
    return NextResponse.json({ error: 'Could not generate a project idea.' }, { status: 500 })
  }
}
