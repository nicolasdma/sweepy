import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

export const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export const rateLimiters = hasRedis && redis
  ? {
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
  : null
