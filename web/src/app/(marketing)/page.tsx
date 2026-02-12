export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
            Now available for Gmail
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Your inbox, on autopilot
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Sweepy uses AI to scan your Gmail and find the emails you never read
            — newsletters, old promotions, expired notifications. Get actionable
            cleanup suggestions in seconds, not hours.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/login"
              className="rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Start Free Trial
            </a>
            <span className="text-sm text-gray-500">
              7 days free &middot; then $5/month &middot; cancel anytime
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              A smarter way to manage your inbox
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
              Stop manually unsubscribing and deleting. Let AI do the heavy
              lifting.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-lg font-bold">
                AI
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                AI Categorization
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Every email gets categorized automatically — newsletters,
                promotions, notifications, social, and more. No rules to
                configure.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 text-lg font-bold">
                &check;
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Smart Suggestions
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Get actionable suggestions for each email: archive, unsubscribe,
                delete, or keep. You stay in control of every decision.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 text-lg font-bold">
                &#9399;
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Privacy First
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                We only read email metadata (sender, subject, date). Your full
                email body is never sent to our servers or to any AI provider.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 text-lg font-bold">
                G
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Works with Gmail
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Install the Chrome extension, connect your Gmail account, and
                start cleaning up in minutes. No complex setup required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
              Three steps to a cleaner inbox. Takes less than two minutes.
            </p>
          </div>

          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                1
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                Install the extension
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Add Sweepy to Chrome from the Web Store. Sign in with your
                Google account to get started.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                2
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                Scan your inbox
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Sweepy scans your email metadata and uses AI to categorize every
                message. The scan runs in seconds.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                3
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">
                Review suggestions
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Review the cleanup suggestions, approve the ones you like, and
                watch your inbox get organized instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
              One plan. No hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-md">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-gray-900">
                  $5
                </span>
                <span className="text-base text-gray-500">/month</span>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Everything you need to keep your inbox clean.
              </p>

              <ul className="mt-8 space-y-3">
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-600 font-bold">&check;</span>
                  7-day free trial
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-600 font-bold">&check;</span>
                  Unlimited inbox scans
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-600 font-bold">&check;</span>
                  AI-powered categorization
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-600 font-bold">&check;</span>
                  Smart cleanup suggestions
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-600 font-bold">&check;</span>
                  Privacy-first: metadata only
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-600 font-bold">&check;</span>
                  Cancel anytime
                </li>
              </ul>

              <a
                href="/login"
                className="mt-8 block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Ready to clean up your inbox?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">
              Join Sweepy today and take back control of your email. Your first
              7 days are on us.
            </p>
            <div className="mt-8">
              <a
                href="/login"
                className="rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                Get Started Free
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
