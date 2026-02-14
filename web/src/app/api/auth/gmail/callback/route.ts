import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, storeGmailTokens } from '@/lib/gmail/auth'

/**
 * GET /api/auth/gmail/callback
 * Google redirects here after user authorizes.
 * Exchanges code for tokens and stores them.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  if (error) {
    console.error(`[Sweepy:Gmail] OAuth error: ${error}`)
    return NextResponse.redirect(
      new URL('/dashboard?gmail=error&reason=' + encodeURIComponent(error), appUrl)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?gmail=error&reason=missing_params', appUrl)
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeGmailTokens(state, tokens)

    console.log(`[Sweepy:Gmail] Tokens stored for user ${state}`)
    return NextResponse.redirect(new URL('/dashboard?gmail=connected', appUrl))
  } catch (err) {
    console.error('[Sweepy:Gmail] Token exchange failed:', err)
    return NextResponse.redirect(
      new URL('/dashboard?gmail=error&reason=token_exchange_failed', appUrl)
    )
  }
}
