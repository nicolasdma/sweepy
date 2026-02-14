import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/debug/profile
 * Temporary debug endpoint — shows current user's profile state.
 * DELETE THIS FILE before shipping to production.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    profile: profile
      ? {
          gmail_connected: profile.gmail_connected,
          has_access_token: !!profile.gmail_access_token,
          has_refresh_token: !!profile.gmail_refresh_token,
          token_expires_at: profile.gmail_token_expires_at,
          subscription_status: profile.subscription_status,
          auto_scan_enabled: profile.auto_scan_enabled,
        }
      : null,
    error: error?.message ?? null,
  })
}
