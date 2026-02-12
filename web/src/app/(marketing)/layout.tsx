export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <a href="/" className="text-xl font-bold text-gray-900">
                Sweepy
              </a>
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

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-lg font-semibold text-gray-900">
                Sweepy
              </span>
              <span className="text-sm text-gray-500">
                AI-powered email cleanup for Gmail.
              </span>
            </div>
            <div className="mt-6 flex gap-6 md:mt-0">
              <a
                href="/privacy"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Terms of Service
              </a>
              <a
                href="mailto:privacy@sweepy.site"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-6">
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Sweepy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
