import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/resume?path=<storage_path>
 *
 * Generates a short-lived signed URL for a private resume file.
 * Only accessible to authenticated users who are a company (viewing
 * applicants). Students can access their own resumes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path.' }, { status: 400 })
  }

  // Reject path traversal attempts
  const normalised = path.replace(/\\/g, '/').replace(/\.\.\/|\.\/|^\//, '')
  if (normalised !== path.replace(/\\/g, '/').replace(/^\//, '')) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Authorisation check:
  // - Students can only fetch their own resume (path starts with their user id)
  // - Companies can fetch any resume (they're reviewing applicants)
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const isCompany = !!company

  if (!isCompany) {
    // Must be a student — enforce they can only access their own
    if (!normalised.startsWith(user.id)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
  }

  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(normalised, 300) // 5-minute expiry

  if (error || !data) {
    return NextResponse.json({ error: 'Could not generate URL.' }, { status: 500 })
  }

  // Redirect to the signed URL
  return NextResponse.redirect(data.signedUrl)
}
