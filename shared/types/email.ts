export interface EmailMetadata {
  id: string
  threadId: string
  from: SenderInfo
  subject: string
  snippet: string // max 100 chars
  date: string // ISO 8601
  isRead: boolean
  labels: string[]
  // Derived fields (no raw body sent)
  bodyLength: number
  linkCount: number
  imageCount: number
  hasUnsubscribeText: boolean
}

export interface SenderInfo {
  address: string
  name: string
  domain: string
}

export interface EmailHeaders {
  listUnsubscribe: string | null
  listUnsubscribePost: string | null // RFC 8058 one-click
  precedence: string | null
  xCampaign: string | null
  returnPath: string | null
  // Boolean flags derived from headers
  hasListUnsubscribe: boolean
  hasPrecedenceBulk: boolean
  isNoreply: boolean
  hasReturnPathMismatch: boolean
}

export interface MinimalEmailData {
  id: string
  threadId: string
  from: SenderInfo
  subject: string // max 200 chars
  snippet: string // max 100 chars
  date: string
  isRead: boolean
  headers: EmailHeaders
  bodyLength: number
  linkCount: number
  imageCount: number
  hasUnsubscribeText: boolean
}

export interface ScanOptions {
  maxEmails?: number // default 1000
  maxDays?: number // default 30
  onlyUnread?: boolean
  startFromMessageId?: string // for incremental scans
}
