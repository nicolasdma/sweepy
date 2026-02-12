import React, { useEffect, useState } from 'react'

export function Popup() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    chrome.storage.session.get('sweepy:token', (result) => {
      setIsAuthenticated(!!result['sweepy:token'])
    })
  }, [])

  const handleLogin = () => {
    chrome.tabs.create({ url: 'http://localhost:3000/login?from=extension' })
  }

  const handleOpenSidePanel = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })
  }

  return (
    <div className="w-72 bg-white p-4">
      <h1 className="mb-2 text-lg font-bold text-gray-900">Sweepy</h1>

      {!isAuthenticated ? (
        <div>
          <p className="mb-3 text-sm text-gray-600">
            Connect your Google account to get started.
          </p>
          <button
            onClick={handleLogin}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect with Google
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-600">
            Open the side panel to scan your inbox.
          </p>
          <button
            onClick={handleOpenSidePanel}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Sweepy
          </button>
        </div>
      )}
    </div>
  )
}
