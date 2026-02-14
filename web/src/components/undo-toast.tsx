'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const UNDO_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

interface UndoToastProps {
  batchId: string
  executedCount: number
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ batchId, executedCount, onUndo, onDismiss }: UndoToastProps) {
  const [remainingMs, setRemainingMs] = useState(UNDO_WINDOW_MS)
  const startRef = useRef(Date.now())
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const remaining = UNDO_WINDOW_MS - elapsed
      if (remaining <= 0) {
        clearInterval(interval)
        onDismiss()
      } else {
        setRemainingMs(remaining)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [onDismiss])

  const handleUndo = useCallback(async () => {
    setUndoing(true)
    try {
      const res = await fetch('/api/v1/actions/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[Sweepy:UndoToast] Undo failed:', data)
      }
      onUndo()
    } catch (err) {
      console.error('[Sweepy:UndoToast] Undo error:', err)
    } finally {
      setUndoing(false)
    }
  }, [batchId, onUndo])

  const minutes = Math.floor(remainingMs / 60000)
  const seconds = Math.floor((remainingMs % 60000) / 1000)
  const progressPct = (remainingMs / UNDO_WINDOW_MS) * 100

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
      <div className="glass-card rounded-xl border border-black/[0.06] p-4 shadow-lg backdrop-blur-xl min-w-[340px]">
        {/* Progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.04] mb-3">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0f0f23]">
              {executedCount} email{executedCount !== 1 ? 's' : ''} cleaned up
            </p>
            <p className="text-xs text-[#9898b0]">
              Undo available for {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-500/20 disabled:opacity-50"
            >
              {undoing ? 'Undoing...' : 'Undo'}
            </button>
            <button
              onClick={onDismiss}
              className="rounded-lg p-2 text-[#9898b0] transition-colors hover:text-[#0f0f23]"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
