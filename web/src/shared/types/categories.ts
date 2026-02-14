export const EMAIL_CATEGORIES = [
  'newsletter',
  'marketing',
  'transactional',
  'social',
  'notification',
  'spam',
  'personal',
  'important',
  'unknown',
] as const

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

export const PROTECTED_CATEGORIES: EmailCategory[] = ['personal', 'important']

export type CategorizationSource = 'heuristic' | 'cache' | 'llm' | 'user_override'

export interface CategorizationResult {
  emailId: string
  category: EmailCategory
  confidence: number // 0-1
  source: CategorizationSource
  reasoning?: string // Only from LLM
  suggestedActions: SuggestedAction[]
}

export type ActionType = 'archive' | 'unsubscribe' | 'move_to_trash' | 'mark_read' | 'keep'

export interface SuggestedAction {
  type: ActionType
  reason: string
  priority: number // 1 (low) to 5 (high)
}

/** Combined type for display: categorization result + email metadata */
export interface ClassifiedEmail {
  emailId: string
  threadId: string
  sender: { address: string; name: string; domain: string }
  subject: string
  snippet: string
  date: string
  isRead: boolean
  category: EmailCategory
  confidence: number
  categorizedBy: CategorizationSource
  reasoning?: string
  suggestedActions: SuggestedAction[]
}
