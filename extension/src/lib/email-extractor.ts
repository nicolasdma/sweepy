import type { MinimalEmailData, SenderInfo, EmailHeaders } from '@shared/types/email'

const SUBJECT_MAX_LENGTH = 200
const SNIPPET_MAX_LENGTH = 100

/**
 * Raw email data shape from gmail.js (GmailNewEmailData).
 * We define a local interface to avoid depending on gmail.js types at compile time,
 * since the main-world script accesses gmail.js at runtime in the page context.
 */
export interface RawGmailEmail {
  id: string
  legacy_email_id?: string
  thread_id: string
  smtp_id?: string
  is_draft?: boolean
  subject: string
  timestamp: number
  date: Date | string
  from: { address: string; name: string } | string
  to?: { address: string; name: string }[]
  cc?: { address: string; name: string }[]
  bcc?: { address: string; name: string }[]
  attachments?: unknown[]
  content_html?: string
  content_plain?: string
}

/**
 * Raw thread data shape from gmail.js (GmailNewThreadData).
 */
export interface RawGmailThread {
  thread_id: string
  emails: RawGmailEmail[]
}

/**
 * Parsed MIME headers extracted from raw email source.
 */
export interface RawMimeHeaders {
  'list-unsubscribe'?: string
  'list-unsubscribe-post'?: string
  precedence?: string
  'x-campaign'?: string
  'x-campaignid'?: string
  'x-mailer'?: string
  'return-path'?: string
  [key: string]: string | undefined
}

/**
 * Extract minimal email data from a gmail.js email object.
 * Strips body content, keeps only metadata and derived signals.
 */
export function extractEmailData(
  rawEmail: RawGmailEmail,
  mimeHeaders?: RawMimeHeaders
): MinimalEmailData | null {
  try {
    const from = parseFromField(rawEmail.from)
    if (!from) return null

    const subject = sanitizeAndTruncate(rawEmail.subject || '', SUBJECT_MAX_LENGTH)
    const snippet = buildSnippet(rawEmail.content_html || rawEmail.content_plain || '')
    const date = normalizeDate(rawEmail.date, rawEmail.timestamp)
    const headers = buildHeaders(from, mimeHeaders)
    const bodyAnalysis = analyzeBody(rawEmail.content_html || '', rawEmail.content_plain || '')

    return {
      id: rawEmail.id,
      threadId: rawEmail.thread_id || rawEmail.id,
      from,
      subject,
      snippet,
      date,
      isRead: true, // gmail.js doesn't expose read status directly; set by caller
      labels: [], // gmail.js doesn't expose label IDs; populated by Gmail API path
      headers,
      bodyLength: bodyAnalysis.bodyLength,
      linkCount: bodyAnalysis.linkCount,
      imageCount: bodyAnalysis.imageCount,
      hasUnsubscribeText: bodyAnalysis.hasUnsubscribeText,
    }
  } catch (error) {
    console.error('[Sweepy:Extractor] Failed to extract email data:', error)
    return null
  }
}

/**
 * Extract minimal data from each email in a thread.
 * Returns the latest (last) email's data, with thread_id preserved.
 */
export function extractFromThread(
  thread: RawGmailThread,
  mimeHeaders?: RawMimeHeaders
): MinimalEmailData | null {
  if (!thread.emails || thread.emails.length === 0) return null

  // Use the latest email in the thread
  const latestEmail = thread.emails[thread.emails.length - 1]
  return extractEmailData(latestEmail, mimeHeaders)
}

/**
 * Parse the "from" field which can be a string like "Name <email@domain.com>"
 * or an object { address, name }.
 */
export function parseFromField(
  from: string | { address: string; name: string } | null | undefined
): SenderInfo | null {
  if (!from) return null

  if (typeof from === 'object' && 'address' in from) {
    const address = from.address.toLowerCase().trim()
    return {
      address,
      name: from.name?.trim() || '',
      domain: address.split('@')[1] || '',
    }
  }

  if (typeof from === 'string') {
    // Parse "Name <email@domain.com>" or just "email@domain.com"
    const match = from.match(/^(?:"?(.+?)"?\s+)?<?([^\s<>]+@[^\s<>]+)>?$/)
    if (!match) return null

    const address = match[2].toLowerCase().trim()
    return {
      address,
      name: match[1]?.trim() || '',
      domain: address.split('@')[1] || '',
    }
  }

  return null
}

/**
 * Build EmailHeaders from parsed MIME headers and sender info.
 */
function buildHeaders(
  from: SenderInfo,
  mime?: RawMimeHeaders
): EmailHeaders {
  const listUnsubscribe = mime?.['list-unsubscribe'] || null
  const listUnsubscribePost = mime?.['list-unsubscribe-post'] || null
  const precedence = mime?.['precedence'] || null
  const xCampaign = mime?.['x-campaign'] || mime?.['x-campaignid'] || null
  const returnPath = mime?.['return-path'] || null

  const returnPathDomain = returnPath
    ? extractDomainFromHeader(returnPath)
    : null
  const hasReturnPathMismatch = !!(
    returnPathDomain && from.domain && returnPathDomain !== from.domain
  )

  return {
    listUnsubscribe,
    listUnsubscribePost,
    precedence,
    xCampaign,
    returnPath,
    hasListUnsubscribe: !!listUnsubscribe,
    hasPrecedenceBulk: precedence?.toLowerCase() === 'bulk',
    isNoreply:
      from.address.startsWith('noreply@') ||
      from.address.startsWith('no-reply@') ||
      from.address.includes('donotreply') ||
      from.address.includes('do-not-reply'),
    hasReturnPathMismatch,
  }
}

/**
 * Analyze body content for derived signals without storing the body itself.
 */
function analyzeBody(
  html: string,
  plain: string
): {
  bodyLength: number
  linkCount: number
  imageCount: number
  hasUnsubscribeText: boolean
} {
  const plainText = plain || stripHtml(html)
  const bodyLength = plainText.length

  // Count links in HTML
  const linkMatches = html.match(/<a\s/gi)
  const linkCount = linkMatches ? linkMatches.length : 0

  // Count images in HTML
  const imgMatches = html.match(/<img\s/gi)
  const imageCount = imgMatches ? imgMatches.length : 0

  // Check for unsubscribe text (case-insensitive)
  const lowerText = (plainText + ' ' + html).toLowerCase()
  const hasUnsubscribeText =
    lowerText.includes('unsubscribe') ||
    lowerText.includes('opt out') ||
    lowerText.includes('opt-out') ||
    lowerText.includes('manage your subscription') ||
    lowerText.includes('email preferences')

  return { bodyLength, linkCount, imageCount, hasUnsubscribeText }
}

/**
 * Build a snippet from HTML/text content.
 */
function buildSnippet(content: string): string {
  return sanitizeAndTruncate(content, SNIPPET_MAX_LENGTH)
}

/**
 * Normalize a date to ISO 8601 string.
 */
function normalizeDate(
  date: Date | string | undefined,
  timestamp: number | undefined
): string {
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString()
  }
  if (typeof date === 'string' && date.length > 0) {
    const parsed = new Date(date)
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  }
  if (timestamp && timestamp > 0) {
    // gmail.js timestamps are in seconds (Unix epoch)
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000
    return new Date(ms).toISOString()
  }
  return new Date().toISOString()
}

/**
 * Extract domain from a header value containing an email address.
 */
function extractDomainFromHeader(headerValue: string): string | null {
  const match = headerValue.match(/@([a-zA-Z0-9.-]+)/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Sanitize text: remove PII patterns, strip HTML, truncate.
 */
export function sanitizeAndTruncate(text: string, maxLength: number): string {
  const sanitized = text
    // Strip HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Redact credit card numbers (13-19 digits with optional spaces/dashes)
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g, '[REDACTED]')
    // Redact SSN patterns
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]')
    // Redact long tokens/hashes (32+ hex chars)
    .replace(/\b[a-fA-F0-9]{32,}\b/g, '[TOKEN]')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized.slice(0, maxLength)
}
