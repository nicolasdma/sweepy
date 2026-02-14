import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="relative min-h-screen bg-[#fafaf8]">
      {/* Ambient background */}
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />
      <div className="fixed left-[60%] top-[10%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-400/[0.05] blur-[140px] pointer-events-none" />
      <div className="fixed right-[10%] bottom-[20%] h-[300px] w-[300px] rounded-full bg-violet-400/[0.04] blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.04] bg-[#fafaf8]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-[#0f0f23]"
          >
            Sweepy
          </a>

          <div className="flex items-center gap-5">
            <span className="font-mono text-[11px] tracking-wider text-[#9898b0] uppercase hidden sm:inline">
              {user.email}
            </span>
            <form action="/api/v1/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-[#64648a] transition-colors hover:text-[#0f0f23]"
              >
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
