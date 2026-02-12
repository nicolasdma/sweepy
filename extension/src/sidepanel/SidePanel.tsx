import React, { useState } from 'react'

// Set to false before production builds to strip the dev toggle
const __DEV__ = true

type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error'

type EmailCategory =
  | 'newsletter'
  | 'marketing'
  | 'transactional'
  | 'social'
  | 'notification'
  | 'spam'
  | 'personal'
  | 'important'
  | 'unknown'

type ResolutionMethod = 'heuristic' | 'cache' | 'llm'

interface ClassifiedEmail {
  id: string
  sender: string
  subject: string
  category: EmailCategory
  confidence: number
  resolvedBy: ResolutionMethod
}

interface ScanResults {
  emails: ClassifiedEmail[]
  scannedAt: number
}

// ---------- Category config ----------

const CATEGORY_CONFIG: Record<
  EmailCategory,
  { emoji: string; label: string; colorClasses: string; badgeBg: string }
> = {
  spam: {
    emoji: '🚫',
    label: 'Spam',
    colorClasses: 'text-red-700 bg-red-50 border-red-200',
    badgeBg: 'bg-red-100 text-red-700',
  },
  marketing: {
    emoji: '📢',
    label: 'Marketing',
    colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    badgeBg: 'bg-yellow-100 text-yellow-700',
  },
  newsletter: {
    emoji: '📰',
    label: 'Newsletter',
    colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    badgeBg: 'bg-yellow-100 text-yellow-700',
  },
  personal: {
    emoji: '💬',
    label: 'Personal',
    colorClasses: 'text-green-700 bg-green-50 border-green-200',
    badgeBg: 'bg-green-100 text-green-700',
  },
  important: {
    emoji: '⭐',
    label: 'Important',
    colorClasses: 'text-green-700 bg-green-50 border-green-200',
    badgeBg: 'bg-green-100 text-green-700',
  },
  transactional: {
    emoji: '🧾',
    label: 'Transactional',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  social: {
    emoji: '👥',
    label: 'Social',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  notification: {
    emoji: '🔔',
    label: 'Notification',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  unknown: {
    emoji: '❓',
    label: 'Unknown',
    colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
}

// ---------- Mock data ----------

const MOCK_RESULTS: ScanResults = {
  scannedAt: Date.now(),
  emails: [
    {
      id: '1',
      sender: 'newsletter@techcrunch.com',
      subject: 'This Week in AI: OpenAI launches new model',
      category: 'newsletter',
      confidence: 0.95,
      resolvedBy: 'heuristic',
    },
    {
      id: '2',
      sender: 'digest@substack.com',
      subject: 'Your weekly Substack digest',
      category: 'newsletter',
      confidence: 0.91,
      resolvedBy: 'heuristic',
    },
    {
      id: '3',
      sender: 'promo@shopify-store.com',
      subject: '50% OFF everything — ends tonight!',
      category: 'marketing',
      confidence: 0.97,
      resolvedBy: 'heuristic',
    },
    {
      id: '4',
      sender: 'deals@amazon.com',
      subject: 'Lightning deals just for you',
      category: 'marketing',
      confidence: 0.88,
      resolvedBy: 'cache',
    },
    {
      id: '5',
      sender: 'noreply@github.com',
      subject: '[sweepy] PR #42 merged: Add scan progress bar',
      category: 'notification',
      confidence: 0.93,
      resolvedBy: 'heuristic',
    },
    {
      id: '6',
      sender: 'no-reply@accounts.google.com',
      subject: 'Security alert: new sign-in from Chrome on Mac',
      category: 'transactional',
      confidence: 0.89,
      resolvedBy: 'llm',
    },
    {
      id: '7',
      sender: 'spam-king@totallylegit.biz',
      subject: 'You won $1,000,000!!! Click here NOW',
      category: 'spam',
      confidence: 0.99,
      resolvedBy: 'heuristic',
    },
    {
      id: '8',
      sender: 'h4cker@cheap-meds.ru',
      subject: 'Congrats!! Claim your prize immediately',
      category: 'spam',
      confidence: 0.96,
      resolvedBy: 'llm',
    },
    {
      id: '9',
      sender: 'maria.garcia@gmail.com',
      subject: 'Re: Dinner plans for Saturday?',
      category: 'personal',
      confidence: 0.85,
      resolvedBy: 'llm',
    },
    {
      id: '10',
      sender: 'boss@company.com',
      subject: 'Q1 review — action items for your team',
      category: 'important',
      confidence: 0.82,
      resolvedBy: 'llm',
    },
  ],
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
  const counts: Record<ResolutionMethod, number> = {
    heuristic: 0,
    cache: 0,
    llm: 0,
  }
  for (const email of emails) {
    counts[email.resolvedBy]++
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

function SummaryStats({ emails }: { emails: ClassifiedEmail[] }) {
  const resolution = countByResolution(emails)
  const cleanupCount = getCleanupCount(emails)

  return (
    <div className="mb-4 space-y-3">
      {/* Total scanned */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm font-semibold text-blue-800">
          {emails.length} emails scanned
        </p>
        <div className="mt-1 flex gap-3 text-xs text-blue-600">
          {resolution.heuristic > 0 && (
            <span>Heuristic: {resolution.heuristic}</span>
          )}
          {resolution.cache > 0 && <span>Cache: {resolution.cache}</span>}
          {resolution.llm > 0 && <span>LLM: {resolution.llm}</span>}
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
              key={email.id}
              className="border-b border-inherit px-3 py-2 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {email.sender}
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
  const [results] = useState<ScanResults>(MOCK_RESULTS)

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

  const grouped = groupByCategory(results.emails)

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

        {/* Dev toggle */}
        {__DEV__ && (
          <button
            onClick={() =>
              setStatus((s) => (s === 'idle' ? 'complete' : 'idle'))
            }
            className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600"
            title="Toggle idle/complete (dev only)"
          >
            {status === 'complete' ? 'DEV: idle' : 'DEV: results'}
          </button>
        )}
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

      {/* Error state */}
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

      {/* Complete state — results */}
      {status === 'complete' && (
        <div>
          {/* Summary stats */}
          <SummaryStats emails={results.emails} />

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

          {/* Scan again */}
          <button
            onClick={() => setStatus('idle')}
            className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  )
}
