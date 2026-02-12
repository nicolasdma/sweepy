export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Your email analytics and scan history will appear here.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Emails Scanned</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">&mdash;</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Categories Found
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">&mdash;</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Cleanup Suggestions
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">&mdash;</p>
        </div>
      </div>
    </div>
  )
}
