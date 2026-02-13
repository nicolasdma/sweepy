import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const TOKEN_EXPIRY_SECONDS = 86400 // 24 hours

function generateExtensionToken(userId: string, email: string): string {
  const secret = process.env.EXTENSION_TOKEN_SECRET
  if (!secret) {
    throw new Error('EXTENSION_TOKEN_SECRET is not configured')
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({ userId, email, iat: now, exp: now + TOKEN_EXPIRY_SECONDS })
  ).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

/**
 * Validate that a redirect_uri is a valid Chrome extension callback URL.
 * Only allows *.chromiumapp.org URLs (used by chrome.identity).
 */
function isValidExtensionRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    return url.hostname.endsWith('.chromiumapp.org')
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const from = searchParams.get('from')
  const redirectUri = searchParams.get('redirect_uri')

  console.log('[Sweepy:AuthCallback] Received callback — from:', from, 'has code:', !!code, 'redirect_uri:', redirectUri)

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Normal web login → dashboard
      if (from !== 'extension') {
        const next = searchParams.get('next') ?? '/dashboard'
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Extension login → generate token
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id && user?.email) {
          const token = generateExtensionToken(user.id, user.email)
          const params = new URLSearchParams({
            token,
            expiresIn: String(TOKEN_EXPIRY_SECONDS),
          })

          // If redirect_uri is a valid chrome.identity callback, redirect there
          if (redirectUri && isValidExtensionRedirectUri(redirectUri)) {
            const target = `${redirectUri}#${params.toString()}`
            console.log('[Sweepy:AuthCallback] Redirecting to chrome.identity callback')
            return NextResponse.redirect(target)
          }

          // Fallback: redirect to extension-callback page (tab-based flow)
          console.log('[Sweepy:AuthCallback] Redirecting to /extension-callback')
          return NextResponse.redirect(`${origin}/extension-callback#${params.toString()}`)
        }
      } catch (err) {
        console.error('[Sweepy:AuthCallback] Failed to generate extension token:', err)
      }

      // Fallback: redirect to extension-callback without token (will show error)
      return NextResponse.redirect(`${origin}/extension-callback#error=token_generation_failed`)
    } else {
      console.error('[Sweepy:AuthCallback] Code exchange failed:', error.message)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
