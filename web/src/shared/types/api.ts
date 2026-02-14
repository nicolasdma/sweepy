import type { MinimalEmailData, ScanOptions } from './email'
import type { CategorizationResult, EmailCategory, ActionType } from './categories'

// POST /api/v1/emails/analyze
export interface AnalyzeRequest {
  emails: MinimalEmailData[]
  scanOptions?: ScanOptions
}

export interface AnalyzeResponse {
  results: CategorizationResult[]
  scanId: string
  stats: {
    total: number
    resolvedByHeuristic: number
    resolvedByCache: number
    resolvedByLlm: number
    llmCostUsd: number
  }
}

// POST /api/v1/actions/reject
export interface RejectActionRequest {
  actionId: string
  userCategory?: EmailCategory
  userAction?: ActionType
  feedback?: string
}

export interface RejectActionResponse {
  success: boolean
  updatedSenderCategory?: EmailCategory
}

// GET /api/v1/actions/history
export interface ActionHistoryParams {
  page?: number
  limit?: number
  status?: string
  category?: string
}

export interface ActionHistoryResponse {
  actions: Array<{
    id: string
    senderAddress: string
    senderName: string
    subjectPreview: string
    emailDate: string
    category: EmailCategory
    actionType: ActionType
    status: string
    confidence: number
    createdAt: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// GET /api/v1/config
export interface RemoteConfig {
  minExtensionVersion: string
  features: {
    actionsEnabled: boolean
    unsubscribeEnabled: boolean
    llmEnabled: boolean
    maxEmailsPerScan: number
    maxScansPerDay: number
  }
  maintenance: {
    enabled: boolean
    message?: string
  }
}

// Common API error response
export interface ApiError {
  error: string
  code: string
  details?: Record<string, unknown>
}
