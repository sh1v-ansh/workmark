import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'
import { ageOn, eligibleOn, formatDay, parseDob, MINIMUM_AGE } from '@/lib/auth/age'

export const dynamic = 'force-dynamic'

/**
 * Where a held account waits.
 *
 * An under-18 signup isn't refused — the profile is saved and the account
 * opens by itself on their eighteenth birthday. This page is the honest
 * version of that: it says the date, says what happens on it, and says what
 * is and isn't being done with their data in the meantime.
 *
 * It also releases the account itself when the birthday has arrived, rather
 * than only waiting for the nightly sweep. Someone who logs in on the
 * morning of their birthday should get in, not be told to come back after
 * 5am UTC.
 */
export default async function WaitlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('accounts')
    .select('status, date_of_birth, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!account) redirect('/onboarding')
  if (account.status !== 'waitlisted') redirect('/student/dashboard')

  const dob = account.date_of_birth ? parseDob(account.date_of_birth) : null

  // Birthday already here — open it now. Narrow by design: this only ever
  // moves 'waitlisted' to 'active', so it can't revive a suspended account.
  if (dob && ageOn(dob) >= MINIMUM_AGE) {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await admin
      .from('accounts')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .eq('status', 'waitlisted')
    redirect('/student/dashboard')
  }

  const opensOn = dob ? formatDay(eligibleOn(dob)) : null
  const firstName = (account.display_name ?? '').trim().split(/\s+/)[0]

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 24px' }}>
      <div style={{ width: '100%', maxWidth: 550, marginBottom: 36 }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <Wordmark height={24} />
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: 550, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 30 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 10 }}>
          {firstName ? `Saved, ${firstName}.` : 'Your profile is saved.'} We&apos;re holding your account.
        </h1>

        <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.65, marginBottom: 18 }}>
          Workmark accounts are for adults. An account is an agreement, and a student account
          builds a record about you that other people get shown — neither is something we can
          set up for someone under 18.
        </p>

        {opensOn && (
          <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '16px 18px', marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
              Opens on
            </div>
            <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: C.text }}>{opensOn}</div>
            <div style={{ fontSize: 13, color: C.textFaint, marginTop: 6 }}>
              Your 18th birthday. Nothing for you to do — sign in that day and it&apos;s open.
            </div>
          </div>
        )}

        <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.65, marginBottom: 20 }}>
          Until then nothing happens with your account. We don&apos;t scan your GitHub, we
          don&apos;t build your skill record, and nobody can see your profile or find you in
          search. What you filled in is stored and waiting.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/marketplace" className="nb-btn nb-btn-outline">See what&apos;s on Workmark</Link>
          <Link href="/legal/privacy" className="nb-btn nb-btn-quiet">What we store</Link>
        </div>

        <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6, marginTop: 22 }}>
          Wrong date of birth? Email{' '}
          <a href="mailto:support@workmark.org" style={{ color: C.textFaint }}>support@workmark.org</a>{' '}
          and we&apos;ll fix it. You can also ask us to delete everything, and we will.
        </p>
      </div>
    </main>
  )
}
