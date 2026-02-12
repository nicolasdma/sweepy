import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

export const PLANS = {
  pro: {
    name: 'InboxPilot Pro',
    priceId: process.env.STRIPE_PRICE_ID!,
    price: 5,
    currency: 'usd',
    trialDays: 7,
  },
} as const
