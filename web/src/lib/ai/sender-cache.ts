import { redis } from '@/lib/redis'
import type { EmailCategory, CategorizationSource } from '@shared/types/categories'

interface CachedSenderCategory {
  category: EmailCategory
  confidence: number
  categorizedBy: CategorizationSource
  cachedAt: number // Unix timestamp ms
}

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const CONFIDENCE_DECAY_PER_DAY = 0.002 // 0.2% per day
const MAX_CONFIDENCE_DECAY = 0.05 // 5% max decay

// In-memory fallback when Redis is not configured
const memoryCache = new Map<string, CachedSenderCategory>()
const MEMORY_CACHE_MAX_SIZE = 10_000

function getCacheKey(userId: string, senderAddress: string): string {
  return `user:${userId}:sender:${senderAddress.toLowerCase()}`
}

function applyDecay(cached: CachedSenderCategory): CachedSenderCategory {
  const ageMs = Date.now() - cached.cachedAt
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  const decay = Math.min(ageDays * CONFIDENCE_DECAY_PER_DAY, MAX_CONFIDENCE_DECAY)
  return {
    ...cached,
    confidence: Math.max(0, cached.confidence - decay),
  }
}

export async function getSenderCategory(
  userId: string,
  senderAddress: string
): Promise<CachedSenderCategory | null> {
  try {
    const key = getCacheKey(userId, senderAddress)

    if (redis) {
      const cached = await redis.get<CachedSenderCategory>(key)
      return cached ? applyDecay(cached) : null
    }

    // In-memory fallback
    const cached = memoryCache.get(key)
    return cached ? applyDecay(cached) : null
  } catch (error) {
    console.error('[SenderCache] Get error:', error)
    return null
  }
}

export async function setSenderCategory(
  userId: string,
  senderAddress: string,
  category: EmailCategory,
  confidence: number,
  categorizedBy: CategorizationSource
): Promise<void> {
  try {
    const key = getCacheKey(userId, senderAddress)
    const data: CachedSenderCategory = {
      category,
      confidence,
      categorizedBy,
      cachedAt: Date.now(),
    }

    if (redis) {
      await redis.set(key, data, { ex: CACHE_TTL_SECONDS })
      return
    }

    // In-memory fallback
    memoryCache.set(key, data)
    if (memoryCache.size > MEMORY_CACHE_MAX_SIZE) {
      const firstKey = memoryCache.keys().next().value
      if (firstKey) memoryCache.delete(firstKey)
    }
  } catch (error) {
    console.error('[SenderCache] Set error:', error)
  }
}

export async function invalidateSenderCache(
  userId: string,
  senderAddress: string
): Promise<void> {
  try {
    const key = getCacheKey(userId, senderAddress)
    if (redis) {
      await redis.del(key)
    } else {
      memoryCache.delete(key)
    }
  } catch (error) {
    console.error('[SenderCache] Invalidate error:', error)
  }
}

export async function getSenderCategoriesBatch(
  userId: string,
  senderAddresses: string[]
): Promise<Map<string, CachedSenderCategory>> {
  const results = new Map<string, CachedSenderCategory>()

  try {
    if (redis) {
      const pipeline = redis.pipeline()
      for (const address of senderAddresses) {
        pipeline.get(getCacheKey(userId, address))
      }
      const responses = await pipeline.exec<(CachedSenderCategory | null)[]>()

      for (let i = 0; i < senderAddresses.length; i++) {
        const cached = responses[i]
        if (cached) {
          results.set(senderAddresses[i].toLowerCase(), applyDecay(cached))
        }
      }
    } else {
      // In-memory fallback
      for (const address of senderAddresses) {
        const cached = memoryCache.get(getCacheKey(userId, address))
        if (cached) {
          results.set(address.toLowerCase(), applyDecay(cached))
        }
      }
    }
  } catch (error) {
    console.error('[SenderCache] Batch get error:', error)
  }

  return results
}
