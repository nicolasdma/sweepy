export default function HomePage() {
  return (
    <section className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 dot-grid opacity-60" />
      <div className="absolute left-1/2 top-[15%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-400/[0.08] blur-[120px] animate-float animate-pulse-soft" />
      <div
        className="absolute right-[15%] top-[40%] h-[350px] w-[350px] rounded-full bg-violet-400/[0.06] blur-[100px] animate-float"
        style={{ animationDelay: "-8s" }}
      />

      {/* ── Main content (centered) ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center sm:px-6">
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
          Sweepy uses AI to find the emails you never read &mdash; newsletters,
          old promotions, expired notifications. Actionable cleanup in seconds,
          not hours.
        </p>

        {/* CTA */}
        <div className="animate-fade-in-up-d3 mt-10 flex flex-col items-center gap-4">
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

      {/* ── Bottom strip ── */}
      <div className="relative z-10 w-full px-4 pb-6 sm:px-6">
        {/* Feature highlights */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2 text-[13px] text-[#9898b0]">
            <svg className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI categorization
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#9898b0]">
            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Smart suggestions
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#9898b0]">
            <svg className="h-3.5 w-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Privacy first
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#9898b0]">
            <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Works with Gmail
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-[#c0c0ce]">
          <a href="/privacy" className="transition-colors hover:text-[#9898b0]">
            Privacy
          </a>
          <span>&middot;</span>
          <a href="/terms" className="transition-colors hover:text-[#9898b0]">
            Terms
          </a>
          <span>&middot;</span>
          <a
            href="mailto:privacy@sweepy.site"
            className="transition-colors hover:text-[#9898b0]"
          >
            Contact
          </a>
          <span>&middot;</span>
          <span>&copy; {new Date().getFullYear()} Sweepy</span>
        </div>
      </div>
    </section>
  )
}
