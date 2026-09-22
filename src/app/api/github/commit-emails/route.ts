import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { readJsonBody, requireEmail, requireOneOf, ValidationError } from '@/lib/http/validate'

/**
 * POST /api/github/commit-emails  { email, answer: 'mine' | 'not-mine' }
 *
 * "41 commits in this repo are from priya@lab-machine.local — is that you?"
 *
 * ── Why a student is allowed to answer this at all ────────────────────────
 * Because nobody else can. GitHub only knows the addresses verified against
 * an account, and the whole failure this fixes is a commit signed with one
 * that never was. No amount of API access recovers that; the person who
 * configured the machine is the only source of truth.
 *
 * ── Why it is not a way to take credit for other people's work ────────────
 * The answer is only accepted for an address that is already sitting in
 * observed_commit_emails for this student — and a scan only writes one there
 * when GitHub attributed those commits to *nobody*. An address GitHub
 * attributes to any account is never offered, to anyone, so two students
 * cannot both claim the same commits.
 *
 * That check is the load-bearing line in this file. Without it the endpoint
 * would accept any address at all, and a record would be a text box.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let email: string
  let answer: 'mine' | 'not-mine'
  try {
    const body = await readJsonBody(request)
    email = requireEmail(body.email).toLowerCase()
    answer = requireOneOf(body.answer, 'Answer', ['mine', 'not-mine'] as const)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // The check described above. Read under the service role but filtered to
  // this user — an address nobody offered them is not an address they may
  // answer about.
  const { data: offered, error: readErr } = await admin
    .from('observed_commit_emails')
    .select('id')
    .eq('student_id', user.id)
    .eq('email', email)
    .limit(1)

  if (readErr) {
    console.error('[api/github/commit-emails] read failed:', readErr)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  if (!offered || offered.length === 0) {
    // Deliberately the same answer as a malformed address. Confirming that
    // an address exists on somebody's commits is not something to leak to
    // whoever asks.
    return NextResponse.json({ error: 'That address is not one we asked you about.' }, { status: 400 })
  }

  if (answer === 'mine') {
    const { error } = await admin
      .from('student_commit_emails')
      .upsert({ student_id: user.id, email, source: 'confirmed' }, { onConflict: 'student_id,email' })
    if (error) {
      console.error('[api/github/commit-emails] confirm failed:', error)
      return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
    }
    // The question is answered everywhere it was asked, not just in the repo
    // they happened to be looking at.
    await admin
      .from('observed_commit_emails')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('student_id', user.id)
      .eq('email', email)

    return NextResponse.json({
      ok: true,
      // Said plainly, because nothing changes until a scan runs and a
      // student who saw "saved" and then no new skills would reasonably
      // conclude it had not worked.
      message: 'Saved. Re-scan your repositories to count that work.',
    })
  }

  const { error } = await admin
    .from('observed_commit_emails')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('student_id', user.id)
    .eq('email', email)

  if (error) {
    console.error('[api/github/commit-emails] dismiss failed:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, message: 'Thanks — we won’t ask again.' })
}
