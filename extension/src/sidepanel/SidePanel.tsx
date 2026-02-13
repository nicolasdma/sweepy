import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MessageBus } from '@/lib/message-bus'
import type {
  ScanStatus,
  ScanStats,
  WorkerToSidePanelMessage,
} from '@shared/types/messages'
import { isExtensionMessage } from '@shared/types/messages'
import type { ClassifiedEmail, EmailCategory, CategorizationSource } from '@shared/types/categories'

// ---------- Category config ----------

const CATEGORY_CONFIG: Record<
  EmailCategory,
  { emoji: string; label: string; colorClasses: string; badgeBg: string }
> = {
  spam: {
    emoji: '\u{1F6AB}',
    label: 'Spam',
    colorClasses: 'text-red-700 bg-red-50 border-red-200',
    badgeBg: 'bg-red-100 text-red-700',
  },
  marketing: {
    emoji: '\u{1F4E2}',
    label: 'Marketing',
    colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    badgeBg: 'bg-yellow-100 text-yellow-700',
  },
  newsletter: {
    emoji: '\u{1F4F0}',
    label: 'Newsletter',
    colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    badgeBg: 'bg-yellow-100 text-yellow-700',
  },
  personal: {
    emoji: '\u{1F4AC}',
    label: 'Personal',
    colorClasses: 'text-green-700 bg-green-50 border-green-200',
    badgeBg: 'bg-green-100 text-green-700',
  },
  important: {
    emoji: '\u{2B50}',
    label: 'Important',
    colorClasses: 'text-green-700 bg-green-50 border-green-200',
    badgeBg: 'bg-green-100 text-green-700',
  },
  transactional: {
    emoji: '\u{1F9FE}',
    label: 'Transactional',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  social: {
    emoji: '\u{1F465}',
    label: 'Social',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  notification: {
    emoji: '\u{1F514}',
    label: 'Notification',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  unknown: {
    emoji: '\u{2753}',
    label: 'Unknown',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
}

// ---------- Helpers ----------

function groupByCategory(emails: ClassifiedEmail[]) {
  const groups: Partial<Record<EmailCategory, ClassifiedEmail[]>> = {}
  for (const email of emails) {
    if (!groups[email.category]) {
      groups[email.category] = []
    }
    groups[email.category]!.push(email)
  }
  return groups
}

function countByResolution(emails: ClassifiedEmail[]) {
  const counts: Record<CategorizationSource, number> = {
    heuristic: 0,
    cache: 0,
    llm: 0,
    user_override: 0,
  }
  for (const email of emails) {
    counts[email.categorizedBy]++
  }
  return counts
}

const CLEANUP_CATEGORIES: EmailCategory[] = [
  'spam',
  'marketing',
  'newsletter',
  'notification',
]

function getCleanupCount(emails: ClassifiedEmail[]) {
  return emails.filter((e) => CLEANUP_CATEGORIES.includes(e.category)).length
}

// Category display order (most actionable first)
const CATEGORY_ORDER: EmailCategory[] = [
  'spam',
  'marketing',
  'newsletter',
  'notification',
  'social',
  'transactional',
  'personal',
  'important',
  'unknown',
]

// ---------- Sub-components ----------

function SummaryStats({ emails, stats }: { emails: ClassifiedEmail[]; stats: ScanStats | null }) {
  const resolution = stats ?? {
    total: emails.length,
    resolvedByHeuristic: countByResolution(emails).heuristic,
    resolvedByCache: countByResolution(emails).cache,
    resolvedByLlm: countByResolution(emails).llm,
  }
  const cleanupCount = getCleanupCount(emails)

  return (
    <div className="mb-4 space-y-3">
      {/* Total scanned */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm font-semibold text-blue-800">
          {emails.length} emails scanned
        </p>
        <div className="mt-1 flex gap-3 text-xs text-blue-600">
          {resolution.resolvedByHeuristic > 0 && (
            <span>Heuristic: {resolution.resolvedByHeuristic}</span>
          )}
          {resolution.resolvedByCache > 0 && <span>Cache: {resolution.resolvedByCache}</span>}
          {resolution.resolvedByLlm > 0 && <span>LLM: {resolution.resolvedByLlm}</span>}
        </div>
      </div>

      {/* Cleanup potential */}
      {cleanupCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800">
            {cleanupCount} email{cleanupCount !== 1 ? 's' : ''} suggested for
            cleanup
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            Spam, marketing, newsletters, and notifications
          </p>
        </div>
      )}
    </div>
  )
}

function CategorySection({
  category,
  emails,
}: {
  category: EmailCategory
  emails: ClassifiedEmail[]
}) {
  const [expanded, setExpanded] = useState(false)
  const config = CATEGORY_CONFIG[category]

  return (
    <div className={`mb-2 rounded-lg border ${config.colorClasses}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{config.emoji}</span>
          <span className="text-sm font-semibold">{config.label}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${config.badgeBg}`}
          >
            {emails.length}
          </span>
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Email list */}
      {expanded && (
        <ul className="border-t border-inherit">
          {emails.map((email) => (
            <li
              key={email.emailId}
              className="border-b border-inherit px-3 py-2 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {email.sender.name || email.sender.address}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {email.subject}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  {Math.round(email.confidence * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Main component ----------

export function SidePanel() {
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [phase, setPhase] = useState<'extracting' | 'analyzing'>('extracting')
  const [results, setResults] = useState<ClassifiedEmail[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messageBusRef = useRef<MessageBus | null>(null)

  // Initialize message bus and listen for worker messages
  useEffect(() => {
    const bus = new MessageBus('sidepanel')
    messageBusRef.current = bus

    // Listen for incoming messages from the service worker
    const handleMessage = (
      raw: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (!isExtensionMessage(raw)) return false

      const message = raw as WorkerToSidePanelMessage

      switch (message.type) {
        case 'SCAN_PROGRESS':
          setProgress({
            processed: message.payload.processed,
            total: message.payload.total,
          })
          setPhase(message.payload.phase)
          break

        case 'SCAN_COMPLETE':
          setStatus('complete')
          setResults(message.payload.results)
          setStats(message.payload.stats)
          break

        case 'SCAN_ERROR':
          setStatus('error')
          setErrorMessage(message.payload.error)
          break

        case 'SCAN_STATUS':
          setStatus(message.payload.status)
          if (message.payload.progress) {
            setProgress(message.payload.progress)
          }
          break

        case 'VERSION_MISMATCH':
          console.warn(
            '[Sweepy:SidePanel] Version mismatch detected:',
            message.payload,
          )
          break
      }

      sendResponse({ ack: true })
      return true // Keep channel open
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    // Request current scan status on mount (in case we re-opened the panel)
    bus
      .sendToWorker({ type: 'GET_SCAN_STATUS' })
      .then((response) => {
        const state = response as {
          status: ScanStatus
          progress: { processed: number; total: number } | null
          results: ClassifiedEmail[] | null
          error: string | null
        }
        setStatus(state.status)
        if (state.progress) {
          setProgress(state.progress)
        }
        if (state.results) {
          setResults(state.results)
        }
        if (state.error) {
          setErrorMessage(state.error)
        }
      })
      .catch(() => {
        // Worker may not be ready yet — that's OK
      })

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      bus.destroy()
      messageBusRef.current = null
    }
  }, [])

  const handleScan = useCallback(async () => {
    setStatus('scanning')
    setProgress({ processed: 0, total: 0 })
    setPhase('extracting')
    setErrorMessage(null)
    setResults([])
    setStats(null)

    try {
      await messageBusRef.current?.sendToWorker({
        type: 'REQUEST_SCAN',
        payload: { maxEmails: 1000, maxDays: 30 },
      })
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to start scan',
      )
    }
  }, [])

  const handleCancel = useCallback(async () => {
    try {
      await messageBusRef.current?.sendToWorker({ type: 'CANCEL_SCAN' })
      setStatus('idle')
    } catch {
      // Best effort
    }
  }, [])

  const grouped = groupByCategory(results)

  return (
    <div className="min-h-screen bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">Sweepy</h1>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            Phase 1
          </span>
        </div>
      </div>

      {/* Idle state */}
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

      {/* Scanning state */}
      {status === 'scanning' && (
        <div className="py-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {phase === 'extracting' ? 'Extracting emails...' : 'Analyzing with AI...'}
            </span>
            <span className="text-gray-500">
              {progress.total > 0
                ? `${progress.processed} / ${progress.total}`
                : 'Starting...'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className={`h-2 rounded-full transition-all ${
                phase === 'analyzing' ? 'bg-purple-600' : 'bg-blue-600'
              }`}
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.processed / progress.total) * 100}%`
                    : '0%',
              }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {phase === 'extracting'
              ? 'Reading your emails from Gmail...'
              : 'Running AI categorization pipeline...'}
          </p>
          <button
            onClick={handleCancel}
            className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel Scan
          </button>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {errorMessage ??
              'Something went wrong. Please reload Gmail and try again.'}
          </p>
          <button
            onClick={() => {
              setStatus('idle')
              setErrorMessage(null)
            }}
            className="mt-2 text-sm text-red-600 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Complete state — results */}
      {status === 'complete' && (
        <div>
          {results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">
                No emails found to categorize. Try adjusting the scan settings.
              </p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <SummaryStats emails={results} stats={stats} />

              {/* Category groups */}
              <div>
                {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map(
                  (cat) => (
                    <CategorySection
                      key={cat}
                      category={cat}
                      emails={grouped[cat]!}
                    />
                  ),
                )}
              </div>
            </>
          )}

          {/* Scan again */}
          <button
            onClick={() => {
              setStatus('idle')
              setResults([])
              setStats(null)
            }}
            className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  )
}
