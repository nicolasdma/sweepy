import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const rateLimiters = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'ratelimit:auth',
  }),
  analyze: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'ratelimit:analyze',
  }),
  actions: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 h'),
    prefix: 'ratelimit:actions',
  }),
}
