import type { EmailCategory } from './categories'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive'

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  trialStart: string | null
  trialEnd: string | null
  currentPeriodEnd: string | null
  categoriesToProtect: EmailCategory[]
  scanLimitPerDay: number
  createdAt: string
  updatedAt: string
}

export interface ScanSummary {
  id: string
  startedAt: string
  completedAt: string | null
  status: 'running' | 'completed' | 'failed'
  totalEmailsScanned: number
  resolvedByHeuristic: number
  resolvedByCache: number
  resolvedByLlm: number
  llmCostUsd: number
  categoryCounts: Record<EmailCategory, number>
}

export interface UsageStats {
  periodStart: string
  periodEnd: string
  scansCount: number
  emailsProcessed: number
  llmCallsCount: number
  llmTokensUsed: number
}
