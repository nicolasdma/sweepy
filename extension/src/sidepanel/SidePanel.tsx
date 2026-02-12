import React, { useState } from 'react'

type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error'

export function SidePanel() {
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [progress, setProgress] = useState({ processed: 0, total: 0 })

  const handleScan = async () => {
    setStatus('scanning')
    try {
      await chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        type: 'REQUEST_SCAN',
        payload: { maxEmails: 1000, maxDays: 30 },
        source: 'sidepanel',
        timestamp: Date.now(),
      })
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900">Sweepy</h1>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
          Phase 1
        </span>
      </div>

      {status === 'idle' && (
        <div className="py-8 text-center">
          <p className="mb-4 text-sm text-gray-600">
            Scan your inbox to see AI-powered categorization and cleanup
            suggestions.
          </p>
          <button
            onClick={handleScan}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Scan Inbox
          </button>
          <p className="mt-2 text-xs text-gray-400">
            Last 30 days, up to 1,000 emails
          </p>
        </div>
      )}

      {status === 'scanning' && (
        <div className="py-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Scanning...</span>
            <span className="text-gray-500">
              {progress.processed} / {progress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.processed / progress.total) * 100}%`
                    : '0%',
              }}
            />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Something went wrong. Please reload Gmail and try again.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-2 text-sm text-red-600 underline"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'complete' && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-600">
            Scan results will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
