import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { parseBody, readFields, requireString, optionalString, optionalUuid } from '@/lib/http/validate'

/**
 * POST /api/workspaces — start a project.
 *
 * Creates it as a draft. Name and summary first, then a repo and the people,
 * and only then does it begin — the database refuses to move a workspace out
 * of draft until a repository is linked, because without one there is nothing
 * to read, nothing to attribute and no evidence at the end.
 *
 * The creator becomes an owner by trigger, not here. A workspace with no
 * members is unreachable by its own policies, including to the person who
 * just made it, so that cannot depend on a second insert succeeding.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const fields = readFields(() => ({
    title: requireString(body.title, 'A project name', { min: 3, max: 120 }),
    summary: optionalString(body.summary, 'The summary', { max: 2000 }),
    // Where the idea came from. Kept as provenance and nothing else — it
    // changes no behaviour, which is why there is no 'origin' to set.
    briefId: optionalUuid(body.briefId, 'Brief'),
  }))
  if (!fields.ok) return fields.response
  const { title, summary, briefId } = fields.values

  // Read through the caller's session, so a brief that is not theirs is
  // simply not found rather than something to be refused.
  if (briefId) {
    const { data: brief } = await supabase
      .from('project_briefs')
      .select('id')
      .eq('id', briefId)
      .maybeSingle()
    if (!brief) return NextResponse.json({ error: 'That project idea was not found.' }, { status: 404 })
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({ title, summary, brief_id: briefId, created_by: user.id })
    .select('id')
    .single()

  if (error || !workspace) {
    console.error('[api/workspaces] create failed:', error)
    return NextResponse.json({ error: 'Could not create that project.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: workspace.id })
}
