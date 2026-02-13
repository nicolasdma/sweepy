export default function HomePage() {
  return (
    <>
      {/* ═══ Panel 1 · Hero (base layer) ═══ */}
      <section className="sticky top-16 z-[1] flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#fafaf8]">
        {/* Ambient background */}
        <div className="absolute inset-0 dot-grid opacity-60" />
        <div className="absolute left-1/2 top-[15%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-400/[0.08] blur-[120px] animate-float animate-pulse-soft" />
        <div
          className="absolute right-[15%] top-[40%] h-[350px] w-[350px] rounded-full bg-violet-400/[0.06] blur-[100px] animate-float"
          style={{ animationDelay: "-8s" }}
        />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2.5 rounded-full border border-black/[0.06] bg-white/70 px-4 py-1.5 shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] tracking-wider text-[#64648a] uppercase">
              Now available for Gmail
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up-d1 text-5xl font-bold tracking-tight text-[#0f0f23] sm:text-7xl lg:text-[5.25rem] lg:leading-[1.08]">
            Your inbox,
            <br />
            <span className="gradient-text">on autopilot.</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up-d2 mx-auto mt-8 max-w-xl text-lg leading-relaxed text-[#64648a]">
            Sweepy uses AI to find the emails you never read &mdash;
            newsletters, old promotions, expired notifications. Actionable
            cleanup in seconds, not hours.
          </p>

          {/* CTA */}
          <div className="animate-fade-in-up-d3 mt-12 flex flex-col items-center gap-5">
            <a
              href="/login"
              className="glow-button rounded-xl px-10 py-4 text-base font-semibold text-white"
            >
              Start Free Trial
            </a>
            <span className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase">
              7 days free &middot; then $5/mo &middot; cancel anytime
            </span>
          </div>
        </div>
      </section>

      {/* ═══ Panel 2 · Features ═══ */}
      <section className="sticky top-16 z-[2] glass-panel rounded-t-3xl min-h-[calc(100vh-4rem)]">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#9898b0] uppercase">
              // Features
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0f0f23] sm:text-4xl">
              A smarter way to manage{" "}
              <span className="gradient-text">your inbox</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#64648a]">
              Stop manually unsubscribing and deleting. Let AI do the heavy
              lifting.
            </p>
          </div>

          <div className="mx-auto mt-14 grid w-full max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card — AI */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-[#0f0f23]">
                AI Categorization
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64648a]">
                Every email gets categorized automatically &mdash; newsletters,
                promotions, notifications, social. No rules to configure.
              </p>
            </div>

            {/* Card — Suggestions */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-[#0f0f23]">
                Smart Suggestions
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64648a]">
                Get actionable suggestions: archive, unsubscribe, delete, or
                keep. You stay in control of every decision.
              </p>
            </div>

            {/* Card — Privacy */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-[#0f0f23]">
                Privacy First
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64648a]">
                We only read email metadata &mdash; sender, subject, date. Your
                email body is never sent to our servers or any AI provider.
              </p>
            </div>

            {/* Card — Gmail */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-[#0f0f23]">
                Works with Gmail
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64648a]">
                Install the Chrome extension, connect your Gmail, and start
                cleaning up in minutes. No complex setup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Panel 3 · How it works ═══ */}
      <section className="sticky top-16 z-[3] glass-panel rounded-t-3xl min-h-[calc(100vh-4rem)]">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#9898b0] uppercase">
              // How it works
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0f0f23] sm:text-4xl">
              Three steps to a{" "}
              <span className="gradient-text">cleaner inbox</span>
            </h2>
          </div>

          <div className="mx-auto mt-16 grid w-full max-w-4xl gap-8 sm:grid-cols-3">
            <div className="text-center">
              <span className="font-mono text-6xl font-bold text-[#0f0f23]/[0.04] select-none">
                01
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-[#0f0f23]">
                Install the extension
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64648a]">
                Add Sweepy to Chrome from the Web Store. Sign in with your
                Google account to get started.
              </p>
            </div>

            <div className="text-center">
              <span className="font-mono text-6xl font-bold text-[#0f0f23]/[0.04] select-none">
                02
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-[#0f0f23]">
                Scan your inbox
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64648a]">
                Sweepy scans your email metadata and uses AI to categorize every
                message. Runs in seconds.
              </p>
            </div>

            <div className="text-center">
              <span className="font-mono text-6xl font-bold text-[#0f0f23]/[0.04] select-none">
                03
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-[#0f0f23]">
                Review &amp; clean
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64648a]">
                Review the cleanup suggestions, approve what you like, and watch
                your inbox get organized instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Panel 4 · Pricing ═══ */}
      <section className="sticky top-16 z-[4] glass-panel rounded-t-3xl min-h-[calc(100vh-4rem)]">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#9898b0] uppercase">
              // Pricing
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0f0f23] sm:text-4xl">
              Simple, transparent{" "}
              <span className="gradient-text">pricing</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-[#64648a]">
              One plan. No hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-md">
            <div className="gradient-border rounded-2xl p-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#0f0f23]">Pro</h3>
                <span className="rounded-full bg-indigo-50 px-3 py-1 font-mono text-[10px] tracking-wider text-indigo-600 uppercase">
                  7-day trial
                </span>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-[#0f0f23]">
                  $5
                </span>
                <span className="text-base text-[#9898b0]">/month</span>
              </div>

              <p className="mt-4 text-sm text-[#64648a]">
                Everything you need to keep your inbox clean.
              </p>

              <ul className="mt-8 space-y-3.5">
                {[
                  "7-day free trial",
                  "Unlimited inbox scans",
                  "AI-powered categorization",
                  "Smart cleanup suggestions",
                  "Privacy-first: metadata only",
                  "Cancel anytime",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-[#64648a]"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-indigo-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="/login"
                className="glow-button mt-8 block w-full rounded-xl py-3.5 text-center text-sm font-semibold text-white"
              >
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Panel 5 · CTA ═══ */}
      <section className="sticky top-16 z-[5] glass-panel rounded-t-3xl min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-400/[0.06] blur-[100px]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-[#0f0f23] sm:text-5xl">
            Ready to take back
            <br />
            <span className="gradient-text">your inbox?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#64648a]">
            Join Sweepy today and take back control of your email. Your first 7
            days are on us.
          </p>
          <div className="mt-10">
            <a
              href="/login"
              className="glow-button rounded-xl px-10 py-4 text-base font-semibold text-white"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
