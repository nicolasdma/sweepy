import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const auth = await withAuth('actions')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || String(DEFAULT_PAGE)))
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)))
  )
  const status = searchParams.get('status')
  const category = searchParams.get('category')

  const supabase = await createServiceRoleClient()
  const offset = (page - 1) * limit

  let query = supabase
    .from('suggested_actions')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[History] Query error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history', code: 'QUERY_ERROR' },
      { status: 500 }
    )
  }

  const total = count || 0
  const actions = (data || []).map((a) => ({
    id: a.id,
    senderAddress: a.sender_address,
    senderName: a.sender_name,
    subjectPreview: a.subject_preview,
    emailDate: a.email_date,
    category: a.category,
    actionType: a.action_type,
    status: a.status,
    confidence: a.confidence,
    createdAt: a.created_at,
  }))

  return NextResponse.json({
    actions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
