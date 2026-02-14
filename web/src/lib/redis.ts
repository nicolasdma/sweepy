import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

export const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

/**
 * In-memory sliding window rate limiter.
 * Used as fallback when Redis is not configured.
 */
class InMemoryRateLimiter {
  private windows: Map<string, number[]> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async limit(id: string): Promise<{ success: boolean; remaining: number }> {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let timestamps = this.windows.get(id) || []
    // Remove expired timestamps (outside the sliding window)
    timestamps = timestamps.filter((ts) => ts > windowStart)

    if (timestamps.length >= this.maxRequests) {
      this.windows.set(id, timestamps)
      return { success: false, remaining: 0 }
    }

    timestamps.push(now)
    this.windows.set(id, timestamps)

    // Periodic cleanup: remove stale keys to prevent memory leaks
    if (this.windows.size > 10_000) {
      for (const [key, ts] of this.windows) {
        const valid = ts.filter((t) => t > windowStart)
        if (valid.length === 0) {
          this.windows.delete(key)
        } else {
          this.windows.set(key, valid)
        }
      }
    }

    return { success: true, remaining: this.maxRequests - timestamps.length }
  }
}

const ONE_HOUR_MS = 60 * 60 * 1000

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
  : {
      auth: new InMemoryRateLimiter(10, ONE_HOUR_MS),
      analyze: new InMemoryRateLimiter(20, ONE_HOUR_MS),
      actions: new InMemoryRateLimiter(200, ONE_HOUR_MS),
    }
