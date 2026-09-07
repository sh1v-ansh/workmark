import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { parseBody, readFields, requireString, optionalString } from '@/lib/http/validate'
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

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const kind = body.kind === 'feature' ? 'feature' : 'bug'

  // Lengths enforced here rather than by the slice() below. Truncating was
  // silently discarding the end of a long report; now it is refused, and the
  // person still has what they wrote in the box in front of them.
  const fields = readFields(() => ({
    title: requireString(body.title, 'A one-line summary', { max: 200 }),
    detail: requireString(body.body, 'What happened', { max: 4000 }),
    pageUrl: optionalString(body.pageUrl, 'Page', { max: 500 }),
  }))
  if (!fields.ok) return fields.response
  const { title, detail, pageUrl } = fields.values

  const { error } = await supabase.from('feedback').insert({
    reporter_id: user.id,
    kind,
    title,
    body: detail,
    page_url: pageUrl,
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
