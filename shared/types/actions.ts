import type { ActionType, EmailCategory, CategorizationSource } from './categories'

export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'expired'

export interface SuggestedActionRecord {
  id: string
  userId: string
  scanId: string
  gmailEmailId: string
  gmailThreadId: string
  senderAddress: string
  senderName: string
  subjectPreview: string // max 100 chars
  emailDate: string
  category: EmailCategory
  confidence: number
  actionType: ActionType
  reasoning: string | null
  categorizedBy: CategorizationSource
  status: ActionStatus
  createdAt: string
  expiresAt: string // 7 days TTL
}

export interface ActionLogEntry {
  id: string
  userId: string
  emailId: string
  actionType: ActionType
  confidenceScore: number
  wasBatchApproved: boolean
  executedAt: string
  result: 'success' | 'error'
  errorMessage: string | null
  emailSubjectHash: string // SHA-256
}

export type FeedbackType = 'approved' | 'rejected' | 'corrected'

export interface UserFeedbackRecord {
  id: string
  userId: string
  actionId: string
  originalCategory: EmailCategory
  originalAction: ActionType
  originalConfidence: number
  userCategory: EmailCategory | null
  userAction: ActionType | null
  feedbackType: FeedbackType
  senderAddress: string
  senderDomain: string
  createdAt: string
}
