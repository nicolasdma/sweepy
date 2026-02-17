import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { hasActiveSubscription } from '@/lib/stripe/subscription'
import { listMessageIds } from '@/lib/gmail/client'

// Vercel Hobby max: 60s — listing IDs is fast (~2-5s for 5000 emails)
export const maxDuration = 60

const ScanRequestSchema = z.object({
  maxEmails: z.number().min(1).max(5000).default(500),
  query: z.string().default('in:inbox'),
})

/**
 * POST /api/v1/scan
 *
 * Phase 1: Lists Gmail message IDs synchronously, stores them in DB.
 * Returns scanId + totalIds. Client then calls POST /scan/:id/process in a loop.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth('analyze')
  if (auth instanceof NextResponse) return auth

  const hasSubscription = await hasActiveSubscription(auth.userId)
  if (!hasSubscription) {
    return NextResponse.json(
      { error: 'Active subscription required', code: 'SUBSCRIPTION_REQUIRED' },
      { status: 403 }
    )
  }

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

  const { maxEmails, query } = parsed.data
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

  // List message IDs synchronously (~2-5s for 5000 emails)
  console.log(`[Sweepy:Scan] Listing messages (query: "${query}", max: ${maxEmails}) for user ${auth.userId}`)
  let messageIds: string[]
  try {
    messageIds = await listMessageIds(auth.userId, query, maxEmails)
  } catch (error) {
    console.error('[Sweepy:Scan] Failed to list message IDs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails from Gmail', code: 'GMAIL_LIST_FAILED' },
      { status: 502 }
    )
  }

  console.log(`[Sweepy:Scan] Found ${messageIds.length} messages`)

  // Handle empty inbox
  if (messageIds.length === 0) {
    const { data: scan } = await supabase
      .from('email_scans')
      .insert({
        user_id: auth.userId,
        status: 'completed',
        total_emails_scanned: 0,
        gmail_message_ids: [],
        processed_count: 0,
        total_ids: 0,
        scan_phase: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    return NextResponse.json({
      scanId: scan?.id,
      totalIds: 0,
      nextOffset: 0,
      phase: 'completed',
    })
  }

  // Create scan record with message IDs
  const { data: scan, error: scanError } = await supabase
    .from('email_scans')
    .insert({
      user_id: auth.userId,
      status: 'running',
      total_emails_scanned: 0,
      gmail_message_ids: messageIds,
      processed_count: 0,
      total_ids: messageIds.length,
      scan_phase: 'processing',
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

  console.log(`[Sweepy:Scan] Created scan ${scan.id} with ${messageIds.length} IDs`)

  return NextResponse.json({
    scanId: scan.id,
    totalIds: messageIds.length,
    nextOffset: 0,
    phase: 'processing',
  })
}
