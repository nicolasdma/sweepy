'use client'

import { useEffect, useRef, useCallback } from 'react'

interface ActionBreakdown {
  label: string
  count: number
  variant?: 'destructive' | 'default'
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  actions: ActionBreakdown[]
  confirmText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  actions,
  confirmText = 'Confirm',
  variant = 'default',
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleKeyDown)
    confirmRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const totalCount = actions.reduce((sum, a) => sum + a.count, 0)
  const hasDestructive = actions.some((a) => a.variant === 'destructive')
  const isDestructive = variant === 'destructive' || hasDestructive

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative mx-4 w-full max-w-md rounded-2xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-xl animate-fade-in-up"
      >
        {/* Icon */}
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isDestructive ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
          {isDestructive ? (
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h2
          id="confirm-title"
          className="mt-4 text-center text-lg font-semibold text-[#0f0f23]"
        >
          {title}
        </h2>

        {description && (
          <p className="mt-2 text-center text-sm text-[#64648a]">{description}</p>
        )}

        {/* Action breakdown */}
        <div className="mt-5 space-y-2">
          {actions.map((action) => (
            <div
              key={action.label}
              className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
                action.variant === 'destructive'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-black/[0.03] border border-black/[0.04]'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  action.variant === 'destructive' ? 'text-red-700' : 'text-[#0f0f23]'
                }`}
              >
                {action.label}
              </span>
              <span
                className={`font-mono text-sm font-semibold ${
                  action.variant === 'destructive' ? 'text-red-600' : 'text-[#64648a]'
                }`}
              >
                {action.count.toLocaleString()} email{action.count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}

          {actions.length > 1 && (
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-xs font-medium text-[#9898b0] uppercase tracking-wider">Total</span>
              <span className="font-mono text-sm font-bold text-[#0f0f23]">
                {totalCount.toLocaleString()} email{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-black/[0.06] bg-white/60 px-4 py-2.5 text-sm font-medium text-[#64648a] transition-all hover:border-black/10 hover:text-[#0f0f23]"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'glow-button'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
