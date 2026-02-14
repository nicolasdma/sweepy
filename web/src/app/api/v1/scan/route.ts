import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { hasActiveSubscription } from '@/lib/stripe/subscription'
import { listMessageIds, batchGetMessages } from '@/lib/gmail/client'
import { extractMinimalEmailData } from '@/lib/gmail/extractor'
import { categorizeEmails } from '@/lib/ai'
import { getSuggestedActions } from '@/lib/ai/suggested-actions'

const ScanRequestSchema = z.object({
  maxEmails: z.number().min(1).max(5000).default(500),
  query: z.string().default('in:inbox'),
  skipCache: z.boolean().default(false),
})

/**
 * POST /api/v1/scan
 *
 * Starts a scan asynchronously. Returns the scanId immediately.
 * The client polls GET /api/v1/scan/:id/status for progress.
 */
export async function POST(request: NextRequest) {
  // Auth
  const auth = await withAuth('analyze')
  if (auth instanceof NextResponse) return auth

  // Subscription check
  const hasSubscription = await hasActiveSubscription(auth.userId)
  if (!hasSubscription) {
    return NextResponse.json(
      { error: 'Active subscription required', code: 'SUBSCRIPTION_REQUIRED' },
      { status: 403 }
    )
  }

  // Parse request
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const parsed = ScanRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { maxEmails, query, skipCache } = parsed.data
  const supabase = await createServiceRoleClient()

  // Verify Gmail is connected
  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_connected')
    .eq('id', auth.userId)
    .single()

  if (!profile?.gmail_connected) {
    return NextResponse.json(
      { error: 'Gmail not connected. Please connect Gmail first.', code: 'GMAIL_NOT_CONNECTED' },
      { status: 400 }
    )
  }

  // Create scan record
  const { data: scan, error: scanError } = await supabase
    .from('email_scans')
    .insert({
      user_id: auth.userId,
      status: 'running',
      total_emails_scanned: 0,
    })
    .select('id')
    .single()

  if (scanError || !scan) {
    console.error('[Sweepy:Scan] Failed to create scan record:', scanError)
    return NextResponse.json(
      { error: 'Failed to start scan', code: 'SCAN_CREATE_FAILED' },
      { status: 500 }
    )
  }

  // Run the scan in background (don't await)
  runScanInBackground(scan.id, auth.userId, maxEmails, query, skipCache)

  // Return immediately with the scan ID
  return NextResponse.json({ scanId: scan.id, status: 'running' })
}

/**
 * Runs the full scan pipeline in the background.
 * Updates the scan record in Supabase as it progresses.
 */
async function runScanInBackground(
  scanId: string,
  userId: string,
  maxEmails: number,
  query: string,
  skipCache: boolean
) {
  const supabase = await createServiceRoleClient()

  try {
    // Phase 1: List message IDs
    console.log(`[Sweepy:Scan] ${scanId} — Listing messages (query: "${query}", max: ${maxEmails})`)
    const messageIds = await listMessageIds(userId, query, maxEmails)
    console.log(`[Sweepy:Scan] ${scanId} — Found ${messageIds.length} messages`)

    if (messageIds.length === 0) {
      await supabase
        .from('email_scans')
        .update({ status: 'completed', completed_at: new Date().toISOString(), total_emails_scanned: 0 })
        .eq('id', scanId)
      return
    }

    // Phase 2: Fetch metadata
    console.log(`[Sweepy:Scan] ${scanId} — Fetching metadata for ${messageIds.length} messages`)
    const messages = await batchGetMessages(userId, messageIds)

    // Phase 3: Extract MinimalEmailData
    const emails = messages
      .map(extractMinimalEmailData)
      .filter((e): e is NonNullable<typeof e> => e !== null)

    // Update total count so frontend can show it
    await supabase
      .from('email_scans')
      .update({ total_emails_scanned: emails.length })
      .eq('id', scanId)

    console.log(`[Sweepy:Scan] ${scanId} — Extracted ${emails.length} emails, running pipeline`)

    // Phase 4: Classify with LLM pipeline (with progress updates)
    const { results, stats } = await categorizeEmails(emails, userId, {
      skipCache,
      onProgress: async (classified, total) => {
        await supabase
          .from('email_scans')
          .update({
            resolved_by_llm: classified,
            total_emails_scanned: total,
          })
          .eq('id', scanId)
      },
    })

    // Update scan record with final results
    const categoryCountMap = results.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    await supabase
      .from('email_scans')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_emails_scanned: emails.length,
        resolved_by_heuristic: stats.resolvedByHeuristic,
        resolved_by_cache: stats.resolvedByCache,
        resolved_by_llm: stats.resolvedByLlm,
        llm_cost_usd: stats.llmCostUsd,
        category_counts: categoryCountMap,
      })
      .eq('id', scanId)

    // Store suggested actions
    const actions = results.map((r) => {
      const email = emails.find((e) => e.id === r.emailId)
      const suggestedActions = r.suggestedActions.length > 0
        ? r.suggestedActions
        : getSuggestedActions(r.category, email)
      const primaryAction = suggestedActions[0]
      return {
        user_id: userId,
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

    // Update usage tracking
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
          emails_processed: emails.length,
          llm_calls_count: stats.resolvedByLlm > 0 ? Math.ceil(stats.resolvedByLlm / 20) : 0,
          llm_tokens_used: 0,
        },
        { onConflict: 'user_id,period_start' }
      )
    } catch {
      console.warn('[Sweepy:Scan] Failed to update usage tracking (non-fatal)')
    }

    console.log(`[Sweepy:Scan] ${scanId} — Complete: ${emails.length} emails, cache:${stats.resolvedByCache} llm:${stats.resolvedByLlm}`)
  } catch (error) {
    console.error(`[Sweepy:Scan] ${scanId} — Failed:`, error)

    await supabase
      .from('email_scans')
      .update({ status: 'failed' })
      .eq('id', scanId)
  }
}
