'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (from === 'extension') {
      callbackUrl.searchParams.set('from', 'extension')
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-black/[0.06] bg-white/80 backdrop-blur-xl p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0f0f23]">Sweepy</h1>
        <p className="mt-2 text-sm text-[#64648a]">
          Sign in to manage your inbox with AI
        </p>
      </div>

      <button
        onClick={handleGoogleLogin}
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <p className="mt-6 text-center text-xs text-[#9898b0]">
        By signing in, you agree to our{' '}
        <a href="/terms" className="underline">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline">
          Privacy Policy
        </a>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf8]">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-lg border border-black/[0.06] bg-white/80 backdrop-blur-xl p-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[#0f0f23]">Sweepy</h1>
              <p className="mt-2 text-sm text-[#64648a]">Loading...</p>
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
