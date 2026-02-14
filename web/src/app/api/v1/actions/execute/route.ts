import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { batchModifyMessages, trashMessage } from '@/lib/gmail/client'

const ExecuteRequestSchema = z.object({
  actionIds: z.array(z.string().uuid()).min(1).max(1000),
  actionOverride: z.enum(['archive', 'move_to_trash', 'mark_read', 'keep']).optional(),
})

/**
 * POST /api/v1/actions/execute
 * Execute approved actions via Gmail API.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth('actions')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'INVALID_BODY' },
      { status: 400 }
    )
  }

  const parsed = ExecuteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createServiceRoleClient()

  // Load actions in chunks to avoid PostgREST URL length limits
  const CHUNK_SIZE = 100
  type ActionRow = { id: string; gmail_email_id: string; action_type: string; category: string; confidence: number; sender_address: string; subject_preview: string | null }
  const allActions: ActionRow[] = []
  const allIds = parsed.data.actionIds

  for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
    const chunk = allIds.slice(i, i + CHUNK_SIZE)
    const { data, error: chunkError } = await supabase
      .from('suggested_actions')
      .select('id, gmail_email_id, action_type, category, confidence, sender_address, subject_preview')
      .in('id', chunk)
      .eq('user_id', auth.userId)
      .eq('status', 'pending')

    if (chunkError) {
      return NextResponse.json(
        { error: `Database query failed: ${chunkError.message}`, code: 'DB_ERROR' },
        { status: 500 }
      )
    }
    if (data) allActions.push(...data)
  }

  const actions = allActions

  if (actions.length === 0) {
    return NextResponse.json(
      { error: 'No pending actions found', code: 'NO_ACTIONS' },
      { status: 404 }
    )
  }

  // Group by action type (use override if provided)
  const effectiveType = (a: { action_type: string }) =>
    parsed.data.actionOverride ?? a.action_type
  const toArchive = actions.filter((a) => effectiveType(a) === 'archive')
  const toTrash = actions.filter((a) => effectiveType(a) === 'move_to_trash')
  const toMarkRead = actions.filter((a) => effectiveType(a) === 'mark_read')
  const toKeep = actions.filter((a) => effectiveType(a) === 'keep')

  let executed = 0
  let failed = 0
  const errors: string[] = []

  // Archive: remove INBOX label
  if (toArchive.length > 0) {
    try {
      const emailIds = toArchive.map((a) => a.gmail_email_id)
      await batchModifyMessages(auth.userId, emailIds, [], ['INBOX'])
      executed += toArchive.length
    } catch (err) {
      failed += toArchive.length
      errors.push(`Archive failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  // Trash: move each to trash
  if (toTrash.length > 0) {
    for (const action of toTrash) {
      try {
        await trashMessage(auth.userId, action.gmail_email_id)
        executed++
      } catch (err) {
        failed++
        errors.push(`Trash ${action.gmail_email_id} failed: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }
  }

  // Mark read: remove UNREAD label
  if (toMarkRead.length > 0) {
    try {
      const emailIds = toMarkRead.map((a) => a.gmail_email_id)
      await batchModifyMessages(auth.userId, emailIds, [], ['UNREAD'])
      executed += toMarkRead.length
    } catch (err) {
      failed += toMarkRead.length
      errors.push(`Mark read failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  // Keep: just mark as approved, no Gmail action
  executed += toKeep.length

  // Update all action statuses
  const executedIds = actions
    .filter((a) => !errors.some((e) => e.includes(a.gmail_email_id)))
    .map((a) => a.id)

  for (let i = 0; i < executedIds.length; i += CHUNK_SIZE) {
    const chunk = executedIds.slice(i, i + CHUNK_SIZE)
    await supabase
      .from('suggested_actions')
      .update({ status: 'executed', updated_at: new Date().toISOString() })
      .in('id', chunk)
  }

  // Log actions
  const logs = actions
    .filter((a) => executedIds.includes(a.id))
    .map((a) => ({
      user_id: auth.userId,
      email_id: a.gmail_email_id,
      action_type: effectiveType(a),
      confidence_score: a.confidence,
      was_batch_approved: true,
      result: 'success' as const,
      email_subject_hash: '',
    }))

  if (logs.length > 0) {
    await supabase.from('action_log').insert(logs)
  }

  return NextResponse.json({ executed, failed, errors, total: actions.length })
}
