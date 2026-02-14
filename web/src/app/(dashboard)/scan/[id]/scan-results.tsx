'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { CATEGORY_CONFIG as SHARED_CONFIG, CATEGORY_COLORS, PROTECTED_CATEGORIES, CATEGORY_GROUPS } from '@shared/config/categories'
import { ConfirmationModal } from '@/components/confirmation-modal'
import { UndoToast } from '@/components/undo-toast'
import { useRouter } from 'next/navigation'

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

export function ScanResults({ scan, actions, initialCategory, initialGroup }: { scan: Scan; actions: ScanAction[]; initialCategory?: string; initialGroup?: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [executing, setExecuting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; executed: number; failed: number } | null>(null)
  const [result, setResult] = useState<{ executed: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialCategory ?? null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSkipConfirmModal, setShowSkipConfirmModal] = useState(false)
  const [undoBatchId, setUndoBatchId] = useState<string | null>(null)
  const [undoCount, setUndoCount] = useState(0)
  const filteredCategoryRef = useRef<HTMLDivElement>(null)

  // Collapsed super-groups (by group key)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (initialGroup) {
      // Collapse all groups except the target group
      return new Set(CATEGORY_GROUPS.filter((g) => g.key !== initialGroup).map((g) => g.key))
    }
    if (!initialCategory) return new Set()
    // Collapse all groups except the one containing the filtered category
    const targetGroup = CATEGORY_GROUPS.find((g) => g.categories.includes(initialCategory as any))
    return new Set(CATEGORY_GROUPS.filter((g) => g.key !== targetGroup?.key).map((g) => g.key))
  })

  // Expanded sub-categories within groups (show individual category breakdown)
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(() => {
    // If filtering by category, expand that group's sub-categories
    if (initialCategory) {
      const targetGroup = CATEGORY_GROUPS.find((g) => g.categories.includes(initialCategory as any))
      return targetGroup ? new Set([targetGroup.key]) : new Set()
    }
    return new Set()
  })

  // Scroll to filtered category/group on mount
  useEffect(() => {
    if ((initialCategory || initialGroup) && filteredCategoryRef.current) {
      filteredCategoryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [initialCategory, initialGroup])

  const pendingActions = useMemo(() => actions.filter((a) => a.status === 'pending'), [actions])
  const executedActions = useMemo(() => actions.filter((a) => a.status === 'executed'), [actions])

  // Visible pending actions (respects category filter)
  const visiblePending = useMemo(
    () => categoryFilter ? pendingActions.filter((a) => a.category === categoryFilter) : pendingActions,
    [pendingActions, categoryFilter]
  )

  // How many of the visible actions are selected
  const visibleSelectedCount = useMemo(
    () => visiblePending.filter((a) => selected.has(a.id)).length,
    [visiblePending, selected]
  )

  // Actionable selected count (excludes "keep" actions)
  const actionableSelectedCount = useMemo(
    () => visiblePending.filter((a) => selected.has(a.id) && a.action_type !== 'keep').length,
    [visiblePending, selected]
  )

  // Group actions by super-group, with sub-category breakdown
  const superGroups = useMemo(() => {
    return CATEGORY_GROUPS.map((group) => {
      const catSet = new Set(group.categories as string[])
      const groupActions = visiblePending.filter((a) => catSet.has(a.category))
      // Sub-group by category
      const subCategories = new Map<string, ScanAction[]>()
      for (const action of groupActions) {
        const existing = subCategories.get(action.category) || []
        existing.push(action)
        subCategories.set(action.category, existing)
      }
      return { ...group, actions: groupActions, subCategories }
    }).filter((g) => g.actions.length > 0)
  }, [visiblePending])

  function toggleGroupSelect(groupCategories: string[]) {
    const catSet = new Set(groupCategories)
    const groupActions = visiblePending.filter((a) => catSet.has(a.category) && !PROTECTED.has(a.category))
    const allSelected = groupActions.every((a) => selected.has(a.id))

    setSelected((prev) => {
      const next = new Set(prev)
      for (const a of groupActions) {
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

  function toggleGroupCollapse(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  function toggleSubCategories(groupKey: string) {
    setExpandedSubCategories((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
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
        const ids = byAction.get(action.action_type) || []
        ids.push(action.id)
        byAction.set(action.action_type, ids)
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
      if (totalExecuted > 0) {
        setUndoCount(totalExecuted)
        // Use scan id as batch identifier for undo
        setUndoBatchId(scan.id)
      }
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
      setError(`${failedCount} skip${failedCount > 1 ? 's' : ''} failed`)
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
            <div>
              <span className={`text-sm font-medium ${result.failed > 0 && result.executed === 0 ? 'text-red-700' : result.failed > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {result.failed > 0 && result.executed === 0
                  ? `${result.failed} action${result.failed !== 1 ? 's' : ''} failed.`
                  : result.failed > 0
                    ? `${result.executed} cleaned up, ${result.failed} failed.`
                    : `Done! ${result.executed} email${result.executed !== 1 ? 's' : ''} cleaned up.`}
              </span>
              {result.failed === 0 && result.executed > 0 && (
                <p className="text-xs text-emerald-600/70 mt-0.5">Your inbox is lighter.</p>
              )}
            </div>
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
      {superGroups.length === 0 && !result && (
        <div className="mt-12 text-center">
          {categoryFilter ? (
            <>
              <span className="text-4xl">{SHARED_CONFIG[categoryFilter as keyof typeof SHARED_CONFIG]?.emoji ?? '❓'}</span>
              <p className="mt-3 text-sm font-medium text-[#0f0f23]">
                {scan.category_counts[categoryFilter] ?? 0} {SHARED_CONFIG[categoryFilter as keyof typeof SHARED_CONFIG]?.label ?? categoryFilter} emails found
              </p>
              <p className="mt-1 text-sm text-[#9898b0]">
                {PROTECTED.has(categoryFilter)
                  ? 'These emails are protected and won\u2019t be modified.'
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
            Filtered: {SHARED_CONFIG[categoryFilter as keyof typeof SHARED_CONFIG]?.label ?? categoryFilter}
          </span>
          <button
            onClick={() => {
              setCategoryFilter(null)
              setCollapsedGroups(new Set())
              setExpandedSubCategories(new Set())
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

      {/* Super-groups (Clean up / Review / Safe) */}
      <div className="mt-6 space-y-4">
        {superGroups.map((group) => {
          const isProtectedGroup = group.key === 'safe'
          const collapsed = collapsedGroups.has(group.key)
          const showSub = expandedSubCategories.has(group.key)
          const groupNonProtected = group.actions.filter((a) => !PROTECTED.has(a.category))
          const allSelected = groupNonProtected.length > 0 && groupNonProtected.every((a) => selected.has(a.id))
          const someSelected = groupNonProtected.some((a) => selected.has(a.id))

          return (
            <div
              key={group.key}
              ref={group.key === initialGroup || group.categories.includes(categoryFilter as any) ? filteredCategoryRef : undefined}
              className="glass-card overflow-hidden rounded-xl"
            >
              {/* Group header */}
              <div
                className={`flex cursor-pointer items-center justify-between bg-gradient-to-r ${group.gradient} px-5 py-4`}
                onClick={() => toggleGroupCollapse(group.key)}
              >
                <div className="flex items-center gap-3">
                  {!isProtectedGroup && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected
                      }}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleGroupSelect(group.categories as string[])
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-black/10 accent-indigo-500"
                      aria-label={`Select all ${group.label} emails`}
                    />
                  )}
                  <span className="text-xl">{group.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${group.text}`}>{group.label}</span>
                      <span className="font-mono text-xs text-[#9898b0]">{group.actions.length}</span>
                    </div>
                    <p className="text-xs text-[#9898b0]">{group.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isProtectedGroup && (
                    <span className="font-mono text-[10px] tracking-wider text-[#9898b0] uppercase">Protected</span>
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

              {/* Group content */}
              {!collapsed && (
                <div>
                  {/* Sub-category breakdown toggle */}
                  {group.subCategories.size > 1 && (
                    <button
                      onClick={() => toggleSubCategories(group.key)}
                      className="flex w-full items-center gap-2 border-b border-black/[0.03] px-5 py-2 text-xs text-[#9898b0] hover:text-[#64648a] transition-colors"
                    >
                      <svg
                        className={`h-3 w-3 transition-transform duration-200 ${showSub ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                      {showSub ? 'Hide' : 'Show'} breakdown: {[...group.subCategories.entries()].map(([cat, acts]) => {
                        const cfg = SHARED_CONFIG[cat as keyof typeof SHARED_CONFIG]
                        return `${cfg?.emoji ?? '❓'} ${acts.length}`
                      }).join(' · ')}
                    </button>
                  )}

                  {/* Sub-category headers (when expanded) */}
                  {showSub && group.subCategories.size > 1 && (
                    <div className="border-b border-black/[0.03] bg-black/[0.01] px-5 py-2 flex flex-wrap gap-2">
                      {[...group.subCategories.entries()].map(([cat, acts]) => {
                        const cfg = SHARED_CONFIG[cat as keyof typeof SHARED_CONFIG] ?? SHARED_CONFIG.unknown
                        const colors = CATEGORY_COLORS[cat]
                        return (
                          <span
                            key={cat}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colors?.bg ?? 'bg-gray-500/10'} ${colors?.text ?? 'text-gray-600'}`}
                          >
                            {cfg.emoji} {cfg.label} <span className="font-mono text-[10px] opacity-70">{acts.length}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Email list */}
                  <div className="divide-y divide-black/[0.03]">
                    {(showSub && group.subCategories.size > 1
                      ? // When sub-categories are expanded, group emails by category
                        [...group.subCategories.entries()].flatMap(([cat, acts]) => {
                          const cfg = SHARED_CONFIG[cat as keyof typeof SHARED_CONFIG] ?? SHARED_CONFIG.unknown
                          return [
                            { type: 'header' as const, category: cat, label: cfg.label, emoji: cfg.emoji, count: acts.length },
                            ...acts.map((a) => ({ type: 'action' as const, action: a })),
                          ]
                        })
                      : // Default: flat list of all actions
                        group.actions.map((a) => ({ type: 'action' as const, action: a }))
                    ).map((item, idx) => {
                      if (item.type === 'header') {
                        const colors = CATEGORY_COLORS[item.category]
                        return (
                          <div
                            key={`header-${item.category}`}
                            className={`flex items-center gap-2 px-5 py-2 bg-gradient-to-r ${colors?.gradient ?? 'from-gray-500/8 to-gray-500/3'} border-t border-black/[0.03]`}
                          >
                            <span className="text-sm">{item.emoji}</span>
                            <span className={`text-xs font-medium ${colors?.text ?? 'text-gray-600'}`}>{item.label}</span>
                            <span className="font-mono text-[10px] text-[#9898b0]">{item.count}</span>
                          </div>
                        )
                      }

                      const action = item.action
                      const rowActionConfig = ACTION_LABELS[action.action_type] ?? ACTION_LABELS.keep
                      const isActionProtected = PROTECTED.has(action.category)

                      return (
                        <div
                          key={action.id}
                          className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/80 ${
                            selected.has(action.id) ? 'bg-indigo-500/[0.03]' : ''
                          }`}
                        >
                          {!isActionProtected && (
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
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`font-mono text-xs ${action.confidence >= 0.9 ? 'text-emerald-500' : action.confidence >= 0.7 ? 'text-amber-500' : 'text-red-400'}`}
                              title={action.confidence >= 0.9 ? 'High confidence' : action.confidence >= 0.7 ? 'Review suggested' : 'Low confidence'}
                            >
                              {Math.round(action.confidence * 100)}%
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${rowActionConfig.color}`}>
                              {rowActionConfig.label}
                            </span>
                            {action.email_date && (
                              <span className="hidden text-xs text-[#b0b0c0] sm:inline">
                                {new Date(action.email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

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
              <div className="flex items-center gap-3">
                <p className="text-sm text-[#64648a]">
                  {progress ? (
                    <span className="font-semibold text-[#0f0f23]">{progress.done}/{progress.total} processed</span>
                  ) : (
                    <>
                      <span className="font-semibold text-[#0f0f23]">{visibleSelectedCount}</span> of {visiblePending.length} selected
                    </>
                  )}
                </p>
                {!progress && (
                  <button
                    onClick={() => {
                      const safeActions = visiblePending.filter(
                        (a) => a.confidence >= 0.9 && !PROTECTED.has(a.category)
                      )
                      setSelected((prev) => {
                        const next = new Set(prev)
                        for (const a of safeActions) next.add(a.id)
                        return next
                      })
                    }}
                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-all hover:bg-emerald-500/20"
                  >
                    Select safe (&ge;90%)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!progress && (
                  <button
                    onClick={() => {
                      if (visibleSelectedCount > 50) {
                        setShowSkipConfirmModal(true)
                      } else {
                        rejectSelected()
                      }
                    }}
                    disabled={visibleSelectedCount === 0 || executing}
                    className="rounded-lg border border-black/[0.06] bg-white/60 px-4 py-2 text-sm font-medium text-[#64648a] transition-all hover:border-black/10 hover:text-[#0f0f23] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={actionableSelectedCount === 0 || executing}
                  className="glow-button inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {executing
                    ? `Processing...`
                    : actionableSelectedCount === 0
                      ? 'Nothing to execute'
                      : `Execute ${actionableSelectedCount} Actions`
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
        title={`Execute ${actionableSelectedCount} Actions`}
        description="Trashed emails can be recovered from Gmail's Trash for up to 30 days."
        actions={(() => {
          const breakdown = new Map<string, number>()
          const visibleIds = new Set(visiblePending.map((a) => a.id))
          for (const action of actions) {
            if (selected.has(action.id) && visibleIds.has(action.id) && action.action_type !== 'keep') {
              breakdown.set(action.action_type, (breakdown.get(action.action_type) || 0) + 1)
            }
          }
          const ACTION_DISPLAY: Record<string, string> = { archive: 'Archive', move_to_trash: 'Move to Trash', mark_read: 'Mark as Read' }
          return [...breakdown.entries()].map(([action, count]) => ({
            label: ACTION_DISPLAY[action] || action,
            count,
            variant: action === 'move_to_trash' ? 'destructive' as const : 'default' as const,
          }))
        })()}
        confirmText={`Execute ${actionableSelectedCount} Actions`}
        variant={(() => {
          const visibleIds = new Set(visiblePending.map((a) => a.id))
          const hasTrash = actions.some((a) => selected.has(a.id) && visibleIds.has(a.id) && a.action_type === 'move_to_trash')
          return hasTrash ? 'destructive' : 'default'
        })()}
      />

      <ConfirmationModal
        isOpen={showSkipConfirmModal}
        onClose={() => setShowSkipConfirmModal(false)}
        onConfirm={() => {
          setShowSkipConfirmModal(false)
          rejectSelected()
        }}
        title={`Skip ${visibleSelectedCount} emails?`}
        description={`You're about to skip ${visibleSelectedCount} emails. These suggestions will be dismissed and won't appear again.`}
        actions={[]}
        confirmText={`Skip ${visibleSelectedCount} emails`}
        variant="default"
      />

      {undoBatchId && (
        <UndoToast
          batchId={undoBatchId}
          executedCount={undoCount}
          onUndo={() => {
            setUndoBatchId(null)
            router.refresh()
          }}
          onDismiss={() => setUndoBatchId(null)}
        />
      )}
    </div>
  )
}
