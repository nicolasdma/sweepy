import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { batchGetMessages } from '@/lib/gmail/client'
import { extractMinimalEmailData } from '@/lib/gmail/extractor'
import { categorizeEmails } from '@/lib/ai'
import { getSuggestedActions } from '@/lib/ai/suggested-actions'

// Each batch should complete well within 60s
export const maxDuration = 60

const BATCH_SIZE = 30

const ProcessRequestSchema = z.object({
  offset: z.number().int().min(0).default(0),
  skipCache: z.boolean().default(false),
})

/**
 * POST /api/v1/scan/:id/process
 *
 * Processes a batch of ~100 emails: fetch metadata → extract → classify → store.
 * Client calls this in a loop, incrementing offset each time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth()
  if (auth instanceof NextResponse) return auth

  const { id: scanId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const parsed = ProcessRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { offset, skipCache } = parsed.data
  const supabase = await createServiceRoleClient()

  // Load scan record
  const { data: scan, error: scanError } = await supabase
    .from('email_scans')
    .select('id, user_id, gmail_message_ids, processed_count, total_ids, scan_phase, category_counts, resolved_by_heuristic, resolved_by_cache, resolved_by_llm, llm_cost_usd')
    .eq('id', scanId)
    .eq('user_id', auth.userId)
    .single()

  if (scanError || !scan) {
    return NextResponse.json(
      { error: 'Scan not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Already completed or failed — return current state
  if (scan.scan_phase === 'completed' || scan.scan_phase === 'failed') {
    return NextResponse.json({
      phase: scan.scan_phase,
      processedCount: scan.processed_count,
      totalIds: scan.total_ids,
      nextOffset: scan.total_ids,
    })
  }

  const allIds: string[] = (scan.gmail_message_ids as string[]) || []

  // Idempotency: if offset < processed_count, this batch was already done
  if (offset < scan.processed_count) {
    return NextResponse.json({
      phase: scan.scan_phase,
      processedCount: scan.processed_count,
      totalIds: scan.total_ids,
      nextOffset: scan.processed_count,
    })
  }

  // Slice the batch
  const batchIds = allIds.slice(offset, offset + BATCH_SIZE)

  // No more IDs to process — finalize
  if (batchIds.length === 0) {
    await finalizeScan(supabase, scanId, auth.userId, scan)
    return NextResponse.json({
      phase: 'completed',
      processedCount: scan.processed_count,
      totalIds: scan.total_ids,
      nextOffset: scan.total_ids,
    })
  }

  console.log(`[Sweepy:Process] Scan ${scanId} — batch offset=${offset}, size=${batchIds.length}`)

  try {
    // Fetch metadata from Gmail
    const messages = await batchGetMessages(auth.userId, batchIds)

    // Extract MinimalEmailData
    const emails = messages
      .map(extractMinimalEmailData)
      .filter((e): e is NonNullable<typeof e> => e !== null)

    // Classify with pipeline
    const { results, stats } = await categorizeEmails(emails, auth.userId, { skipCache })

    // Build suggested actions rows
    const actions = results.map((r) => {
      const email = emails.find((e) => e.id === r.emailId)
      const suggestedActions = r.suggestedActions.length > 0
        ? r.suggestedActions
        : getSuggestedActions(r.category, email)
      const primaryAction = suggestedActions[0]
      return {
        user_id: auth.userId,
        scan_id: scanId,
        gmail_email_id: r.emailId,
        gmail_thread_id: email?.threadId || r.emailId,
        sender_address: email?.from.address || '',
        sender_name: email?.from.name || null,
        subject_preview: email?.subject.slice(0, 100) || null,
        email_date: email?.date || null,
        category: r.category,
        confidence: r.confidence,
        action_type: primaryAction?.type || 'keep',
        reasoning: r.reasoning || null,
        categorized_by: r.source,
        status: 'pending',
      }
    })

    if (actions.length > 0) {
      await supabase.from('suggested_actions').insert(actions)
    }

    // Accumulate category counts
    const existingCounts: Record<string, number> = (scan.category_counts as Record<string, number>) || {}
    const batchCounts = results.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    const mergedCounts: Record<string, number> = { ...existingCounts }
    for (const [cat, count] of Object.entries(batchCounts)) {
      mergedCounts[cat] = (mergedCounts[cat] || 0) + count
    }

    const newProcessedCount = offset + batchIds.length
    const isLastBatch = newProcessedCount >= scan.total_ids

    // Update scan record
    await supabase
      .from('email_scans')
      .update({
        processed_count: newProcessedCount,
        total_emails_scanned: newProcessedCount,
        category_counts: mergedCounts,
        resolved_by_heuristic: (scan.resolved_by_heuristic || 0) + stats.resolvedByHeuristic,
        resolved_by_cache: (scan.resolved_by_cache || 0) + stats.resolvedByCache,
        resolved_by_llm: (scan.resolved_by_llm || 0) + stats.resolvedByLlm,
        llm_cost_usd: (scan.llm_cost_usd || 0) + stats.llmCostUsd,
        ...(isLastBatch
          ? {
              scan_phase: 'completed',
              status: 'completed',
              completed_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq('id', scanId)

    // Update usage tracking on last batch
    if (isLastBatch) {
      await updateUsageTracking(supabase, auth.userId, scan.total_ids, (scan.resolved_by_llm || 0) + stats.resolvedByLlm)
    }

    const phase = isLastBatch ? 'completed' : 'processing'
    console.log(`[Sweepy:Process] Scan ${scanId} — batch done: ${newProcessedCount}/${scan.total_ids} (${phase})`)

    return NextResponse.json({
      phase,
      processedCount: newProcessedCount,
      totalIds: scan.total_ids,
      nextOffset: newProcessedCount,
    })
  } catch (error) {
    console.error(`[Sweepy:Process] Scan ${scanId} — batch failed at offset ${offset}:`, error)

    // Mark as failed
    await supabase
      .from('email_scans')
      .update({ scan_phase: 'failed', status: 'failed' })
      .eq('id', scanId)

    return NextResponse.json(
      { error: 'Batch processing failed', code: 'BATCH_FAILED', phase: 'failed' },
      { status: 500 }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalizeScan(supabase: any, scanId: string, userId: string, scan: any) {
  await supabase
    .from('email_scans')
    .update({
      scan_phase: 'completed',
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', scanId)

  await updateUsageTracking(supabase, userId, scan.total_ids, scan.resolved_by_llm || 0)
  console.log(`[Sweepy:Process] Scan ${scanId} — finalized (all batches done)`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateUsageTracking(supabase: any, userId: string, emailsProcessed: number, llmResolved: number) {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  try {
    await supabase.from('usage_tracking').upsert(
      {
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        scans_count: 1,
        emails_processed: emailsProcessed,
        llm_calls_count: llmResolved > 0 ? Math.ceil(llmResolved / 20) : 0,
        llm_tokens_used: 0,
      },
      { onConflict: 'user_id,period_start' }
    )
  } catch {
    console.warn('[Sweepy:Process] Failed to update usage tracking (non-fatal)')
  }
}
