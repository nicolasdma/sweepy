import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { batchId } = await request.json()

  if (!batchId) {
    return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })
  }

  // Verify batch belongs to user and is within undo window (5 minutes)
  const { data: batch, error: batchError } = await supabase
    .from('action_batches')
    .select('id, executed_at, undone_at, scan_id')
    .eq('id', batchId)
    .eq('user_id', user.id)
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  if (batch.undone_at) {
    return NextResponse.json({ error: 'Already undone' }, { status: 400 })
  }

  const executedAt = new Date(batch.executed_at)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  if (executedAt < fiveMinutesAgo) {
    return NextResponse.json({ error: 'Undo window expired (5 minutes)' }, { status: 400 })
  }

  // Get actions in this batch
  const { data: actions, error: actionsError } = await supabase
    .from('suggested_actions')
    .select('id, gmail_email_id, action_type, original_labels')
    .eq('batch_id', batchId)

  if (actionsError || !actions?.length) {
    return NextResponse.json({ error: 'No actions to undo' }, { status: 400 })
  }

  // Get user's Gmail token
  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_access_token')
    .eq('id', user.id)
    .single()

  if (!profile?.gmail_access_token) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
  }

  let undone = 0
  let failed = 0

  // Undo each action via Gmail API
  for (const action of actions) {
    try {
      const gmailId = action.gmail_email_id

      if (action.action_type === 'move_to_trash') {
        // Untrash
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/untrash`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${profile.gmail_access_token}` },
          }
        )
      } else if (action.action_type === 'archive') {
        // Add INBOX label back
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${profile.gmail_access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addLabelIds: ['INBOX'] }),
          }
        )
      } else if (action.action_type === 'mark_read') {
        // Add UNREAD label back
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${profile.gmail_access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
          }
        )
      }

      // Mark action as pending again
      await supabase
        .from('suggested_actions')
        .update({ status: 'pending' })
        .eq('id', action.id)

      undone++
    } catch (err) {
      console.error(`[Sweepy:Undo] Failed to undo action ${action.id}:`, err)
      failed++
    }
  }

  // Mark batch as undone
  await supabase
    .from('action_batches')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', batchId)

  return NextResponse.json({ undone, failed })
}
