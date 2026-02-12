import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { withAuth } from '@/lib/api-auth'

const TOKEN_EXPIRY_SECONDS = 86400 // 24 hours

function generateExtensionToken(userId: string, email: string): string {
  const secret = process.env.EXTENSION_TOKEN_SECRET
  if (!secret) {
    throw new Error('EXTENSION_TOKEN_SECRET is not configured')
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')

  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      email,
      iat: now,
      exp: now + TOKEN_EXPIRY_SECONDS,
    })
  ).toString('base64url')

  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

export async function POST() {
  const auth = await withAuth('auth')
  if (auth instanceof NextResponse) return auth

  try {
    const token = generateExtensionToken(auth.userId, auth.email)

    return NextResponse.json({
      token,
      expiresIn: TOKEN_EXPIRY_SECONDS,
    })
  } catch (error) {
    console.error('[ExtensionToken] Failed to generate token:', error)
    return NextResponse.json(
      { error: 'Failed to generate token', code: 'TOKEN_GENERATION_FAILED' },
      { status: 500 }
    )
  }
}
