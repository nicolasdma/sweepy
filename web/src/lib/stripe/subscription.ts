import { stripe } from './config'
import { createServiceRoleClient } from '@/lib/supabase/server'

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours
const VERIFICATION_CACHE_MS = 60 * 60 * 1000 // 1 hour

// In-memory cache for subscription status (bilateral verification)
const statusCache = new Map<string, { status: string; checkedAt: number }>()

/**
 * Check if a user has an active subscription.
 * Uses bilateral verification: DB status + Stripe API check (cached 1h).
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = await createServiceRoleClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'subscription_status, current_period_end, stripe_subscription_id'
    )
    .eq('id', userId)
    .single()

  if (!profile) return false

  const { subscription_status, current_period_end, stripe_subscription_id } =
    profile

  // Active or trialing → allowed
  if (
    subscription_status === 'active' ||
    subscription_status === 'trialing'
  ) {
    return true
  }

  // Canceled but within grace period
  if (subscription_status === 'canceled' && current_period_end) {
    const periodEnd = new Date(current_period_end).getTime()
    if (Date.now() < periodEnd + GRACE_PERIOD_MS) {
      return true
    }
  }

  // Past due: bilateral verification with Stripe
  if (
    subscription_status === 'past_due' &&
    stripe_subscription_id
  ) {
    return verifyWithStripe(userId, stripe_subscription_id)
  }

  return false
}

async function verifyWithStripe(
  userId: string,
  subscriptionId: string
): Promise<boolean> {
  // Check cache
  const cached = statusCache.get(userId)
  if (cached && Date.now() - cached.checkedAt < VERIFICATION_CACHE_MS) {
    return cached.status === 'active' || cached.status === 'trialing'
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const isActive =
      subscription.status === 'active' ||
      subscription.status === 'trialing'

    statusCache.set(userId, {
      status: subscription.status,
      checkedAt: Date.now(),
    })

    // Clean cache if too large
    if (statusCache.size > 5000) {
      const entries = [...statusCache.entries()]
      entries
        .sort((a, b) => a[1].checkedAt - b[1].checkedAt)
        .slice(0, 2500)
        .forEach(([key]) => statusCache.delete(key))
    }

    return isActive
  } catch (error) {
    console.error('[Stripe] Verification failed:', error)
    // On error, be permissive (grace period logic)
    return true
  }
}
