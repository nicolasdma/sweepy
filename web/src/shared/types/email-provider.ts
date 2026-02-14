import type { EmailMetadata, ScanOptions } from './email'

export type ActionResultStatus = 'success' | 'error'

export interface ActionResult {
  status: ActionResultStatus
  error?: string
}

export interface UnsubscribeInfo {
  hasOneClick: boolean
  httpUrl: string | null
  mailtoUrl: string | null
}

export interface EmailProvider {
  getEmails(options: ScanOptions): Promise<EmailMetadata[]>
  archiveEmail(id: string): Promise<ActionResult>
  moveToLabel(id: string, label: string): Promise<ActionResult>
  markAsRead(id: string): Promise<ActionResult>
  getUnsubscribeInfo(id: string): Promise<UnsubscribeInfo | null>
}
