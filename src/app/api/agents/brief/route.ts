import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateBrief } from '@/lib/agents/brief'
import { agentsAvailable } from '@/lib/agents/client'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { isCareerTrack, isSkillLevel } from '@/lib/agents/tracks'

// This route does slow third-party work — a Claude generation of up to 16k tokens. Without an explicit
// maxDuration it inherits the platform default and gets killed mid-flight.
//
// 60s is the value that is safe on every Vercel plan — Hobby without Fluid
// Compute caps here, and a deployment whose maxDuration exceeds the plan
// limit fails to build rather than being clamped. Raise it if the project
// is on Pro; the durable fix is not a bigger number, it is doing this work
// in a background job so no single request has to finish it.
export const maxDuration = 60

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

  const limited = await enforce('agent', user.id)
  if (limited) return limited

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Project suggestions are not configured on this deployment.' },
      { status: 503 },
    )
  }

  let body: { skillId?: string; targetRole?: string; skillLevel?: string; careerTrack?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.skillId) {
    return NextResponse.json({ error: 'Pick a skill to build toward.' }, { status: 400 })
  }

  // Validated rather than passed through: these reach both a CHECK
  // constraint and a prompt, and an unrecognised value would fail the
  // insert after the expensive generation had already run.
  if (body.skillLevel != null && !isSkillLevel(body.skillLevel)) {
    return NextResponse.json({ error: 'Unknown level.' }, { status: 400 })
  }
  if (body.careerTrack != null && !isCareerTrack(body.careerTrack)) {
    return NextResponse.json({ error: 'Unknown career track.' }, { status: 400 })
  }
  const skillLevel = body.skillLevel ?? null
  const careerTrack = body.careerTrack ?? null

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

  const limit = await checkAgentRateLimit(admin, 'brief', user.id, 'student_id')
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.message }, { status: 429 })
  }

  try {
    const brief = await generateBrief(admin, user.id, body.skillId, {
      targetRole: body.targetRole?.trim() || null,
      skillLevel,
      careerTrack,
    })
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
        skill_level: skillLevel,
        career_track: careerTrack,
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
