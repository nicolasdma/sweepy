'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { CATEGORY_CONFIG as SHARED_CONFIG, CATEGORY_COLORS, PROTECTED_CATEGORIES } from '@shared/config/categories'
import { ConfirmationModal } from '@/components/confirmation-modal'
import { useRouter } from 'next/navigation'

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; accent: string; bg: string }> = Object.fromEntries(
  Object.entries(SHARED_CONFIG).map(([key, cfg]) => [
    key,
    {
      label: cfg.label,
      emoji: cfg.emoji,
      accent: CATEGORY_COLORS[key]?.text ?? 'text-gray-600',
      bg: CATEGORY_COLORS[key]?.gradient ?? 'from-gray-500/8 to-gray-500/3',
    },
  ])
)

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  archive: { label: 'Archive', color: 'bg-blue-500/10 text-blue-700 border border-blue-500/20' },
  move_to_trash: { label: 'Trash', color: 'bg-red-500/10 text-red-700 border border-red-500/20' },
  mark_read: { label: 'Mark Read', color: 'bg-gray-500/10 text-gray-700 border border-gray-500/20' },
  keep: { label: 'Keep', color: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' },
}

const PROTECTED = PROTECTED_CATEGORIES as Set<string>

interface ScanAction {
  id: string
  gmail_email_id: string
  sender_address: string
  sender_name: string | null
  subject_preview: string | null
  email_date: string | null
  category: string
  confidence: number
  action_type: string
  reasoning: string | null
  categorized_by: string
  status: string
}

interface Scan {
  id: string
  status: string
  total_emails_scanned: number
  category_counts: Record<string, number>
  resolved_by_heuristic: number
  resolved_by_cache: number
  resolved_by_llm: number
  created_at: string
  completed_at: string | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ScanResults({ scan, actions, initialCategory }: { scan: Scan; actions: ScanAction[]; initialCategory?: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const a of actions) {
      if (a.status === 'pending' && !PROTECTED.has(a.category)) {
        initial.add(a.id)
      }
    }
    return initial
  })
  const [executing, setExecuting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; executed: number; failed: number } | null>(null)
  const [result, setResult] = useState<{ executed: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialCategory ?? null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const filteredCategoryRef = useRef<HTMLDivElement>(null)

  // Collapse all categories except the filtered one on initial load
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    if (!initialCategory) return new Set()
    const allCategories = new Set(actions.filter((a) => a.status === 'pending').map((a) => a.category))
    allCategories.delete(initialCategory)
    return allCategories
  })

  // Scroll to filtered category on mount
  useEffect(() => {
    if (initialCategory && filteredCategoryRef.current) {
      filteredCategoryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [initialCategory])

  const pendingActions = useMemo(() => actions.filter((a) => a.status === 'pending'), [actions])
  const executedActions = useMemo(() => actions.filter((a) => a.status === 'executed'), [actions])
  const nonPendingActions = useMemo(() => actions.filter((a) => a.status !== 'pending'), [actions])

  // Visible pending actions (respects category filter)
  const visiblePending = useMemo(
    () => categoryFilter ? pendingActions.filter((a) => a.category === categoryFilter) : pendingActions,
    [pendingActions, categoryFilter]
  )

  // Non-pending actions for filtered category (shown as read-only when filtering)
  const filteredNonPending = useMemo(
    () => categoryFilter ? nonPendingActions.filter((a) => a.category === categoryFilter) : [],
    [nonPendingActions, categoryFilter]
  )

  // How many of the visible actions are selected
  const visibleSelectedCount = useMemo(
    () => visiblePending.filter((a) => selected.has(a.id)).length,
    [visiblePending, selected]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, ScanAction[]>()
    for (const action of visiblePending) {
      const existing = map.get(action.category) || []
      existing.push(action)
      map.set(action.category, existing)
    }
    return [...map.entries()].sort(([, a], [, b]) => b.length - a.length)
  }, [visiblePending])

  function toggleCategory(category: string) {
    const categoryActions = pendingActions.filter((a) => a.category === category)
    const allSelected = categoryActions.every((a) => selected.has(a.id))

    setSelected((prev) => {
      const next = new Set(prev)
      for (const a of categoryActions) {
        if (allSelected) {
          next.delete(a.id)
        } else {
          next.add(a.id)
        }
      }
      return next
    })
  }

  function toggleAction(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleCollapse(category: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function getEffectiveAction(action: ScanAction): string {
    // Fallback unsubscribe to archive since unsubscribe is not implemented
    if (action.action_type === 'unsubscribe') return 'archive'
    return action.action_type
  }

  async function executeSelected() {
    if (visibleSelectedCount === 0) return

    setExecuting(true)
    setError(null)
    setResult(null)

    try {
      // Only execute visible selected actions
      const visibleIds = new Set(visiblePending.map((a) => a.id))
      const selectedActions = actions.filter((a) => selected.has(a.id) && visibleIds.has(a.id))
      const byAction = new Map<string, string[]>()
      for (const action of selectedActions) {
        const effectiveAction = getEffectiveAction(action)
        const ids = byAction.get(effectiveAction) || []
        ids.push(action.id)
        byAction.set(effectiveAction, ids)
      }

      // Flatten all batches: chunk each action group into batches of 50
      const BATCH_SIZE = 50
      const batches: { actionType: string; ids: string[] }[] = []
      for (const [actionType, ids] of byAction) {
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          batches.push({ actionType, ids: ids.slice(i, i + BATCH_SIZE) })
        }
      }

      const totalCount = selectedActions.length
      let totalExecuted = 0
      let totalFailed = 0
      let totalDone = 0

      setProgress({ done: 0, total: totalCount, executed: 0, failed: 0 })

      for (const batch of batches) {
        const res = await fetch('/api/v1/actions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionIds: batch.ids, actionOverride: batch.actionType }),
        })

        const data = await res.json()

        if (!res.ok) {
          totalFailed += batch.ids.length
        } else {
          totalExecuted += data.executed
          totalFailed += data.failed
        }

        totalDone += batch.ids.length
        setProgress({ done: totalDone, total: totalCount, executed: totalExecuted, failed: totalFailed })
      }

      setResult({ executed: totalExecuted, failed: totalFailed })
      setSelected(new Set())
      setProgress(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setProgress(null)
    } finally {
      setExecuting(false)
    }
  }

  async function rejectSelected() {
    if (visibleSelectedCount === 0) return

    setExecuting(true)
    setError(null)

    // Only reject visible selected actions
    const visibleIds = new Set(visiblePending.map((a) => a.id))
    const ids = [...selected].filter((id) => visibleIds.has(id))
    let failedCount = 0

    for (let i = 0; i < ids.length; i += 5) {
      const chunk = ids.slice(i, i + 5)
      const results = await Promise.allSettled(
        chunk.map((actionId) =>
          fetch('/api/v1/actions/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionId }),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed')
          })
        )
      )
      failedCount += results.filter((r) => r.status === 'rejected').length
    }

    if (failedCount > 0) {
      setError(`${failedCount} dismissal${failedCount > 1 ? 's' : ''} failed`)
    }

    setSelected(new Set())
    router.refresh()
    setExecuting(false)
  }

  return (
    <div className="mt-2 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f0f23]">Scan Results</h1>
          <p className="mt-1 text-sm text-[#9898b0]">
            {scan.total_emails_scanned.toLocaleString()} emails scanned · {formatDate(scan.created_at)}
          </p>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className="mt-5 glass-card rounded-xl p-4 animate-fade-in-up">
          <div className="flex items-center gap-3">
            {result.failed > 0 && result.executed === 0 ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </span>
            ) : result.failed > 0 ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
            )}
            <span className={`text-sm font-medium ${result.failed > 0 && result.executed === 0 ? 'text-red-700' : result.failed > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {result.executed} action{result.executed !== 1 ? 's' : ''} executed.
              {result.failed > 0 && ` ${result.failed} failed.`}
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-5 glass-card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </span>
            <span className="text-sm font-medium text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Already executed summary */}
      {executedActions.length > 0 && (
        <div className="mt-5 glass-card rounded-xl p-4">
          <p className="text-sm text-[#64648a]">
            {executedActions.length} action{executedActions.length !== 1 ? 's' : ''} already executed
          </p>
        </div>
      )}

      {/* Empty state */}
      {grouped.length === 0 && !result && (
        <div className="mt-12 text-center">
          {categoryFilter ? (
            <>
              <span className="text-4xl">{CATEGORY_CONFIG[categoryFilter]?.emoji ?? '❓'}</span>
              <p className="mt-3 text-sm font-medium text-[#0f0f23]">
                {scan.category_counts[categoryFilter] ?? 0} {CATEGORY_CONFIG[categoryFilter]?.label ?? categoryFilter} emails found
              </p>
              <p className="mt-1 text-sm text-[#9898b0]">
                {PROTECTED.has(categoryFilter)
                  ? 'These emails are protected and won\u2019t be modified.'
                  : filteredNonPending.length > 0
                    ? 'All actions for this category have already been processed.'
                    : 'No actions were suggested for this category.'}
              </p>
            </>
          ) : (
            <p className="text-[#9898b0]">No pending actions to review.</p>
          )}
        </div>
      )}

      {/* Category filter badge */}
      {categoryFilter && (
        <div className="mt-6 flex items-center gap-2 animate-fade-in-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-700 border border-indigo-500/20">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            Filtered: {CATEGORY_CONFIG[categoryFilter]?.label ?? categoryFilter}
          </span>
          <button
            onClick={() => {
              setCategoryFilter(null)
              setCollapsedCategories(new Set())
            }}
            className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white/60 px-2.5 py-1.5 text-xs font-medium text-[#64648a] transition-all hover:border-black/10 hover:text-[#0f0f23]"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Show all
          </button>
        </div>
      )}

      {/* Category groups */}
      <div className="mt-6 space-y-4">
        {grouped.map(([category, categoryActions]) => {
          const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.unknown
          const isProtected = PROTECTED.has(category)
          const allSelected = categoryActions.every((a) => selected.has(a.id))
          const someSelected = categoryActions.some((a) => selected.has(a.id))
          const collapsed = collapsedCategories.has(category)
          const defaultAction = categoryActions[0]?.action_type === 'unsubscribe' ? 'archive' : (categoryActions[0]?.action_type || 'keep')
          const currentAction = defaultAction
          const actionConfig = ACTION_LABELS[currentAction] ?? ACTION_LABELS.keep

          return (
            <div
              key={category}
              ref={category === categoryFilter ? filteredCategoryRef : undefined}
              className="glass-card overflow-hidden rounded-xl"
            >
              {/* Category header */}
              <div
                className={`flex cursor-pointer items-center justify-between bg-gradient-to-r ${config.bg} px-5 py-3.5`}
                onClick={() => toggleCollapse(category)}
              >
                <div className="flex items-center gap-3">
                  {!isProtected && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected
                      }}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleCategory(category)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-black/10 accent-indigo-500"
                      aria-label={`Select all ${config.label} emails`}
                    />
                  )}
                  <span className="text-xl">{config.emoji}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${config.accent}`}>{config.label}</span>
                    <span className="font-mono text-xs text-[#9898b0]">{categoryActions.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isProtected ? (
                    <span className="font-mono text-[10px] tracking-wider text-[#9898b0] uppercase">Protected</span>
                  ) : (
                    <span className={`rounded-full px-3 py-0.5 text-[11px] font-medium ${actionConfig.color}`}>
                      {actionConfig.label}
                    </span>
                  )}
                  <svg
                    className={`h-4 w-4 text-[#9898b0] transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Email list */}
              {!collapsed && (
                <div className="divide-y divide-black/[0.03]">
                  {categoryActions.map((action) => (
                    <div
                      key={action.id}
                      className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/80 ${
                        selected.has(action.id) ? 'bg-indigo-500/[0.03]' : ''
                      }`}
                    >
                      {!isProtected && (
                        <input
                          type="checkbox"
                          checked={selected.has(action.id)}
                          onChange={() => toggleAction(action.id)}
                          className="h-4 w-4 shrink-0 rounded border-black/10 accent-indigo-500"
                          aria-label={`Select email from ${action.sender_name || action.sender_address}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[#0f0f23]">
                            {action.sender_name || action.sender_address}
                          </span>
                          {action.sender_name && (
                            <span className="hidden truncate text-xs text-[#b0b0c0] sm:inline">
                              {action.sender_address}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-[#9898b0]">
                          {action.subject_preview || '(no subject)'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`font-mono text-xs ${action.confidence >= 0.9 ? 'text-emerald-500' : action.confidence >= 0.7 ? 'text-amber-500' : 'text-red-400'}`}
                          title={action.confidence >= 0.9 ? 'High confidence' : action.confidence >= 0.7 ? 'Review suggested' : 'Low confidence'}
                        >
                          {Math.round(action.confidence * 100)}%
                        </span>
                        {action.email_date && (
                          <span className="hidden text-xs text-[#b0b0c0] sm:inline">
                            {new Date(action.email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Already processed emails for filtered category */}
      {filteredNonPending.length > 0 && (
        <div className="mt-4">
          <div className="glass-card overflow-hidden rounded-xl opacity-60">
            <div className="flex items-center justify-between bg-gradient-to-r from-gray-500/8 to-gray-500/3 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{CATEGORY_CONFIG[categoryFilter!]?.emoji ?? '❓'}</span>
                <span className="text-sm font-medium text-[#64648a]">
                  Already processed
                </span>
                <span className="font-mono text-xs text-[#9898b0]">{filteredNonPending.length}</span>
              </div>
              <span className="font-mono text-[10px] tracking-wider text-[#9898b0] uppercase">
                {filteredNonPending[0]?.status}
              </span>
            </div>
            <div className="divide-y divide-black/[0.03]">
              {filteredNonPending.slice(0, 10).map((action) => (
                <div key={action.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[#9898b0]">
                        {action.sender_name || action.sender_address}
                      </span>
                      {action.sender_name && (
                        <span className="hidden truncate text-xs text-[#b0b0c0] sm:inline">
                          {action.sender_address}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-[#b0b0c0]">
                      {action.subject_preview || '(no subject)'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] font-medium text-[#9898b0] border border-gray-500/10">
                    {action.status}
                  </span>
                </div>
              ))}
              {filteredNonPending.length > 10 && (
                <div className="px-5 py-3 text-center text-xs text-[#b0b0c0]">
                  +{filteredNonPending.length - 10} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      {visiblePending.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-8">
          <div className="glass-card rounded-xl border border-black/[0.06] p-4 shadow-lg backdrop-blur-xl">
            {/* Progress bar */}
            {progress && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#0f0f23]">
                    Processing {progress.done} of {progress.total}
                  </span>
                  <span className="text-xs text-[#9898b0]">
                    {progress.executed > 0 && <span className="text-emerald-600">{progress.executed} done</span>}
                    {progress.failed > 0 && <span className="text-red-500 ml-2">{progress.failed} failed</span>}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-black/[0.04]"
                  role="progressbar"
                  aria-valuenow={Math.round((progress.done / progress.total) * 100)}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                    style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#9898b0]">
                  {Math.round((progress.done / progress.total) * 100)}% complete
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#64648a]">
                {progress ? (
                  <span className="font-semibold text-[#0f0f23]">{progress.done}/{progress.total} processed</span>
                ) : (
                  <>
                    <span className="font-semibold text-[#0f0f23]">{visibleSelectedCount}</span> of {visiblePending.length} selected
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                {!progress && (
                  <button
                    onClick={rejectSelected}
                    disabled={visibleSelectedCount === 0 || executing}
                    className="rounded-lg border border-black/[0.06] bg-white/60 px-4 py-2 text-sm font-medium text-[#64648a] transition-all hover:border-black/10 hover:text-[#0f0f23] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={visibleSelectedCount === 0 || executing}
                  className="glow-button inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {executing
                    ? `Processing...`
                    : `Execute ${visibleSelectedCount} Actions`
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false)
          executeSelected()
        }}
        title={`Execute ${visibleSelectedCount} Actions`}
        description="The following actions will be applied to your emails. This cannot be undone."
        actions={(() => {
          const breakdown = new Map<string, number>()
          const visibleIds = new Set(visiblePending.map((a) => a.id))
          for (const action of actions) {
            if (selected.has(action.id) && visibleIds.has(action.id)) {
              const effective = getEffectiveAction(action)
              breakdown.set(effective, (breakdown.get(effective) || 0) + 1)
            }
          }
          const ACTION_DISPLAY: Record<string, string> = { archive: 'Archive', move_to_trash: 'Move to Trash', mark_read: 'Mark as Read', keep: 'Keep' }
          return [...breakdown.entries()].map(([action, count]) => ({
            label: ACTION_DISPLAY[action] || action,
            count,
            variant: action === 'move_to_trash' ? 'destructive' as const : 'default' as const,
          }))
        })()}
        confirmText={`Execute ${visibleSelectedCount} Actions`}
        variant={(() => {
          const visibleIds = new Set(visiblePending.map((a) => a.id))
          const hasTrash = actions.some((a) => selected.has(a.id) && visibleIds.has(a.id) && getEffectiveAction(a) === 'move_to_trash')
          return hasTrash ? 'destructive' : 'default'
        })()}
      />
    </div>
  )
}
