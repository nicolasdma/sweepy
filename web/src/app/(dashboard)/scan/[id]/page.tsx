import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ScanResults } from './scan-results'

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams
  const initialCategory = typeof query.category === 'string' ? query.category : undefined
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scan } = await supabase
    .from('email_scans')
    .select(
      'id, status, total_emails_scanned, category_counts, resolved_by_heuristic, resolved_by_cache, resolved_by_llm, created_at, completed_at'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!scan) notFound()

  // Paginate to fetch ALL actions (Supabase caps at 1000 rows per request)
  const PAGE_SIZE = 1000
  type ActionRow = { id: string; gmail_email_id: string; sender_address: string; sender_name: string | null; subject_preview: string | null; email_date: string | null; category: string; confidence: number; action_type: string; reasoning: string | null; categorized_by: string; status: string }
  const actions: ActionRow[] = []

  let offset = 0
  while (true) {
    const { data: page } = await supabase
      .from('suggested_actions')
      .select(
        'id, gmail_email_id, sender_address, sender_name, subject_preview, email_date, category, confidence, action_type, reasoning, categorized_by, status'
      )
      .eq('scan_id', id)
      .order('category')
      .order('email_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (!page || page.length === 0) break
    actions.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#9898b0] transition-colors hover:text-[#0f0f23]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Dashboard
      </Link>

      <ScanResults scan={scan} actions={actions ?? []} initialCategory={initialCategory} />
    </div>
  )
}
