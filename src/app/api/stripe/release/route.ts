import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/stripe/release
 *
 * Captures the previously-authorized PaymentIntent when the record is mutually
 * locked (spec §6.4). This is what ties payout to attestation — the incentive
 * that makes the "employer completes close-out" number climb.
 * Feature-flagged pending legal review.
 */
export async function POST(request: Request) {
  if (process.env.STRIPE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Stripe is not enabled in this environment.' }, { status: 501 })
  }

  const body = await request.json().catch(() => null) as { payment_intent_id?: string } | null
  if (!body?.payment_intent_id) return NextResponse.json({ error: 'Missing payment_intent_id.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY!)
  // const captured = await stripe.paymentIntents.capture(body.payment_intent_id)
  // return NextResponse.json({ status: captured.status })

  return NextResponse.json({ error: 'Stripe SDK not installed.' }, { status: 501 })
}
