import Stripe from 'stripe'

const hasStripe = !!process.env.STRIPE_SECRET_KEY

export const stripe = hasStripe
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true })
  : (null as unknown as Stripe)

export const PLANS = {
  pro: {
    name: 'Sweepy Pro',
    priceId: process.env.STRIPE_PRICE_ID || '',
    price: 5,
    currency: 'usd',
    trialDays: 7,
  },
} as const
