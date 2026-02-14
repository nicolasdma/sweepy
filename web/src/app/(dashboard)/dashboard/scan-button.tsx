'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type ScanPhase = 'idle' | 'starting' | 'classifying' | 'done' | 'error'

export function ScanButton() {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [progress, setProgress] = useState({ classified: 0, total: 0 })
  const router = useRouter()

  const pollProgress = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/scan/${id}/status`)
      if (!res.ok) return
      const { scan } = await res.json()

      if (scan.status === 'completed') {
        setPhase('done')
        const total = scan.total_emails_scanned ?? 0
        const classified = scan.resolved_by_llm ?? 0
        if (total > 0) setProgress({ classified: total, total })
        setTimeout(() => router.push(`/scan/${id}`), 1200)
        return
      }
      if (scan.status === 'failed') {
        setPhase('error')
        setError('Scan failed. Please try again.')
        return
      }

      const classified = scan.resolved_by_llm ?? 0
      const total = scan.total_emails_scanned ?? 0
      if (total > 0) {
        setPhase('classifying')
        setProgress({ classified, total })
      }
    } catch {
      // Ignore polling errors
    }
  }, [router])

  useEffect(() => {
    if ((phase !== 'starting' && phase !== 'classifying') || !scanId) return
    const interval = setInterval(() => pollProgress(scanId), 2000)
    // Poll immediately on mount
    pollProgress(scanId)
    return () => clearInterval(interval)
  }, [phase, scanId, pollProgress])

  async function handleScan() {
    setPhase('starting')
    setError(null)
    setProgress({ classified: 0, total: 0 })

    try {
      const res = await fetch('/api/v1/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxEmails: 2000, query: 'in:inbox' }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setError(data.error || 'Scan failed')
        return
      }

      // Scan started — set ID to trigger polling
      setScanId(data.scanId)
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.classified / progress.total) * 100) : 0

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-4">
          <button
            onClick={handleScan}
            className="glow-button rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
          >
            Scan My Inbox
          </button>
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2.5">
            <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // Active scan — animated progress
  return (
    <div className="glass-card w-full rounded-xl p-6 animate-fade-in-up">
      <div className="flex items-center gap-4">
        {/* Spinner */}
        <div className="relative flex h-11 w-11 items-center justify-center">
          {phase === 'done' ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          ) : (
            <svg className="h-11 w-11 animate-spin" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="18" stroke="rgba(99,102,241,0.15)" strokeWidth="4" />
              <path
                d="M40 22a18 18 0 00-18-18"
                stroke="url(#spin-gradient)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="spin-gradient" x1="40" y1="22" x2="22" y2="4">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-[#0f0f23]">
            {phase === 'starting' && 'Fetching emails from Gmail...'}
            {phase === 'classifying' && 'Classifying with AI...'}
            {phase === 'done' && 'Done! Redirecting...'}
          </p>
          {phase === 'starting' && progress.total === 0 && (
            <p className="mt-0.5 text-xs text-[#9898b0]">This may take a moment</p>
          )}
          {progress.total > 0 && (
            <p className="mt-0.5 font-mono text-xs text-[#9898b0]">
              {progress.classified.toLocaleString()} / {progress.total.toLocaleString()} emails
            </p>
          )}
        </div>

        {progress.total > 0 && (
          <span className="text-lg font-bold gradient-text">{pct}%</span>
        )}
      </div>

      {/* Progress bar */}
      {progress.total > 0 && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Pulse indicator for starting phase */}
      {phase === 'starting' && progress.total === 0 && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.04]">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500/60 to-purple-500/60 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  )
}
