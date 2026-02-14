import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ScanButton } from './scan-button'

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; gradient: string; accent: string }> = {
  newsletter: { label: 'Newsletters', emoji: '📰', gradient: 'from-blue-500/10 to-blue-500/5', accent: 'text-blue-600' },
  marketing: { label: 'Marketing', emoji: '🛍️', gradient: 'from-purple-500/10 to-purple-500/5', accent: 'text-purple-600' },
  transactional: { label: 'Transactional', emoji: '🧾', gradient: 'from-emerald-500/10 to-emerald-500/5', accent: 'text-emerald-600' },
  social: { label: 'Social', emoji: '📱', gradient: 'from-pink-500/10 to-pink-500/5', accent: 'text-pink-600' },
  notification: { label: 'Notifications', emoji: '🔔', gradient: 'from-amber-500/10 to-amber-500/5', accent: 'text-amber-600' },
  spam: { label: 'Spam', emoji: '🗑️', gradient: 'from-red-500/10 to-red-500/5', accent: 'text-red-600' },
  personal: { label: 'Personal', emoji: '✉️', gradient: 'from-indigo-500/10 to-indigo-500/5', accent: 'text-indigo-600' },
  important: { label: 'Important', emoji: '⭐', gradient: 'from-emerald-500/10 to-emerald-500/5', accent: 'text-emerald-600' },
  unknown: { label: 'Unknown', emoji: '❓', gradient: 'from-gray-500/10 to-gray-500/5', accent: 'text-gray-600' },
}

const PROTECTED = new Set(['personal', 'important'])

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
  running: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
  failed: 'bg-red-500/10 text-red-700 border border-red-500/20',
}

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

  const [profileResult, scansResult, pendingActionsResult] = await Promise.all([
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
      .from('suggested_actions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const gmailConnected = profileResult.data?.gmail_connected ?? false
  const scans = scansResult.data ?? []
  const pendingCount = pendingActionsResult.count ?? 0

  const totalEmailsScanned = scans.reduce((sum, s) => sum + (s.total_emails_scanned ?? 0), 0)
  const totalScans = scans.length
  const latestCompleted = scans.find((s) => s.status === 'completed')
  const scanCategoryCounts: Record<string, number> = latestCompleted?.category_counts ?? {}
  const recentScans = scans.slice(0, 5)

  // Fetch LIVE pending counts per category (not the stale scan snapshot)
  const pendingByCategory: Record<string, number> = {}
  if (latestCompleted) {
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('suggested_actions')
        .select('category')
        .eq('scan_id', latestCompleted.id)
        .eq('status', 'pending')
        .range(offset, offset + PAGE - 1)
      if (!data || data.length === 0) break
      for (const row of data) {
        pendingByCategory[row.category] = (pendingByCategory[row.category] || 0) + 1
      }
      if (data.length < PAGE) break
      offset += PAGE
    }
  }

  // Merge: show all categories from scan, with live pending counts
  const allCategories = Object.keys(scanCategoryCounts)
  const totalScanned = Object.values(scanCategoryCounts).reduce((a, b) => a + b, 0)
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
        {gmailConnected && (
          <Link
            href="/compare"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white/60 px-4 py-2.5 text-sm font-medium text-[#64648a] backdrop-blur-sm transition-all hover:border-indigo-500/20 hover:text-[#0f0f23]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Compare
          </Link>
        )}
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
          <h3 className="mt-6 text-xl font-semibold text-[#0f0f23]">Connect your Gmail</h3>
          <p className="mt-2 max-w-sm text-sm text-[#64648a]">
            We need read-only access to your emails to help you clean your inbox with AI.
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
          <div className="mt-8 grid gap-4 sm:grid-cols-3 animate-fade-in-up-d1">
            <div className="glass-card rounded-xl p-5">
              <p className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Total Scanned</p>
              <p className="mt-2 text-2xl font-bold text-[#0f0f23]">{formatNumber(totalEmailsScanned)}</p>
              <p className="mt-1 text-xs text-[#9898b0]">emails analyzed</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Scans Run</p>
              <p className="mt-2 text-2xl font-bold text-[#0f0f23]">{totalScans}</p>
              <p className="mt-1 text-xs text-[#9898b0]">total scans</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Pending Actions</p>
              <p className="mt-2 text-2xl font-bold text-[#0f0f23]">
                {pendingCount > 0 ? (
                  <span className="gradient-text">{formatNumber(pendingCount)}</span>
                ) : (
                  '0'
                )}
              </p>
              <p className="mt-1 text-xs text-[#9898b0]">emails to review</p>
            </div>
          </div>

          {/* Scan controls */}
          <div className="mt-8 animate-fade-in-up-d2">
            <ScanButton />
          </div>

          {/* Category distribution */}
          {hasCategories && (
            <div className="mt-10 animate-fade-in-up-d2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#0f0f23]">Latest Scan</h2>
                  <p className="mt-0.5 text-sm text-[#9898b0]">
                    {latestCompleted?.total_emails_scanned} emails scanned · {totalPendingInScan > 0 ? `${formatNumber(totalPendingInScan)} pending` : 'all processed'} · {formatDate(latestCompleted!.created_at)}
                  </p>
                </div>
                {totalPendingInScan > 0 && (
                  <Link
                    href={`/scan/${latestCompleted!.id}`}
                    className="glow-button inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    Review {formatNumber(totalPendingInScan)} emails
                  </Link>
                )}
              </div>

              {/* Category bar visualization */}
              <div className="mt-5 glass-card rounded-xl p-5">
                {/* Horizontal bar — shows scanned distribution with pending overlay */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.03]">
                  {allCategories
                    .filter((cat) => (pendingByCategory[cat] ?? 0) > 0)
                    .sort((a, b) => (pendingByCategory[b] ?? 0) - (pendingByCategory[a] ?? 0))
                    .map((category) => {
                      const count = pendingByCategory[category] ?? 0
                      const pct = totalPendingInScan > 0 ? (count / totalPendingInScan) * 100 : 0
                      const colors: Record<string, string> = {
                        newsletter: 'bg-blue-400',
                        marketing: 'bg-purple-400',
                        transactional: 'bg-emerald-400',
                        social: 'bg-pink-400',
                        notification: 'bg-amber-400',
                        spam: 'bg-red-400',
                        personal: 'bg-indigo-400',
                        important: 'bg-emerald-500',
                        unknown: 'bg-gray-400',
                      }
                      return (
                        <div
                          key={category}
                          className={`${colors[category] ?? 'bg-gray-400'} transition-all duration-700 first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${pct}%` }}
                          title={`${CATEGORY_CONFIG[category]?.label}: ${count} pending`}
                        />
                      )
                    })}
                </div>
                {totalPendingInScan === 0 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-emerald-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    All emails have been processed!
                  </div>
                )}

                {/* Category grid */}
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allCategories
                    .sort((a, b) => (scanCategoryCounts[b] ?? 0) - (scanCategoryCounts[a] ?? 0))
                    .map((category) => {
                      const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.unknown
                      const isProtected = PROTECTED.has(category)
                      const scannedCount = scanCategoryCounts[category] ?? 0
                      const pendingInCat = pendingByCategory[category] ?? 0
                      const isDone = pendingInCat === 0
                      return (
                        <Link
                          key={category}
                          href={`/scan/${latestCompleted!.id}?category=${category}`}
                          className={`group relative flex items-center justify-between rounded-lg bg-gradient-to-r ${config.gradient} p-3.5 transition-all hover:scale-[1.02] hover:shadow-md ${isDone ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{config.emoji}</span>
                            <div>
                              <p className="text-sm font-medium text-[#0f0f23]">{config.label}</p>
                              <p className="text-xs text-[#9898b0]">
                                {isDone
                                  ? `${scannedCount} processed`
                                  : `${pendingInCat} of ${scannedCount} pending`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {isDone ? (
                              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <span className={`text-lg font-bold ${config.accent}`}>{pendingInCat}</span>
                            )}
                            {isProtected && (
                              <p className="text-[10px] text-[#9898b0]">Protected</p>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Scan history */}
          {recentScans.length > 0 && (
            <div className="mt-10 animate-fade-in-up-d3">
              <h2 className="text-lg font-semibold text-[#0f0f23]">Scan History</h2>
              <div className="mt-4 glass-card overflow-hidden rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/[0.04]">
                      <th className="px-5 py-3.5 text-left font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Date</th>
                      <th className="px-5 py-3.5 text-left font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Emails</th>
                      <th className="px-5 py-3.5 text-left font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Pipeline</th>
                      <th className="px-5 py-3.5 text-left font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">Status</th>
                      <th className="px-5 py-3.5 text-right font-mono text-[11px] tracking-wider text-[#9898b0] uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03]">
                    {recentScans.map((scan) => (
                      <tr key={scan.id} className="transition-colors hover:bg-white/50">
                        <td className="px-5 py-4 text-[#64648a]">{formatDate(scan.created_at)}</td>
                        <td className="px-5 py-4 font-medium text-[#0f0f23]">{formatNumber(scan.total_emails_scanned ?? 0)}</td>
                        <td className="px-5 py-4">
                          {scan.status === 'completed' && (
                            <span className="text-xs text-[#9898b0]">
                              {scan.resolved_by_cache ?? 0} cache · {scan.resolved_by_llm ?? 0} AI
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[scan.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {scan.status === 'running' && (
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            )}
                            {scan.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {scan.status === 'completed' && (
                            <Link
                              href={`/scan/${scan.id}`}
                              className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800"
                            >
                              View results
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
