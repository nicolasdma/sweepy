import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { rateLimiters } from '@/lib/redis'

type RateLimitKey = keyof typeof rateLimiters

export interface AuthenticatedRequest {
  userId: string
  email: string
}

export async function withAuth(
  rateLimitKey?: RateLimitKey
): Promise<AuthenticatedRequest | NextResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  if (rateLimitKey) {
    const limiter = rateLimiters[rateLimitKey]
    const { success, remaining } = await limiter.limit(user.id)

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

  return { userId: user.id, email: user.email! }
}
