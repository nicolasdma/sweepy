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

function getCacheKey(userId: string, senderAddress: string): string {
  return `user:${userId}:sender:${senderAddress.toLowerCase()}`
}

/**
 * Look up a sender's cached category for a specific user.
 * Applies confidence decay based on age.
 */
export async function getSenderCategory(
  userId: string,
  senderAddress: string
): Promise<CachedSenderCategory | null> {
  try {
    const key = getCacheKey(userId, senderAddress)
    const cached = await redis.get<CachedSenderCategory>(key)

    if (!cached) return null

    // Apply confidence decay based on age
    const ageMs = Date.now() - cached.cachedAt
    const ageDays = ageMs / (24 * 60 * 60 * 1000)
    const decay = Math.min(ageDays * CONFIDENCE_DECAY_PER_DAY, MAX_CONFIDENCE_DECAY)
    const adjustedConfidence = Math.max(0, cached.confidence - decay)

    return {
      ...cached,
      confidence: adjustedConfidence,
    }
  } catch (error) {
    console.error('[SenderCache] Get error:', error)
    return null
  }
}

/**
 * Cache a sender's category for a specific user.
 */
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
    await redis.set(key, data, { ex: CACHE_TTL_SECONDS })
  } catch (error) {
    console.error('[SenderCache] Set error:', error)
  }
}

/**
 * Invalidate a sender's cache when the user rejects the categorization.
 */
export async function invalidateSenderCache(
  userId: string,
  senderAddress: string
): Promise<void> {
  try {
    const key = getCacheKey(userId, senderAddress)
    await redis.del(key)
  } catch (error) {
    console.error('[SenderCache] Invalidate error:', error)
  }
}

/**
 * Batch lookup for multiple senders.
 */
export async function getSenderCategoriesBatch(
  userId: string,
  senderAddresses: string[]
): Promise<Map<string, CachedSenderCategory>> {
  const results = new Map<string, CachedSenderCategory>()

  try {
    const pipeline = redis.pipeline()
    for (const address of senderAddresses) {
      pipeline.get(getCacheKey(userId, address))
    }

    const responses = await pipeline.exec<(CachedSenderCategory | null)[]>()

    for (let i = 0; i < senderAddresses.length; i++) {
      const cached = responses[i]
      if (cached) {
        const ageMs = Date.now() - cached.cachedAt
        const ageDays = ageMs / (24 * 60 * 60 * 1000)
        const decay = Math.min(
          ageDays * CONFIDENCE_DECAY_PER_DAY,
          MAX_CONFIDENCE_DECAY
        )
        results.set(senderAddresses[i].toLowerCase(), {
          ...cached,
          confidence: Math.max(0, cached.confidence - decay),
        })
      }
    }
  } catch (error) {
    console.error('[SenderCache] Batch get error:', error)
  }

  return results
}
