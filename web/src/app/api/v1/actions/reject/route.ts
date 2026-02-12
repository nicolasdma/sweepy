import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-auth'
import { invalidateSenderCache } from '@/lib/ai'
import { createServiceRoleClient } from '@/lib/supabase/server'

const RejectRequestSchema = z.object({
  actionId: z.string().uuid(),
  userCategory: z
    .enum([
      'newsletter', 'marketing', 'transactional', 'social',
      'notification', 'spam', 'personal', 'important', 'unknown',
    ])
    .optional(),
  userAction: z
    .enum(['archive', 'unsubscribe', 'move_to_trash', 'mark_read', 'keep'])
    .optional(),
  feedback: z.string().max(500).optional(),
})

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

  const parsed = RejectRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { actionId, userCategory, userAction } = parsed.data
  const supabase = await createServiceRoleClient()

  // Fetch the action
  const { data: action, error } = await supabase
    .from('suggested_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', auth.userId)
    .single()

  if (error || !action) {
    return NextResponse.json(
      { error: 'Action not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Update action status
  await supabase
    .from('suggested_actions')
    .update({ status: 'rejected' })
    .eq('id', actionId)

  // Save user feedback
  await supabase.from('user_feedback').insert({
    user_id: auth.userId,
    action_id: actionId,
    original_category: action.category,
    original_action: action.action_type,
    original_confidence: action.confidence,
    user_category: userCategory || null,
    user_action: userAction || null,
    feedback_type: userCategory ? 'corrected' : 'rejected',
    sender_address: action.sender_address,
    sender_domain: action.sender_address.split('@')[1] || '',
  })

  // Invalidate sender cache for this user
  await invalidateSenderCache(auth.userId, action.sender_address)

  // If user provided a correction, update sender profile
  if (userCategory) {
    await supabase
      .from('user_sender_profiles')
      .upsert(
        {
          user_id: auth.userId,
          sender_address: action.sender_address,
          sender_domain: action.sender_address.split('@')[1] || '',
          sender_name: action.sender_name,
          category: userCategory,
          confidence: 1.0,
          categorized_by: 'user_override',
        },
        { onConflict: 'user_id,sender_address' }
      )
  }

  return NextResponse.json({
    success: true,
    updatedSenderCategory: userCategory || undefined,
  })
}
