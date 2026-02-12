import { createServerSupabaseClient } from '@/lib/supabase/server'

// Category label + color mapping
const CATEGORY_COLORS: Record<string, string> = {
  newsletter: 'bg-blue-100 text-blue-800',
  marketing: 'bg-purple-100 text-purple-800',
  transactional: 'bg-green-100 text-green-800',
  social: 'bg-pink-100 text-pink-800',
  notification: 'bg-yellow-100 text-yellow-800',
  spam: 'bg-red-100 text-red-800',
  personal: 'bg-indigo-100 text-indigo-800',
  important: 'bg-emerald-100 text-emerald-800',
  unknown: 'bg-gray-100 text-gray-800',
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  running: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
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

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  // Fetch all data in parallel
  const [scansResult, pendingActionsResult] = await Promise.all([
    // All scans ordered by most recent
    supabase
      .from('email_scans')
      .select('id, total_emails_scanned, status, category_counts, created_at, completed_at, resolved_by_heuristic, resolved_by_cache, resolved_by_llm')
      .order('created_at', { ascending: false }),

    // Count of pending suggested actions
    supabase
      .from('suggested_actions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const scans = scansResult.data ?? []
  const pendingCount = pendingActionsResult.count ?? 0

  // Computed stats
  const totalEmailsScanned = scans.reduce(
    (sum, s) => sum + (s.total_emails_scanned ?? 0),
    0
  )
  const totalScans = scans.length
  const completedScans = scans.filter((s) => s.status === 'completed').length

  // Category distribution from latest completed scan
  const latestCompleted = scans.find((s) => s.status === 'completed')
  const categoryDistribution: Record<string, number> =
    latestCompleted?.category_counts ?? {}
  const hasCategories = Object.keys(categoryDistribution).length > 0

  // Recent scans (last 5)
  const recentScans = scans.slice(0, 5)

  // Empty state
  if (totalScans === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No scans yet
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Install the Chrome extension to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Your email analytics and scan history.
      </p>

      {/* Stats cards */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Emails Scanned
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {totalEmailsScanned.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            across {totalScans} {totalScans === 1 ? 'scan' : 'scans'}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Scans Completed
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {completedScans}
            <span className="text-lg font-normal text-gray-400">
              {' '}
              / {totalScans}
            </span>
          </p>
          <p className="mt-1 text-sm text-gray-500">total scans run</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Pending Actions
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {pendingCount}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            awaiting your review
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Categories Found
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {Object.keys(categoryDistribution).length}
          </p>
          <p className="mt-1 text-sm text-gray-500">in latest scan</p>
        </div>
      </div>

      {/* Category distribution + Recent scans side by side */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Category distribution */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Category Breakdown
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            From your latest completed scan
          </p>

          {hasCategories ? (
            <div className="mt-4 space-y-3">
              {Object.entries(categoryDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => {
                  const total = Object.values(categoryDistribution).reduce(
                    (s, v) => s + v,
                    0
                  )
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.unknown}`}
                        >
                          {category}
                        </span>
                        <span className="text-gray-600">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gray-800"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">
              No category data available yet.
            </p>
          )}
        </div>

        {/* Recent scans */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Recent Scans
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Last {recentScans.length} scans
          </p>

          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Emails</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentScans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="py-3 pr-4 text-gray-700">
                      {formatDate(scan.created_at)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      {scan.total_emails_scanned}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[scan.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {scan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
