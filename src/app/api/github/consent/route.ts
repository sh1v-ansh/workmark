import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GITHUB_CONSENT_SCOPE, GITHUB_CONSENT_VERSION } from '@/lib/github/consent'

/**
 * POST /api/github/consent
 *
 * Records that this student read the GitHub consent screen and agreed to it.
 * Written under the student's own session, not the service role, because
 * the consents table's insert policy already says a student may only file
 * consent for themselves — which is the correct rule and worth keeping
 * enforced by the database rather than by this file remembering to.
 *
 * Idempotent from the caller's point of view: agreeing twice writes a second
 * row and that's fine. Consent is an append-only log of things a person
 * said, and collapsing two agreements into one loses the second date.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { error } = await supabase.from('consents').insert({
    student_id: user.id,
    scope: GITHUB_CONSENT_SCOPE,
    text_version: GITHUB_CONSENT_VERSION,
  })

  if (error) {
    // 23503: no matching students row — a faculty account reached this.
    // They have no record to build, so there is nothing to consent to.
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Only student accounts connect a GitHub account.' },
        { status: 403 },
      )
    }
    console.error('[api/github/consent] insert failed:', error)
    return NextResponse.json({ error: 'Could not record your consent.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
