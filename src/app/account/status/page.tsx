import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccountRecord } from '@/lib/auth/roles'
import { C, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

/**
 * Where an account that isn't active goes.
 *
 * Every protected page calls getAccount(), which returns nothing for an
 * account that isn't active — so a suspended or declined person is bounced
 * to /login, which sees a valid session and bounces them back. Without this
 * page they loop until they give up, having been told nothing.
 *
 * Being closed out is exactly the moment someone deserves a plain sentence
 * about why and what to do, so the page says both.
 */

const COPY: Record<string, { title: string; body: string; next: string }> = {
  declined: {
    title: 'We couldn’t confirm your faculty account',
    body:
      'You signed up as faculty and we weren’t able to confirm it. That usually means we couldn’t match you to a department listing, not that anything is wrong — it is easy to sort out.',
    next: 'Reply to your confirmation email with a department page or a staff directory link and we’ll take another look.',
  },
  suspended: {
    title: 'Your account is on hold',
    body: 'This account has been suspended, so it can’t be used at the moment.',
    next: 'Reply to your confirmation email and we’ll tell you why and what happens next.',
  },
}

export default async function AccountStatusPage() {
  const supabase = await createClient()
  const account = await getAccountRecord(supabase)

  if (!account) redirect('/login')

  // An active account has no business here. Send them to the front door and
  // let the normal routing work out where they belong.
  if (account.status === 'active') redirect('/login')

  const copy = COPY[account.status] ?? COPY.suspended

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: '0 28px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Link
          href="/"
          aria-label="Workmark home"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <Wordmark height={22} />
        </Link>
      </header>

      <main
        id="main-content"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div style={{ maxWidth: 500, width: '100%' }}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: R.lg,
              padding: '32px 34px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h1 style={{ fontSize: 25, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.22 }}>
              {copy.title}
            </h1>

            <p style={{ fontSize: 15, color: C.textSub, margin: 0, lineHeight: 1.65 }}>{copy.body}</p>

            <p
              style={{
                fontSize: 14.5,
                color: C.textFaint,
                margin: 0,
                lineHeight: 1.6,
                borderTop: `1px solid ${C.borderFaint}`,
                paddingTop: 16,
              }}
            >
              {copy.next}
            </p>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link href="/" style={{ fontSize: 14, color: C.textFaint, textDecoration: 'none' }}>
              &larr; Back to Workmark
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
