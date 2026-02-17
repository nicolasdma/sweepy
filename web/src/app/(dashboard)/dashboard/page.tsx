import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ScanButton } from './scan-button'
import { CATEGORY_GROUPS } from '@shared/config/categories'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const gmailStatus = params.gmail as string | undefined
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [profileResult, scansResult, usageResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('gmail_connected')
      .eq('id', user!.id)
      .single(),
    supabase
      .from('email_scans')
      .select('id, total_emails_scanned, status, category_counts, created_at, completed_at, resolved_by_heuristic, resolved_by_cache, resolved_by_llm')
      .order('created_at', { ascending: false }),
    supabase
      .from('usage_tracking')
      .select('scans_count, emails_processed, llm_calls_count, llm_input_tokens, llm_output_tokens, llm_cost_usd')
      .eq('user_id', user!.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .single(),
  ])

  const profile = profileResult.data
  const gmailConnected = profile?.gmail_connected ?? false
  const scans = scansResult.data ?? []
  const usage = usageResult.data

  const latestCompleted = scans.find((s) => s.status === 'completed')

  // Compute scan age and expiration
  const EXPIRY_DAYS = 7
  const scanAgeDays = latestCompleted
    ? Math.floor((Date.now() - new Date(latestCompleted.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  const daysRemaining = Math.max(0, EXPIRY_DAYS - scanAgeDays)
  const showExpiry = latestCompleted && scanAgeDays >= 3

  // Single source of truth: ALL actions from latest scan, grouped by category + status
  const totalByCategory: Record<string, number> = {}
  const pendingByCategory: Record<string, number> = {}
  if (latestCompleted) {
    const { data } = await supabase
      .from('suggested_actions')
      .select('category, status')
      .eq('scan_id', latestCompleted.id)
    if (data) {
      for (const row of data) {
        totalByCategory[row.category] = (totalByCategory[row.category] || 0) + 1
        if (row.status === 'pending') {
          pendingByCategory[row.category] = (pendingByCategory[row.category] || 0) + 1
        }
      }
    }
  }

  const allCategories = Object.keys(totalByCategory)
  const totalPendingInScan = Object.values(pendingByCategory).reduce((a, b) => a + b, 0)
  const hasCategories = allCategories.length > 0

  return (
    <div className="animate-fade-in-up">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f0f23]">
            Dashboard
          </h1>
          <p className="mt-1 text-[#64648a]">
            {gmailConnected
              ? 'Your inbox intelligence at a glance.'
              : 'Connect Gmail to start cleaning your inbox.'}
          </p>
        </div>
      </div>

      {/* Gmail connection status banner */}
      {gmailStatus === 'connected' && (
        <div className="mt-6 glass-card rounded-xl p-4 border-emerald-500/20 animate-fade-in-up-d1">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
            <span className="text-sm font-medium text-emerald-700">Gmail connected successfully! You can now scan your inbox.</span>
          </div>
        </div>
      )}
      {gmailStatus === 'error' && (
        <div className="mt-6 glass-card rounded-xl p-4 border-red-500/20">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
            <span className="text-sm font-medium text-red-700">Failed to connect Gmail. Please try again.</span>
          </div>
        </div>
      )}

      {/* Gmail not connected — main CTA */}
      {!gmailConnected && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl glass-card px-6 py-20 text-center animate-fade-in-up-d1">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
            <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="mt-6 text-xl font-semibold text-[#0f0f23]">Your account is ready</h3>
          <p className="mt-2 max-w-sm text-sm text-[#64648a]">
            Connect Gmail so we can scan your inbox. We only read metadata (sender, subject, date) — never the full email body.
          </p>
          <a
            href="/api/auth/gmail"
            className="glow-button mt-8 inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z" />
            </svg>
            Connect Gmail
          </a>
        </div>
      )}

      {/* Gmail connected — full dashboard */}
      {gmailConnected && (
        <>
          {/* Stats row */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 animate-fade-in-up-d1">
            <div className="glass-card rounded-xl p-5">
              <p className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Pending Actions</p>
              <p className="mt-2 text-2xl font-bold text-[#0f0f23]">
                {totalPendingInScan > 0 ? (
                  <span className="gradient-text">{formatNumber(totalPendingInScan)}</span>
                ) : (
                  '0'
                )}
              </p>
              <p className="mt-1 text-xs text-[#9898b0]">emails to review</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Last Scan</p>
              <p className="mt-2 text-2xl font-bold text-[#0f0f23]">
                {latestCompleted ? formatNumber(latestCompleted.total_emails_scanned ?? 0) : '—'}
              </p>
              <p className="mt-1 text-xs text-[#9898b0]">
                {latestCompleted ? `${formatDate(latestCompleted.created_at)}` : 'No scans yet'}
              </p>
            </div>
          </div>

          {/* Category distribution */}
          {hasCategories && (
            <div className="mt-8 animate-fade-in-up-d2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#0f0f23]">Latest Scan</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#9898b0]">
                    <span>{formatNumber(latestCompleted?.total_emails_scanned ?? 0)} emails scanned</span>
                    <span className="text-[#d0d0d8]">·</span>
                    <span>{totalPendingInScan > 0 ? <span className="font-medium text-[#64648a]">{formatNumber(totalPendingInScan)} pending</span> : 'all processed'}</span>
                    <span className="text-[#d0d0d8]">·</span>
                    <span>{formatDate(latestCompleted!.created_at)}</span>
                    {showExpiry && totalPendingInScan > 0 && (
                      <>
                        <span className="text-[#d0d0d8]">·</span>
                        <span className={daysRemaining <= 2 ? 'text-amber-600 font-medium' : ''}>
                          {daysRemaining === 0 ? 'expires today' : `expires in ${daysRemaining}d`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ScanButton compact />
              </div>

              {/* Super-group bar visualization */}
              <div className="mt-5 glass-card rounded-xl p-6">
                {/* Bar labels */}
                {totalPendingInScan > 0 && (
                  <div className="mb-2 flex">
                    {CATEGORY_GROUPS.map((group) => {
                      const groupPending = group.categories.reduce((sum, cat) => sum + (pendingByCategory[cat] ?? 0), 0)
                      const pct = totalPendingInScan > 0 ? (groupPending / totalPendingInScan) * 100 : 0
                      if (groupPending === 0) return null
                      return (
                        <div key={group.key} className="flex items-center justify-center gap-1" style={{ width: `${pct}%` }}>
                          <span className="text-xs">{group.emoji}</span>
                          <span className={`text-xs font-medium ${group.text}`}>{formatNumber(groupPending)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Horizontal bar — 3 super-groups */}
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-black/[0.03]">
                  {CATEGORY_GROUPS.map((group) => {
                    const groupPending = group.categories.reduce((sum, cat) => sum + (pendingByCategory[cat] ?? 0), 0)
                    const pct = totalPendingInScan > 0 ? (groupPending / totalPendingInScan) * 100 : 0
                    if (groupPending === 0) return null
                    return (
                      <div
                        key={group.key}
                        className={`${group.bar} transition-all duration-700 first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${pct}%` }}
                        title={`${group.label}: ${groupPending} pending`}
                      />
                    )
                  })}
                </div>

                {/* Legend */}
                {totalPendingInScan > 0 && (
                  <div className="mt-2.5 flex items-center justify-center gap-4">
                    {CATEGORY_GROUPS.map((group) => {
                      const groupPending = group.categories.reduce((sum, cat) => sum + (pendingByCategory[cat] ?? 0), 0)
                      if (groupPending === 0) return null
                      return (
                        <div key={group.key} className="flex items-center gap-1.5">
                          <div className={`h-2.5 w-2.5 rounded-full ${group.bar}`} />
                          <span className="text-[11px] text-[#9898b0]">{group.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {totalPendingInScan === 0 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-emerald-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    All emails have been processed!
                  </div>
                )}

                {/* 3 super-group cards */}
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {CATEGORY_GROUPS.map((group) => {
                    const groupTotal = group.categories.reduce((sum, cat) => sum + (totalByCategory[cat] ?? 0), 0)
                    const groupPending = group.categories.reduce((sum, cat) => sum + (pendingByCategory[cat] ?? 0), 0)
                    if (groupTotal === 0) return null
                    const isDone = groupPending === 0
                    const actedPct = groupTotal > 0 ? ((groupTotal - groupPending) / groupTotal) * 100 : 0
                    return (
                      <Link
                        key={group.key}
                        href={`/scan/${latestCompleted!.id}?group=${group.key}`}
                        className={`group relative flex flex-col rounded-xl bg-gradient-to-br ${group.gradient} p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
                      >
                        {/* Header: emoji + label */}
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{group.emoji}</span>
                          <p className={`text-sm font-semibold ${group.text}`}>{group.label}</p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#9898b0]">{group.description}</p>

                        {/* Hero number or done state */}
                        <div className="mt-3">
                          {isDone ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </div>
                              <span className="text-sm font-medium text-emerald-600">All done</span>
                            </div>
                          ) : (
                            <div>
                              <span className={`text-3xl font-bold ${group.text} tracking-tight`}>
                                {formatNumber(groupPending)}
                              </span>
                              <span className="ml-1.5 text-xs text-[#9898b0]">pending</span>
                            </div>
                          )}
                        </div>

                        {/* Mini progress bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-[#9898b0]">
                              {isDone ? 'All done' : `${formatNumber(groupPending)} of ${formatNumber(groupTotal)} pending`}
                            </span>
                            <span className="text-[10px] font-medium text-[#9898b0]">{Math.round(actedPct)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
                            <div
                              className={`h-full rounded-full ${isDone ? 'bg-emerald-400' : group.bar} transition-all duration-700`}
                              style={{ width: `${actedPct}%` }}
                            />
                          </div>
                        </div>

                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Scan controls fallback — when no scan results yet */}
          {!hasCategories && (
            <div className="mt-8 animate-fade-in-up-d2">
              <ScanButton />
            </div>
          )}

          {/* Usage stats — debug card */}
          {usage && (
            <div className="mt-8 animate-fade-in-up-d2">
              <div className="glass-card rounded-xl p-5">
                <p className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Usage this month</p>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-lg font-bold text-[#0f0f23]">{usage.scans_count ?? 0}</p>
                    <p className="text-[11px] text-[#9898b0]">scans</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#0f0f23]">{formatNumber(usage.emails_processed ?? 0)}</p>
                    <p className="text-[11px] text-[#9898b0]">emails processed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#0f0f23]">
                      {formatNumber((usage.llm_input_tokens ?? 0) + (usage.llm_output_tokens ?? 0))}
                    </p>
                    <p className="text-[11px] text-[#9898b0]">
                      tokens ({formatNumber(usage.llm_input_tokens ?? 0)} in / {formatNumber(usage.llm_output_tokens ?? 0)} out)
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#0f0f23]">
                      ${Number(usage.llm_cost_usd ?? 0).toFixed(4)}
                    </p>
                    <p className="text-[11px] text-[#9898b0]">LLM cost</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
