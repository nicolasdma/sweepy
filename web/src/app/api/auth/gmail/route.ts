import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getGmailAuthUrl } from '@/lib/gmail/auth'

/**
 * GET /api/auth/gmail
 * Redirects to Google OAuth consent screen.
 * User must be logged in (Supabase session).
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/login', process.env.NEXT_PUBLIC_APP_URL)
    )
  }

  const authUrl = getGmailAuthUrl(user.id)
  return NextResponse.redirect(authUrl)
}
