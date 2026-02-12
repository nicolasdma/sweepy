import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { stripe, PLANS } from '@/lib/stripe/config'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  const auth = await withAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = await createServiceRoleClient()

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', auth.userId)
    .single()

  if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
    return NextResponse.json(
      { error: 'Already subscribed', code: 'ALREADY_SUBSCRIBED' },
      { status: 400 }
    )
  }

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.email,
      metadata: { userId: auth.userId },
    })
    customerId = customer.id

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', auth.userId)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: PLANS.pro.priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: PLANS.pro.trialDays,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=canceled`,
    metadata: { userId: auth.userId },
  })

  return NextResponse.json({ url: session.url })
}
