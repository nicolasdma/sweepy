import React, { useEffect, useState } from 'react'
import { authManager } from '../lib/auth'

export function Popup() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authManager.init().then((authed) => {
      setIsAuthenticated(authed)
      setLoading(false)
    })
  }, [])

  const handleLogin = () => {
    chrome.tabs.create({ url: authManager.getLoginUrl() })
  }

  const handleOpenSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  }

  const handleLogout = async () => {
    await authManager.logout()
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="w-72 bg-white p-4">
        <h1 className="text-lg font-bold text-gray-900">Sweepy</h1>
        <p className="mt-2 text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="w-72 bg-white p-4">
      <h1 className="mb-1 text-lg font-bold text-gray-900">Sweepy</h1>
      <p className="mb-4 text-xs text-gray-400">AI Email Manager</p>

      {!isAuthenticated ? (
        <div>
          <p className="mb-3 text-sm text-gray-600">
            Connect your Google account to get started.
          </p>
          <button
            onClick={handleLogin}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect with Google
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-600">
            Open the side panel on Gmail to scan your inbox.
          </p>
          <button
            onClick={handleOpenSidePanel}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Sweepy
          </button>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
