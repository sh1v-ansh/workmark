import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

/**
 * POST /api/feedback — report a bug or ask for something.
 *
 * The page and browser are captured here rather than asked for. A student
 * will never volunteer that they were on /listings/abc/applicants in Safari,
 * and without that a report is "it's broken" — true, and unactionable.
 *
 * Written under the student's own session: `feedback` has an insert policy
 * scoped to the reporter, so nobody can file a report as someone else.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to send feedback.' }, { status: 401 })

  const limited = await enforce('feedback', user.id)
  if (limited) return limited

  let body: { kind?: string; title?: string; body?: string; pageUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const kind = body.kind === 'feature' ? 'feature' : 'bug'
  const title = body.title?.trim()
  const detail = body.body?.trim()

  if (!title) return NextResponse.json({ error: 'A one-line summary helps us find it.' }, { status: 400 })
  if (!detail) return NextResponse.json({ error: 'Tell us what happened.' }, { status: 400 })

  const { error } = await supabase.from('feedback').insert({
    reporter_id: user.id,
    kind,
    title: title.slice(0, 200),
    body: detail.slice(0, 4000),
    page_url: body.pageUrl?.slice(0, 500) ?? null,
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  })

  if (error) {
    console.error('[api/feedback] insert failed:', error)
    return NextResponse.json({ error: 'Could not send that. Try again?' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: kind === 'bug' ? 'Thanks — we can see the page you were on.' : 'Thanks, noted.',
  })
}
