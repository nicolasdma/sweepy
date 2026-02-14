import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { MessageBus } from '@/lib/message-bus'
import { authManager } from '@/lib/auth'
import { CONFIG } from '@/lib/config'
import type {
  ScanStatus,
  ScanStats,
  WorkerToSidePanelMessage,
} from '@shared/types/messages'
import { isExtensionMessage } from '@shared/types/messages'
import type { ClassifiedEmail, EmailCategory, CategorizationSource } from '@shared/types/categories'
import { CATEGORY_CONFIG as SHARED_CATEGORY_CONFIG, CATEGORY_ORDER, CLEANUP_CATEGORIES, CATEGORY_EXT_COLORS, PROTECTED_CATEGORIES } from '@shared/config/categories'

// ---------- Category config ----------

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; colorClasses: string; badgeBg: string }> = Object.fromEntries(
  Object.entries(SHARED_CATEGORY_CONFIG).map(([key, cfg]) => [
    key,
    {
      emoji: cfg.emoji,
      label: cfg.label,
      colorClasses: CATEGORY_EXT_COLORS[key]?.colorClasses ?? 'text-gray-700 bg-gray-50 border-gray-200',
      badgeBg: CATEGORY_EXT_COLORS[key]?.badgeBg ?? 'bg-gray-100 text-gray-700',
    },
  ])
)

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

function getCleanupCount(emails: ClassifiedEmail[]) {
  return emails.filter((e) => CLEANUP_CATEGORIES.includes(e.category)).length
}

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
          {resolution.resolvedByLlm > 0 && <span>AI: {resolution.resolvedByLlm}</span>}
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
        aria-expanded={expanded}
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

// ---------- Error Boundary ----------

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Sweepy:SidePanel] React error boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white p-4">
          <h1 className="text-lg font-bold text-gray-900">Sweepy</h1>
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">Something went wrong.</p>
            <p className="mt-1 text-xs text-red-500">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 text-sm text-red-600 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------- Main component ----------

export function SidePanel() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null) // null = loading
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [phase, setPhase] = useState<'extracting' | 'analyzing'>('extracting')
  const [results, setResults] = useState<ClassifiedEmail[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messageBusRef = useRef<MessageBus | null>(null)

  // Load previous results from local storage on mount
  useEffect(() => {
    if (status === 'idle' && results.length === 0) {
      chrome.storage.local.get(CONFIG.STORAGE_KEYS.LAST_SCAN_RESULTS).then((stored) => {
        const data = stored[CONFIG.STORAGE_KEYS.LAST_SCAN_RESULTS]
        if (data?.results?.length > 0) {
          console.log('[Sweepy:SidePanel] Loaded previous results from local storage:', data.results.length)
          setResults(data.results)
          setStats(data.stats ?? null)
          setStatus('complete')
        }
      }).catch(() => {
        // Local storage access may fail — ignore
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check auth state on mount
  useEffect(() => {
    console.log('[Sweepy:SidePanel] Checking auth state on mount')
    authManager.init().then((authed) => {
      console.log('[Sweepy:SidePanel] Auth state on mount:', authed)
      setIsAuthenticated(authed)
    })
    // Re-check auth when storage changes (e.g., after login in another tab)
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['sweepy:token']) {
        console.log('[Sweepy:SidePanel] Storage change detected for sweepy:token')
        authManager.init().then((authed) => {
          console.log('[Sweepy:SidePanel] Auth state after storage change:', authed)
          setIsAuthenticated(authed)
        })
      }
    }
    chrome.storage.session.onChanged.addListener(listener)
    return () => chrome.storage.session.onChanged.removeListener(listener)
  }, [])

  const [loginLoading, setLoginLoading] = useState(false)

  const handleLogin = async () => {
    console.log('[Sweepy:SidePanel] Login button clicked')
    setLoginLoading(true)
    try {
      await authManager.loginWithIdentity()
      console.log('[Sweepy:SidePanel] loginWithIdentity completed')
    } catch (error) {
      console.error('[Sweepy:SidePanel] loginWithIdentity failed:', error)
      // Fallback to tab-based login
      chrome.tabs.create({ url: authManager.getLoginUrl() })
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await authManager.logout()
    setIsAuthenticated(false)
  }

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
      console.log('[Sweepy:SidePanel] Received message:', message.type)

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
    console.log('[Sweepy:SidePanel] Scan button clicked')
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

  const grouped = useMemo(() => groupByCategory(results), [results])

  // Auth loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-white p-4">
        <h1 className="text-lg font-bold text-gray-900">Sweepy</h1>
        <p className="mt-4 text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white p-4">
        <h1 className="mb-1 text-lg font-bold text-gray-900">Sweepy</h1>
        <p className="mb-6 text-xs text-gray-400">AI Email Manager</p>
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="mb-2 text-sm font-medium text-gray-900">
            Sign in to Sweepy
          </p>
          <p className="mb-6 text-xs text-gray-500">
            Sign in with Google to scan and categorize your inbox with AI.
          </p>
          <button
            onClick={handleLogin}
            disabled={loginLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loginLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">Sweepy</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
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
            Scan My Inbox
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
          <div className="h-2 rounded-full bg-gray-200" role="progressbar">
            <div
              className={`h-2 rounded-full transition-all ${
                phase === 'analyzing' ? 'bg-purple-600' : 'bg-blue-600'
              }`}
              aria-valuenow={progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}
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

export function SidePanelWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <SidePanel />
    </ErrorBoundary>
  )
}
