import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find users due for auto-scan
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, auto_scan_frequency, last_auto_scan_at')
    .eq('auto_scan_enabled', true)
    .eq('gmail_connected', true)

  if (error) {
    console.error('[Sweepy:AutoScan] Failed to fetch users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  const dueUsers = (users ?? []).filter((user) => {
    if (!user.last_auto_scan_at) return true
    const lastScan = new Date(user.last_auto_scan_at)
    const hoursSince = (now.getTime() - lastScan.getTime()) / (1000 * 60 * 60)
    return user.auto_scan_frequency === 'daily' ? hoursSince >= 20 : hoursSince >= 140
  })

  console.log(`[Sweepy:AutoScan] ${dueUsers.length} users due for auto-scan`)

  let triggered = 0
  for (const user of dueUsers) {
    try {
      // Trigger scan via internal API
      const scanRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-internal-secret': process.env.CRON_SECRET!,
        },
        body: JSON.stringify({ maxEmails: 2000, query: 'in:inbox' }),
      })

      if (scanRes.ok) {
        await supabaseAdmin
          .from('profiles')
          .update({ last_auto_scan_at: now.toISOString() })
          .eq('id', user.id)
        triggered++
      }
    } catch (err) {
      console.error(`[Sweepy:AutoScan] Failed for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ triggered, total: dueUsers.length })
}
