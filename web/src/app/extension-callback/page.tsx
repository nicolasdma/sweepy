'use client'

import { useEffect, useState } from 'react'

export default function ExtensionCallbackPage() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch('/api/v1/auth/extension-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to generate token')
        }

        const data = await res.json()
        setToken(data.token)

        // Try to communicate with the extension via postMessage
        window.postMessage(
          { type: 'SWEEPY_AUTH_TOKEN', token: data.token },
          window.location.origin
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchToken()
  }, [])

  const handleCopy = async () => {
    if (!token) return

    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = token
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sweepy</h1>
          <p className="mt-2 text-sm text-gray-600">Extension Authentication</p>
        </div>

        {loading && (
          <div className="mt-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
            <p className="mt-4 text-sm text-gray-600">Generating authentication token...</p>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Authentication failed</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <a
              href="/login?from=extension"
              className="mt-3 inline-block text-sm font-medium text-red-700 underline hover:text-red-800"
            >
              Try again
            </a>
          </div>
        )}

        {token && (
          <div className="mt-8">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">Token generated!</p>
              <p className="mt-1 text-sm text-green-600">
                If Sweepy extension is installed, it will receive this automatically. Otherwise,
                copy the token manually.
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Your token</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={token}
                  className="block w-full truncate rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              This token expires in 24 hours. You can close this tab after the extension confirms
              authentication.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
