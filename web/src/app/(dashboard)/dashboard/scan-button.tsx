'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type ScanPhase = 'idle' | 'listing' | 'processing' | 'done' | 'error'

const MAX_RETRIES = 3
const RETRY_BACKOFF_MS = [1000, 3000, 8000]

export function ScanButton({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const abortRef = useRef(false)
  const router = useRouter()

  const processLoop = useCallback(async (scanId: string, totalIds: number, startOffset: number, skipCache: boolean) => {
    let offset = startOffset
    let retries = 0

    while (offset < totalIds && !abortRef.current) {
      try {
        const res = await fetch(`/api/v1/scan/${scanId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, skipCache }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `HTTP ${res.status}`)
        }

        const data = await res.json()
        retries = 0 // Reset retries on success

        setProgress({ processed: data.processedCount, total: totalIds })

        if (data.phase === 'completed') {
          setPhase('done')
          setTimeout(() => router.push(`/scan/${scanId}`), 1200)
          return
        }

        if (data.phase === 'failed') {
          setPhase('error')
          setError('Scan failed during processing. Please try again.')
          return
        }

        offset = data.nextOffset
      } catch (err) {
        retries++
        if (retries > MAX_RETRIES) {
          setPhase('error')
          setError(err instanceof Error ? err.message : 'Processing failed after retries')
          return
        }
        console.warn(`[Sweepy:ScanButton] Retry ${retries}/${MAX_RETRIES}:`, err)
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[retries - 1] || 8000))
      }
    }
  }, [router])

  async function handleScan() {
    if (phase !== 'idle' && phase !== 'error') return

    abortRef.current = false
    setPhase('listing')
    setError(null)
    setProgress({ processed: 0, total: 0 })

    try {
      const res = await fetch('/api/v1/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxEmails: 2000, query: 'in:inbox' }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setError(data.error || 'Failed to start scan')
        return
      }

      // Empty inbox
      if (data.phase === 'completed' || data.totalIds === 0) {
        setPhase('done')
        if (data.scanId) {
          setTimeout(() => router.push(`/scan/${data.scanId}`), 1200)
        }
        return
      }

      setProgress({ processed: 0, total: data.totalIds })
      setPhase('processing')

      // Start the processing loop
      await processLoop(data.scanId, data.totalIds, 0, false)
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
  const isActive = phase !== 'idle' && phase !== 'error'

  if (phase === 'idle' || phase === 'error') {
    if (compact) {
      return (
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleScan}
            disabled={isActive}
            className="glow-button inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold text-white shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Scan inbox
          </button>
          {error && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5">
              <svg className="h-3.5 w-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-4">
          <button
            onClick={handleScan}
            disabled={isActive}
            className="glow-button rounded-xl px-8 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Scan my inbox
          </button>
        </div>
        <p className="mt-2 text-xs text-[#9898b0]">Scans up to 2,000 recent emails. Only metadata is analyzed.</p>
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
            {phase === 'listing' && 'Fetching email list from Gmail...'}
            {phase === 'processing' && 'Classifying with AI...'}
            {phase === 'done' && 'Done! Redirecting...'}
          </p>
          {phase === 'listing' && (
            <p className="mt-0.5 text-xs text-[#9898b0]">This may take a moment</p>
          )}
          {progress.total > 0 && (
            <p className="mt-0.5 font-mono text-xs text-[#9898b0]">
              {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} emails
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

      {/* Pulse indicator for listing phase */}
      {phase === 'listing' && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.04]">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500/60 to-purple-500/60 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  )
}
