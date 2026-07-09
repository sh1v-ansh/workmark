import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/stripe/hold
 *
 * Escrows funds when the poster accepts a student (spec §6.4). Uses Stripe
 * Connect PaymentIntent + manual capture to hold funds until close-out.
 * Feature-flagged pending legal review — see /api/stripe/connect.
 */
export async function POST(request: Request) {
  if (process.env.STRIPE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Stripe is not enabled in this environment.' }, { status: 501 })
  }

  const body = await request.json().catch(() => null) as { record_id?: string; amount_cents?: number } | null
  if (!body?.record_id || !body?.amount_cents) return NextResponse.json({ error: 'Missing record_id or amount_cents.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY!)
  // const intent = await stripe.paymentIntents.create({
  //   amount: body.amount_cents,
  //   currency: 'usd',
  //   capture_method: 'manual',                     // authorize now, capture on close-out
  //   metadata: { record_id: body.record_id, poster_id: user.id },
  // })
  // return NextResponse.json({ clientSecret: intent.client_secret, id: intent.id })

  return NextResponse.json({ error: 'Stripe SDK not installed.' }, { status: 501 })
}
