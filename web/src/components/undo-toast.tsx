'use client'

import { useState, useEffect, useCallback } from 'react'

interface UndoToastProps {
  batchId: string
  count: number
  onUndo?: () => void
  onDismiss?: () => void
}

export function UndoToast({ batchId, count, onUndo, onDismiss }: UndoToastProps) {
  const [visible, setVisible] = useState(true)
  const [undoing, setUndoing] = useState(false)
  const [undone, setUndone] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(30)

  useEffect(() => {
    if (!visible || undone) return
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setVisible(false)
          onDismiss?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [visible, undone, onDismiss])

  const handleUndo = useCallback(async () => {
    setUndoing(true)
    try {
      const res = await fetch('/api/v1/actions/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })
      if (res.ok) {
        setUndone(true)
        onUndo?.()
        setTimeout(() => {
          setVisible(false)
          onDismiss?.()
        }, 2000)
      }
    } catch {
      // Best effort
    } finally {
      setUndoing(false)
    }
  }, [batchId, onUndo, onDismiss])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
      <div className="flex items-center gap-4 rounded-2xl border border-white/20 bg-[#0f0f23]/95 px-5 py-3.5 shadow-2xl backdrop-blur-xl">
        {undone ? (
          <>
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-sm font-medium text-white">
              Actions undone successfully
            </span>
          </>
        ) : (
          <>
            <div className="relative h-6 w-6">
              <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                <circle
                  cx="12" cy="12" r="10" fill="none" stroke="rgba(129,140,248,0.8)" strokeWidth="2"
                  strokeDasharray={62.83}
                  strokeDashoffset={62.83 * (1 - secondsLeft / 30)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-white">
              {count} action{count !== 1 ? 's' : ''} executed
            </span>
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-indigo-300 transition-all hover:bg-white/20 hover:text-indigo-200 disabled:opacity-50"
            >
              {undoing ? 'Undoing...' : 'Undo'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
