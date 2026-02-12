export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900">InboxPilot</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Log in
              </a>
              <a
                href="/login"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Get Started
              </a>
            </div>
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
