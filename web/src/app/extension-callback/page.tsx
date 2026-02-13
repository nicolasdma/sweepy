'use client'

import { useEffect, useState } from 'react'

export default function ExtensionCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)

    if (params.get('error')) {
      setStatus('error')
      setErrorMessage('Failed to generate authentication token. Please try again.')
      return
    }

    if (params.get('token')) {
      setStatus('success')
      // The extension's service worker reads the token from the URL hash
      // via chrome.tabs.onUpdated and closes this tab automatically.
      // If the tab isn't closed after a few seconds, the extension
      // might not be installed — show a manual fallback.
      return
    }

    // No hash params at all — user navigated here directly
    setStatus('error')
    setErrorMessage('No authentication data found. Please start the login from the Sweepy extension.')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sweepy</h1>
          <p className="mt-2 text-sm text-gray-600">Extension Authentication</p>
        </div>

        {status === 'loading' && (
          <div className="mt-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
            <p className="mt-4 text-sm text-gray-600">Authenticating...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-8">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">Authentication successful!</p>
              <p className="mt-1 text-sm text-green-600">
                This tab will close automatically. If it doesn&apos;t close in a few seconds,
                you can close it manually — the Sweepy extension is now connected.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-8">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Authentication failed</p>
              <p className="mt-1 text-sm text-red-600">
                {errorMessage}
              </p>
            </div>
            <a
              href="/login?from=extension"
              className="mt-4 block text-center text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Try again
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
