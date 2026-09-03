import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccountRecord } from '@/lib/auth/roles'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'
import { GRACE_DAYS, purgesAt } from '@/lib/account/deletion'
import { RestoreButton } from './RestoreButton'

export const dynamic = 'force-dynamic'

/**
 * What a deleted account sees.
 *
 * Two audiences. Someone who just pressed the button and is now signed out
 * (`?done=1`), and someone who signed back in during the week and can undo
 * it. The second is the reason the page exists — a grace period nobody can
 * find their way into is not a grace period.
 */
export default async function AccountDeletedPage({
  searchParams,
}: {
  searchParams: { done?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed out immediately after deleting: confirm it and stop. There's no
  // session to read a date from, and that's fine.
  if (!user) {
    return (
      <Shell>
        <h1 style={H1}>Your account is being deleted.</h1>
        <p style={P}>
          You&apos;re signed out. Everything is erased for good in {GRACE_DAYS} days — if you
          change your mind before then, sign in again and there&apos;ll be a button to bring it
          back.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <Link href="/login" className="nb-btn nb-btn-outline">Sign in</Link>
          <Link href="/" className="nb-btn nb-btn-quiet">Home</Link>
        </div>
      </Shell>
    )
  }

  const account = await getAccountRecord(supabase)
  if (!account) redirect('/login')
  if (account.status !== 'deleting') {
    // Not deleting after all — restored in another tab, or never was.
    redirect(searchParams.done ? '/' : '/student/dashboard')
  }

  const { data: row } = await supabase
    .from('accounts')
    .select('deletion_requested_at')
    .eq('id', user.id)
    .maybeSingle()

  const gone = row?.deletion_requested_at
    ? new Date(purgesAt(row.deletion_requested_at)).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  return (
    <Shell>
      <h1 style={H1}>Your account is scheduled for deletion.</h1>
      {gone && (
        <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '15px 18px', margin: '18px 0' }}>
          <div style={{ fontSize: 12.5, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Erased for good on
          </div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: C.text }}>{gone}</div>
        </div>
      )}
      <p style={P}>
        Until then you can have it back. Restoring returns your profile and your skill record.
        It doesn&apos;t return your public profile link, your place in the student directory, or
        the applications that were withdrawn — those went when you pressed the button.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <RestoreButton />
        <Link href="/" className="nb-btn nb-btn-quiet">Leave it</Link>
      </div>
    </Shell>
  )
}

const H1: React.CSSProperties = {
  fontFamily: F.display, fontSize: 24, fontWeight: 700,
  letterSpacing: '-0.025em', color: C.text, marginBottom: 12,
}

const P: React.CSSProperties = { fontSize: 14.5, color: C.textMuted, lineHeight: 1.65 }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 24px' }}>
      <div style={{ width: '100%', maxWidth: 550, marginBottom: 36 }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'inline-flex', textDecoration: 'none' }}>
          <Wordmark height={24} />
        </Link>
      </div>
      <div style={{ width: '100%', maxWidth: 550, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 30 }}>
        {children}
      </div>
    </main>
  )
}
