import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find users with digest enabled and recent scans
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, digest_email_enabled')
    .eq('digest_email_enabled', true)
    .eq('gmail_connected', true)

  if (error) {
    console.error('[Sweepy:Digest] Failed to fetch users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  let sent = 0
  for (const user of users ?? []) {
    try {
      // Get latest completed scan
      const { data: scan } = await supabaseAdmin
        .from('email_scans')
        .select('id, category_counts, total_emails_scanned, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!scan) continue

      // Get pending actions count
      const { count: pendingCount } = await supabaseAdmin
        .from('suggested_actions')
        .select('id', { count: 'exact', head: true })
        .eq('scan_id', scan.id)
        .eq('status', 'pending')

      if (!pendingCount || pendingCount === 0) continue

      // Get user email from auth
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
      if (!authUser?.user?.email) continue

      // TODO: Send digest email via Resend/SendGrid
      // For now, just log
      console.log(`[Sweepy:Digest] Would send digest to ${authUser.user.email}: ${pendingCount} pending actions from scan ${scan.id}`)
      sent++
    } catch (err) {
      console.error(`[Sweepy:Digest] Failed for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: users?.length ?? 0 })
}
