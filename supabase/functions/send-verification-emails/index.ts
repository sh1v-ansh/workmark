/**
 * Workmark — send-verification-emails Edge Function
 *
 * Triggered daily by pg_cron (or manually).
 * Finds experience_records where:
 *   - verification_status = 'in_progress'
 *   - end_date <= today
 *
 * For each, sends a verification email to the company's contact_email
 * with a link to /verify/[verification_token].
 *
 * Deploy:
 *   supabase functions deploy send-verification-emails --no-verify-jwt
 *
 * Required secrets (set via `supabase secrets set KEY=value`):
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SITE_URL                    e.g. https://workmark.vercel.app
 *   RESEND_API_KEY              or swap in your own email provider
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://workmark.vercel.app'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface ExperienceRecord {
  id: string
  project_title: string | null
  company_name: string | null
  verification_token: string
  start_date: string | null
  end_date: string | null
  students: { full_name: string | null } | null
  companies: { contact_email: string | null; contact_name: string | null } | null
}

async function sendVerificationEmail(record: ExperienceRecord): Promise<boolean> {
  const studentName = record.students?.full_name ?? 'A student'
  const projectTitle = record.project_title ?? 'a project'
  const contactEmail = record.companies?.contact_email
  const contactName = record.companies?.contact_name ?? 'Team'
  const verifyUrl = `${SITE_URL}/verify/${record.verification_token}`

  if (!contactEmail) {
    console.warn(`[workmark] No contact email for record ${record.id}, skipping.`)
    return false
  }

  const subject = `Did ${studentName} complete "${projectTitle}"?`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #f9fafb; margin: 0; padding: 40px 16px; }
    .card { background: white; border-radius: 16px; border: 1px solid #e5e7eb; padding: 32px; max-width: 480px; margin: 0 auto; }
    .logo { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 24px; }
    .logo span { color: #4f46e5; }
    p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .detail { background: #f9fafb; border-radius: 10px; padding: 16px; margin: 16px 0; font-size: 14px; color: #6b7280; }
    .detail strong { color: #111827; }
    .btn { display: inline-block; padding: 14px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 4px; }
    .btn-deny { background: #e5e7eb; color: #374151; }
    .footer { margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Work<span>mark</span></div>
    <p>Hi ${contactName},</p>
    <p>
      The scheduled end date for <strong>${studentName}</strong>'s engagement on
      <strong>"${projectTitle}"</strong> has passed.
    </p>
    <p>
      Please confirm whether they completed the project so we can update their
      Workmark verified record.
    </p>

    <div class="detail">
      <p style="margin:0 0 6px;"><strong>Student:</strong> ${studentName}</p>
      <p style="margin:0 0 6px;"><strong>Project:</strong> ${projectTitle}</p>
      <p style="margin:0;"><strong>End date:</strong> ${record.end_date ?? '—'}</p>
    </div>

    <p style="text-align:center; margin: 24px 0 8px;">
      <a href="${verifyUrl}?action=verified" class="btn">Yes, completed ✓</a>
      <a href="${verifyUrl}?action=incomplete" class="btn btn-deny">Did not complete</a>
    </p>
    <p style="text-align:center; font-size: 13px; color: #9ca3af;">
      Or visit: <a href="${verifyUrl}" style="color:#4f46e5;">${verifyUrl}</a>
    </p>

    <div class="footer">
      Workmark · Verified CS Experience · You're receiving this because you're
      a registered company on Workmark.
    </div>
  </div>
</body>
</html>
`

  if (!RESEND_API_KEY) {
    // Fallback: log to console (useful in development without email provider)
    console.log(`[workmark] Would send email to ${contactEmail}: ${subject}`)
    console.log(`[workmark] Verify URL: ${verifyUrl}`)
    return true
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Workmark <noreply@workmark.app>',
      to: [contactEmail],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[workmark] Resend error for ${contactEmail}: ${body}`)
    return false
  }

  return true
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const today = new Date().toISOString().split('T')[0]

  // Find overdue in-progress records
  const { data: records, error } = await supabase
    .from('experience_records')
    .select(`
      id,
      project_title,
      company_name,
      verification_token,
      start_date,
      end_date,
      students ( full_name ),
      companies ( contact_email, contact_name )
    `)
    .eq('verification_status', 'in_progress')
    .lte('end_date', today)

  if (error) {
    console.error('[workmark] DB query failed:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!records || records.length === 0) {
    console.log('[workmark] No overdue records found.')
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  let sent = 0
  let failed = 0

  for (const record of records as ExperienceRecord[]) {
    const ok = await sendVerificationEmail(record)
    if (ok) sent++
    else failed++
  }

  console.log(`[workmark] Processed ${records.length} records. Sent: ${sent}, Failed: ${failed}`)

  return new Response(
    JSON.stringify({ total: records.length, sent, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
