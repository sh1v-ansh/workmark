import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { agentsAvailable } from '@/lib/agents/client'
import { writeApplicationQuestions } from '@/lib/agents/application-questions'

export const maxDuration = 60

/**
 * POST /api/agents/application-questions  { title, brief, skills }
 *
 * The "Suggest questions" button on the posting form. Only runs when the
 * poster asks; the suggestions land in the form for them to keep, edit or
 * throw away. Nothing is saved here.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!agentsAvailable()) return NextResponse.json({ error: 'Suggestions are unavailable right now.' }, { status: 503 })

  const limited = await enforce('agent', user.id)
  if (limited) return limited

  const body = await request.json().catch(() => ({})) as { title?: unknown; brief?: unknown; skills?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const brief = typeof body.brief === 'string' ? body.brief.trim().slice(0, 4000) : ''
  const skills = Array.isArray(body.skills) ? body.skills.filter((s): s is string => typeof s === 'string').slice(0, 20) : []
  if (!title || brief.length < 20) {
    return NextResponse.json({ error: 'Write a title and a description first, so the questions can be about this project.' }, { status: 400 })
  }

  const questions = await writeApplicationQuestions(supabase, user.id, { title, description: brief, requirements: skills })
  if (!questions) return NextResponse.json({ error: 'Could not suggest questions just now. Try again, or write your own.' }, { status: 502 })
  return NextResponse.json({ ok: true, questions })
}
