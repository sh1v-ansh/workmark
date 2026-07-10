import { NextResponse } from 'next/server'

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe events (payment_intent.succeeded, payment_intent.canceled,
 * charge.refunded, etc.). Signature verification uses STRIPE_WEBHOOK_SECRET.
 * Feature-flagged pending legal review.
 */
export async function POST(request: Request) {
  if (process.env.STRIPE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Stripe is not enabled in this environment.' }, { status: 501 })
  }

  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })

  // const raw = await request.text()
  // const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY!)
  // let event
  // try {
  //   event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  // } catch (err) {
  //   return NextResponse.json({ error: `Signature verification failed: ${(err as Error).message}` }, { status: 400 })
  // }
  //
  // switch (event.type) {
  //   case 'payment_intent.succeeded':
  //     // TODO: update the record's payment_status column
  //     break
  //   case 'payment_intent.canceled':
  //     // TODO: mark record's payment as canceled
  //     break
  // }
  // return NextResponse.json({ received: true })

  return NextResponse.json({ error: 'Stripe SDK not installed.' }, { status: 501 })
}
