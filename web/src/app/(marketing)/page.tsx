export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Your inbox, on autopilot
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          InboxPilot uses AI to categorize your emails and suggest what to clean
          up. Newsletters you never read, old promotions, expired notifications
          — identified and organized in seconds.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Start Free Trial
          </a>
          <span className="text-sm text-gray-500">
            7 days free, then $5/month
          </span>
        </div>
      </div>
    </div>
  )
}
