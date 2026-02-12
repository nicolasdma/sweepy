import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { stripe } from '@/lib/stripe/config'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  const auth = await withAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = await createServiceRoleClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', auth.userId)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing account', code: 'NO_CUSTOMER' },
      { status: 400 }
    )
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
