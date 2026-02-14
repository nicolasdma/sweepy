import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createHmac } from 'node:crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { rateLimiters } from '@/lib/redis'

type RateLimitKey = 'auth' | 'analyze' | 'actions'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+$/

export interface AuthenticatedRequest {
  userId: string
  email: string
}

/**
 * Verify a custom extension JWT signed with EXTENSION_TOKEN_SECRET.
 * Returns { userId, email } on success, null on failure.
 */
function verifyExtensionToken(token: string): { userId: string; email: string } | null {
  const secret = process.env.EXTENSION_TOKEN_SECRET
  if (!secret) {
    console.error('[Sweepy:Auth] EXTENSION_TOKEN_SECRET not configured')
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    console.warn('[Sweepy:Auth] Extension token has invalid format (expected 3 parts)')
    return null
  }

  const [header, payload, signature] = parts

  // Verify HMAC-SHA256 signature
  const expectedSignature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  if (signature !== expectedSignature) {
    console.warn('[Sweepy:Auth] Extension token signature mismatch')
    return null
  }

  // Decode and validate payload
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const now = Math.floor(Date.now() / 1000)

    if (decoded.exp && decoded.exp < now) {
      console.warn('[Sweepy:Auth] Extension token expired')
      return null
    }

    if (!decoded.userId || !decoded.email) {
      console.warn('[Sweepy:Auth] Extension token missing userId or email')
      return null
    }

    if (!EMAIL_REGEX.test(decoded.email)) {
      console.warn('[Sweepy:Auth] Extension token has invalid email format')
      return null
    }

    return { userId: decoded.userId, email: decoded.email }
  } catch (err) {
    console.error('[Sweepy:Auth] Failed to decode extension token payload:', err)
    return null
  }
}

export async function withAuth(
  rateLimitKey?: RateLimitKey
): Promise<AuthenticatedRequest | NextResponse> {
  // Check for extension JWT in Authorization header first
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization')

  let userId: string | undefined
  let email: string | undefined

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const result = verifyExtensionToken(token)

    if (result) {
      console.log(`[Sweepy:Auth] Extension JWT verified for user ${result.userId}`)
      userId = result.userId
      email = result.email
    } else {
      // Bearer token present but invalid → return 401 immediately, do NOT fall back
      return NextResponse.json(
        { error: 'Invalid extension token', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    }
  }

  // Fall back to cookie-based Supabase auth (web dashboard) — only if no Bearer header was sent
  if (!userId) {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      console.warn('[Sweepy:Auth] No valid auth found (no Bearer token, no cookie session)')
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    if (!user.email || !EMAIL_REGEX.test(user.email)) {
      console.warn(`[Sweepy:Auth] Supabase user ${user.id} has no valid email`)
      return NextResponse.json(
        { error: 'Invalid account email', code: 'INVALID_EMAIL' },
        { status: 401 }
      )
    }

    console.log(`[Sweepy:Auth] Cookie auth verified for user ${user.id}`)
    userId = user.id
    email = user.email
  }

  if (rateLimitKey && rateLimiters) {
    const limiter = rateLimiters[rateLimitKey]
    const { success, remaining } = await limiter.limit(userId)

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        {
          status: 429,
          headers: { 'X-RateLimit-Remaining': String(remaining) },
        }
      )
    }
  }

  // At this point both userId and email are guaranteed to be defined and validated
  return { userId, email: email as string }
}
