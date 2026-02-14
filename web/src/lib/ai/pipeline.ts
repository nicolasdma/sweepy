import type { MinimalEmailData } from '@shared/types/email'
import type { CategorizationResult } from '@shared/types/categories'
import { getSenderCategoriesBatch, setSenderCategoriesBatch } from './sender-cache'
import { classifyWithLLM, estimateLLMCost } from './llm'

const LLM_BATCH_SIZE = 20

export interface PipelineStats {
  total: number
  resolvedByHeuristic: number
  resolvedByCache: number
  resolvedByLlm: number
  llmCostUsd: number
}

export interface PipelineResult {
  results: CategorizationResult[]
  stats: PipelineStats
}

export interface PipelineOptions {
  skipCache?: boolean
  /** Called after each LLM batch completes, with total classified so far */
  onProgress?: (classified: number, total: number) => void | Promise<void>
}

/**
 * 2-layer categorization pipeline (LLM-first):
 * 1. Sender cache (Redis, $0) → reuses previous LLM classifications
 * 2. LLM → classifies everything else with full context
 *
 * Cost: ~$0.20 per 2000 emails. Accuracy >> heuristics.
 */
export async function categorizeEmails(
  emails: MinimalEmailData[],
  userId: string,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const allResults: CategorizationResult[] = []
  const stats: PipelineStats = {
    total: emails.length,
    resolvedByHeuristic: 0,
    resolvedByCache: 0,
    resolvedByLlm: 0,
    llmCostUsd: 0,
  }

  console.log(`[Sweepy:Pipeline] Starting LLM-first categorization for ${emails.length} emails, userId: ${userId}`)

  if (emails.length === 0) {
    return { results: allResults, stats }
  }

  // === Layer 1: Sender Cache ===
  let uncached: MinimalEmailData[]

  if (options?.skipCache) {
    console.log(`[Sweepy:Pipeline] Cache SKIPPED (skipCache=true)`)
    uncached = emails
  } else {
    const senderAddresses = emails.map((e) => e.from.address)
    const cachedCategories = await getSenderCategoriesBatch(userId, senderAddresses)

    uncached = []

    for (const email of emails) {
      const cached = cachedCategories.get(email.from.address.toLowerCase())
      if (cached && cached.confidence >= 0.85) {
        allResults.push({
          emailId: email.id,
          category: cached.category,
          confidence: cached.confidence,
          source: 'cache',
          reasoning: `Cached from previous ${cached.categorizedBy} classification`,
          suggestedActions: [],
        })
        stats.resolvedByCache++
      } else {
        uncached.push(email)
      }
    }

    console.log(`[Sweepy:Pipeline] Layer 1 (Cache): resolved ${stats.resolvedByCache}, uncached ${uncached.length}`)

    // Report cache progress
    if (stats.resolvedByCache > 0 && options?.onProgress) {
      await options.onProgress(allResults.length, emails.length)
    }

    if (uncached.length === 0) {
      return { results: allResults, stats }
    }
  }

  // === Layer 2: LLM ===
  for (let i = 0; i < uncached.length; i += LLM_BATCH_SIZE) {
    const batch = uncached.slice(i, i + LLM_BATCH_SIZE)

    const llmResults = await classifyWithLLM(batch)
    allResults.push(...llmResults)
    stats.resolvedByLlm += llmResults.length
    stats.llmCostUsd += estimateLLMCost(batch.length)

    // Report progress after each batch
    if (options?.onProgress) {
      await options.onProgress(allResults.length, emails.length)
    }

    // Cache LLM results for future scans
    const cacheEntries = llmResults
      .filter((r) => r.category !== 'unknown')
      .map((result) => {
        const email = batch.find((e) => e.id === result.emailId)
        return email ? {
          senderAddress: email.from.address,
          category: result.category,
          confidence: result.confidence,
          categorizedBy: 'llm' as const,
        } : null
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
    await setSenderCategoriesBatch(userId, cacheEntries)
  }

  console.log(`[Sweepy:Pipeline] Layer 2 (LLM): resolved ${stats.resolvedByLlm}, cost $${stats.llmCostUsd.toFixed(4)}`)
  console.log(`[Sweepy:Pipeline] Complete — total: ${allResults.length}, cache: ${stats.resolvedByCache}, llm: ${stats.resolvedByLlm}`)

  return { results: allResults, stats }
}
