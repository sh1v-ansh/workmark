import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/consents/[id]/revoke
 *
 * Revocation sets revoked_at; it never deletes the row. Disclosures
 * already made under a consent were authorized when they were made, and
 * erasing the consent would make the disclosure_log entries that
 * reference it look unauthorized in retrospect — the opposite of an
 * audit trail.
 *
 * What revocation actually does going forward: the poster keeps what
 * they were already shown (we cannot un-send it, and pretending
 * otherwise would be dishonest), but the consent can no longer support
 * any new disclosure.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: consent } = await supabase
    .from('consents')
    .select('id, revoked_at')
    .eq('id', id)
    .eq('student_id', user.id)
    .maybeSingle()
  if (!consent) return NextResponse.json({ error: 'Consent not found.' }, { status: 404 })
  if (consent.revoked_at) return NextResponse.json({ ok: true, alreadyRevoked: true })

  const { error } = await supabase
    .from('consents')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[api/consents/revoke] failed:', error)
    return NextResponse.json({ error: 'Could not revoke that consent.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
