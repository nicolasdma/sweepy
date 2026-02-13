import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-auth'
import { categorizeEmails } from '@/lib/ai'
import { createServiceRoleClient } from '@/lib/supabase/server'

const MAX_EMAILS_PER_REQUEST = 50

const MinimalEmailDataSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.object({
    address: z.string().email(),
    name: z.string(),
    domain: z.string(),
  }),
  subject: z.string().max(200),
  snippet: z.string().max(100),
  date: z.string(),
  isRead: z.boolean(),
  headers: z.object({
    listUnsubscribe: z.string().nullable(),
    listUnsubscribePost: z.string().nullable(),
    precedence: z.string().nullable(),
    xCampaign: z.string().nullable(),
    returnPath: z.string().nullable(),
    hasListUnsubscribe: z.boolean(),
    hasPrecedenceBulk: z.boolean(),
    isNoreply: z.boolean(),
    hasReturnPathMismatch: z.boolean(),
  }),
  bodyLength: z.number(),
  linkCount: z.number(),
  imageCount: z.number(),
  hasUnsubscribeText: z.boolean(),
})

const AnalyzeRequestSchema = z.object({
  emails: z.array(MinimalEmailDataSchema).max(MAX_EMAILS_PER_REQUEST),
})

export async function POST(request: NextRequest) {
  // Auth + rate limit
  const auth = await withAuth('analyze')
  if (auth instanceof NextResponse) return auth

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'INVALID_BODY' },
      { status: 400 }
    )
  }

  const parsed = AnalyzeRequestSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[Sweepy:Analyze] Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2))
    return NextResponse.json(
      {
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { emails } = parsed.data
  console.log(`[Sweepy:Analyze] Received ${emails.length} emails from user ${auth.userId}`)

  if (emails.length === 0) {
    return NextResponse.json({
      results: [],
      scanId: null,
      stats: {
        total: 0,
        resolvedByHeuristic: 0,
        resolvedByCache: 0,
        resolvedByLlm: 0,
        llmCostUsd: 0,
      },
    })
  }

  try {
    // Create scan record
    const supabase = await createServiceRoleClient()
    const { data: scan, error: scanError } = await supabase
      .from('email_scans')
      .insert({
        user_id: auth.userId,
        status: 'running',
        total_emails_scanned: emails.length,
      })
      .select('id')
      .single()

    if (scanError) {
      console.error('[Analyze] Failed to create scan record:', scanError)
      return NextResponse.json(
        { error: 'Internal error', code: 'SCAN_CREATE_FAILED' },
        { status: 500 }
      )
    }

    // Run pipeline
    console.log(`[Sweepy:Analyze] Running pipeline for scan ${scan.id}`)
    const { results, stats } = await categorizeEmails(emails, auth.userId)
    console.log(`[Sweepy:Analyze] Pipeline complete — ${results.length} results, heuristic: ${stats.resolvedByHeuristic}, cache: ${stats.resolvedByCache}, llm: ${stats.resolvedByLlm}`)

    // Update scan record with results
    await supabase
      .from('email_scans')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        resolved_by_heuristic: stats.resolvedByHeuristic,
        resolved_by_cache: stats.resolvedByCache,
        resolved_by_llm: stats.resolvedByLlm,
        llm_cost_usd: stats.llmCostUsd,
        category_counts: results.reduce(
          (acc, r) => {
            acc[r.category] = (acc[r.category] || 0) + 1
            return acc
          },
          {} as Record<string, number>
        ),
      })
      .eq('id', scan.id)

    // Store suggested actions
    const actions = results.map((r) => {
      const email = emails.find((e) => e.id === r.emailId)
      const primaryAction = r.suggestedActions[0]
      return {
        user_id: auth.userId,
        scan_id: scan.id,
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
          user_id: auth.userId,
          period_start: periodStart,
          period_end: periodEnd,
          scans_count: 1,
          emails_processed: emails.length,
          llm_calls_count: stats.resolvedByLlm > 0 ? Math.ceil(stats.resolvedByLlm / 20) : 0,
          llm_tokens_used: 0, // TODO: track actual tokens
        },
        { onConflict: 'user_id,period_start' }
      )
    } catch {
      console.warn('[Analyze] Failed to update usage tracking')
    }

    return NextResponse.json({
      results,
      scanId: scan.id,
      stats,
    })
  } catch (error) {
    console.error('[Analyze] Pipeline error:', error)
    return NextResponse.json(
      { error: 'Analysis failed', code: 'PIPELINE_ERROR' },
      { status: 500 }
    )
  }
}
