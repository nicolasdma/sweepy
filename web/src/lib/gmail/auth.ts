import { createServiceRoleClient } from '@/lib/supabase/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

function getClientId(): string {
  const id = process.env.GMAIL_CLIENT_ID
  if (!id) throw new Error('GMAIL_CLIENT_ID not configured')
  return id
}

function getClientSecret(): string {
  const secret = process.env.GMAIL_CLIENT_SECRET
  if (!secret) throw new Error('GMAIL_CLIENT_SECRET not configured')
  return secret
}

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/gmail/callback`
}

/**
 * Generate the Google OAuth URL to redirect the user to.
 * `state` carries the userId so the callback knows who to store tokens for.
 */
export function getGmailAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

/**
 * Get a valid access token for the user, refreshing if needed.
 * Reads from and writes to the profiles table.
 */
export async function getValidToken(userId: string): Promise<string> {
  const supabase = await createServiceRoleClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at, gmail_connected')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    throw new Error('Profile not found')
  }

  if (!profile.gmail_connected || !profile.gmail_refresh_token) {
    throw new Error('Gmail not connected')
  }

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(profile.gmail_token_expires_at)
  const bufferMs = 5 * 60 * 1000
  if (profile.gmail_access_token && expiresAt.getTime() - bufferMs > Date.now()) {
    return profile.gmail_access_token
  }

  // Refresh the token
  console.log(`[Sweepy:Gmail] Refreshing token for user ${userId}`)
  const { accessToken, expiresAt: newExpiresAt } = await refreshAccessToken(
    profile.gmail_refresh_token
  )

  // Store the new token
  await supabase
    .from('profiles')
    .update({
      gmail_access_token: accessToken,
      gmail_token_expires_at: newExpiresAt.toISOString(),
    })
    .eq('id', userId)

  return accessToken
}

/**
 * Store Gmail tokens after successful OAuth callback.
 */
export async function storeGmailTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date }
): Promise<void> {
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      gmail_access_token: tokens.accessToken,
      gmail_refresh_token: tokens.refreshToken,
      gmail_token_expires_at: tokens.expiresAt.toISOString(),
      gmail_connected: true,
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to store Gmail tokens: ${error.message}`)
  }
}

/**
 * Revoke Gmail access and clear tokens.
 */
export async function revokeGmailAccess(userId: string): Promise<void> {
  const supabase = await createServiceRoleClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_access_token')
    .eq('id', userId)
    .single()

  // Revoke with Google (best effort)
  if (profile?.gmail_access_token) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${profile.gmail_access_token}`, {
        method: 'POST',
      })
    } catch {
      console.warn('[Sweepy:Gmail] Revoke request failed (non-fatal)')
    }
  }

  // Clear tokens in DB
  await supabase
    .from('profiles')
    .update({
      gmail_access_token: null,
      gmail_refresh_token: null,
      gmail_token_expires_at: null,
      gmail_connected: false,
    })
    .eq('id', userId)
}
