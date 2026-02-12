import type { MinimalEmailData } from '@shared/types/email'
import type { CategorizationResult } from '@shared/types/categories'
import { applyHeuristicsBatch } from './heuristics'
import { getSenderCategoriesBatch, setSenderCategory } from './sender-cache'
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

/**
 * 3-layer categorization pipeline:
 * 1. Heuristics (sync, $0) → resolves ~60-70%
 * 2. User sender cache (Redis, $0) → resolves ~15-20%
 * 3. LLM (GPT-4o-mini, ~$0.12/1K emails) → resolves rest
 */
export async function categorizeEmails(
  emails: MinimalEmailData[],
  userId: string
): Promise<PipelineResult> {
  const allResults: CategorizationResult[] = []
  const stats: PipelineStats = {
    total: emails.length,
    resolvedByHeuristic: 0,
    resolvedByCache: 0,
    resolvedByLlm: 0,
    llmCostUsd: 0,
  }

  if (emails.length === 0) {
    return { results: allResults, stats }
  }

  // === Layer 1: Heuristics ===
  const { resolved: heuristicResolved, unresolved: afterHeuristics } =
    applyHeuristicsBatch(emails)

  allResults.push(...heuristicResolved)
  stats.resolvedByHeuristic = heuristicResolved.length

  // Cache heuristic results for future lookups
  for (const result of heuristicResolved) {
    const email = emails.find((e) => e.id === result.emailId)
    if (email) {
      await setSenderCategory(
        userId,
        email.from.address,
        result.category,
        result.confidence,
        'heuristic'
      )
    }
  }

  if (afterHeuristics.length === 0) {
    return { results: allResults, stats }
  }

  // === Layer 2: User Sender Cache ===
  const senderAddresses = afterHeuristics.map((e) => e.from.address)
  const cachedCategories = await getSenderCategoriesBatch(
    userId,
    senderAddresses
  )

  const afterCache: MinimalEmailData[] = []

  for (const email of afterHeuristics) {
    const cached = cachedCategories.get(email.from.address.toLowerCase())
    if (cached && cached.confidence >= 0.80) {
      allResults.push({
        emailId: email.id,
        category: cached.category,
        confidence: cached.confidence,
        source: 'cache',
        reasoning: `Cached from previous ${cached.categorizedBy} classification`,
        suggestedActions: [], // Will be filled by the action suggestion logic
      })
      stats.resolvedByCache++
    } else {
      afterCache.push(email)
    }
  }

  if (afterCache.length === 0) {
    return { results: allResults, stats }
  }

  // === Layer 3: LLM ===
  // Process in batches of LLM_BATCH_SIZE
  for (let i = 0; i < afterCache.length; i += LLM_BATCH_SIZE) {
    const batch = afterCache.slice(i, i + LLM_BATCH_SIZE)

    const llmResults = await classifyWithLLM(batch)
    allResults.push(...llmResults)
    stats.resolvedByLlm += llmResults.length
    stats.llmCostUsd += estimateLLMCost(batch.length)

    // Cache LLM results for future lookups
    for (const result of llmResults) {
      const email = batch.find((e) => e.id === result.emailId)
      if (email && result.category !== 'unknown') {
        await setSenderCategory(
          userId,
          email.from.address,
          result.category,
          result.confidence,
          'llm'
        )
      }
    }
  }

  return { results: allResults, stats }
}
