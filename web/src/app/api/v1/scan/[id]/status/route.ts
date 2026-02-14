import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/scan/:id/status
 * Returns the current status of a scan.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createServiceRoleClient()

  const { data: scan, error } = await supabase
    .from('email_scans')
    .select(
      'id, status, total_emails_scanned, category_counts, resolved_by_heuristic, resolved_by_cache, resolved_by_llm, llm_cost_usd, created_at, completed_at'
    )
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single()

  if (error || !scan) {
    return NextResponse.json(
      { error: 'Scan not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  return NextResponse.json({ scan })
}
