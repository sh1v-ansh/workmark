import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/stripe/connect
 *
 * Creates a Stripe Connect Express account for the poster and returns an
 * onboarding URL. Gated behind STRIPE_ENABLED — actual money movement stays
 * off until the employment attorney and privacy attorney sign off per spec §10.
 *
 * Wire it up when ready:
 *   1. npm install stripe
 *   2. Set STRIPE_ENABLED=true, STRIPE_SECRET_KEY=sk_..., STRIPE_WEBHOOK_SECRET=whsec_...
 *   3. Uncomment the SDK block below.
 */
export async function POST(_request: Request) {
  if (process.env.STRIPE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Stripe is not enabled in this environment.' }, { status: 501 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY!)
  // const account = await stripe.accounts.create({ type: 'express', email: user.email ?? undefined })
  // const link = await stripe.accountLinks.create({
  //   account: account.id,
  //   refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/company/dashboard?stripe=refresh`,
  //   return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/company/dashboard?stripe=return`,
  //   type: 'account_onboarding',
  // })
  // return NextResponse.json({ accountId: account.id, url: link.url })

  return NextResponse.json({ error: 'Stripe SDK not installed. See file header.' }, { status: 501 })
}
