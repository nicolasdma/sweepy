export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#fafaf8] flex flex-col">
      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.04] bg-[#fafaf8]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="text-lg font-semibold tracking-tight text-[#0f0f23]"
          >
            Sweepy
          </a>

          <div className="flex items-center gap-5">
            <a
              href="/login"
              className="text-sm text-[#64648a] transition-colors hover:text-[#0f0f23]"
            >
              Log in
            </a>
            <a
              href="/login"
              className="glow-button rounded-lg px-4 py-2 text-sm font-medium text-white"
            >
              Get Started
            </a>
          </div>
        </nav>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 pt-16">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[0.04]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-semibold text-[#0f0f23]">
                Sweepy
              </span>
              <span className="text-sm text-[#9898b0]">
                AI-powered email cleanup for Gmail.
              </span>
            </div>
            <div className="mt-6 flex gap-6 md:mt-0">
              <a
                href="/privacy"
                className="text-sm text-[#9898b0] transition-colors hover:text-[#64648a]"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="text-sm text-[#9898b0] transition-colors hover:text-[#64648a]"
              >
                Terms of Service
              </a>
              <a
                href="mailto:privacy@sweepy.site"
                className="text-sm text-[#9898b0] transition-colors hover:text-[#64648a]"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-black/[0.04] pt-6">
            <p className="text-xs text-[#c0c0ce]">
              &copy; {new Date().getFullYear()} Sweepy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
