import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/config'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redis } from '@/lib/redis'
import Stripe from 'stripe'

// Disable body parsing — Stripe needs raw body for signature verification
export const runtime = 'nodejs'

// In-memory fallback for idempotency when Redis is not available
const processedEvents = new Set<string>()
const MAX_PROCESSED_EVENTS = 10_000

/**
 * Check if a Stripe event has already been processed.
 * Uses Redis SETNX with 48h TTL when available, falls back to in-memory Set.
 * Returns true if the event was already processed (duplicate).
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  if (redis) {
    // SETNX: returns 'OK' if key was set (new event), null if key already exists (duplicate)
    const result = await redis.set(`stripe:event:${eventId}`, 1, { nx: true, ex: 172800 })
    return result === null
  }
  // Fallback: in-memory Set
  return processedEvents.has(eventId)
}

/**
 * Mark a Stripe event as processed in the in-memory fallback Set.
 * Only needed when Redis is not available (Redis marks it in isEventProcessed).
 */
function markEventProcessed(eventId: string): void {
  if (!redis) {
    processedEvents.add(eventId)
    if (processedEvents.size > MAX_PROCESSED_EVENTS) {
      const first = processedEvents.values().next().value
      if (first) processedEvents.delete(first)
    }
  }
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Billing not configured' },
      { status: 501 }
    )
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Idempotency check (Redis SETNX with 48h TTL, or in-memory Set fallback)
  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true })
  }

  // Respond 200 immediately, process async
  // (In Vercel, we process before responding since we can't do true async)
  try {
    await handleEvent(event)
  } catch (error) {
    console.error('[Stripe Webhook] Handler error:', error)
    // Still return 200 to prevent Stripe from retrying
    // The error is logged and can be investigated
  }

  // Track processed event in in-memory fallback (no-op when Redis is available)
  markEventProcessed(event.id)

  return NextResponse.json({ received: true })
}

async function handleEvent(event: Stripe.Event) {
  const supabase = await createServiceRoleClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

      const status = mapSubscriptionStatus(subscription.status)
      const periodEnd = (subscription as unknown as Record<string, number>).current_period_end
        ?? subscription.items?.data?.[0]?.current_period_end
      const updates: Record<string, unknown> = {
        stripe_subscription_id: subscription.id,
        subscription_status: status,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
      }

      if (subscription.status === 'trialing' && subscription.trial_start) {
        updates.trial_start = new Date(
          subscription.trial_start * 1000
        ).toISOString()
        updates.trial_end = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null
      }

      await supabase
        .from('profiles')
        .update(updates)
        .eq('stripe_customer_id', customerId)

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

      // Grace period: don't immediately revoke access
      // Set status to canceled, the access check adds 24h grace
      const deletedPeriodEnd = (subscription as unknown as Record<string, number>).current_period_end
        ?? subscription.items?.data?.[0]?.current_period_end
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'canceled',
          current_period_end: deletedPeriodEnd
            ? new Date(deletedPeriodEnd * 1000).toISOString()
            : null,
        })
        .eq('stripe_customer_id', customerId)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

      if (customerId) {
        await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

      if (customerId) {
        // Reactivate if was past_due
        await supabase
          .from('profiles')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', customerId)
          .eq('subscription_status', 'past_due')
      }
      break
    }

    default:
      // Unhandled event type
      break
  }
}

function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): string {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'inactive'
  }
}
