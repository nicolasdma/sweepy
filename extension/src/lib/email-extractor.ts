import type { MinimalEmailData, SenderInfo, EmailHeaders } from '@shared/types/email'

const SUBJECT_MAX_LENGTH = 200
const SNIPPET_MAX_LENGTH = 100

/**
 * Extract minimal email data from gmail.js email object.
 * Sanitizes and minimizes data before sending to backend.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractEmailData(gmailEmail: any): MinimalEmailData | null {
  try {
    const from = parseFromField(gmailEmail.from)
    if (!from) return null

    const subject = sanitizeAndTruncate(
      gmailEmail.subject || '',
      SUBJECT_MAX_LENGTH
    )
    const snippet = sanitizeAndTruncate(
      gmailEmail.snippet || gmailEmail.content_html || '',
      SNIPPET_MAX_LENGTH
    )

    const headers: EmailHeaders = {
      listUnsubscribe: null,
      listUnsubscribePost: null,
      precedence: null,
      xCampaign: null,
      returnPath: null,
      hasListUnsubscribe: false,
      hasPrecedenceBulk: false,
      isNoreply:
        from.address.startsWith('noreply@') ||
        from.address.startsWith('no-reply@'),
      hasReturnPathMismatch: false,
    }

    return {
      id: gmailEmail.id,
      threadId: gmailEmail.thread_id || gmailEmail.id,
      from,
      subject,
      snippet,
      date: gmailEmail.date || new Date().toISOString(),
      isRead: !gmailEmail.is_unread,
      headers,
      bodyLength: 0,
      linkCount: 0,
      imageCount: 0,
      hasUnsubscribeText: false,
    }
  } catch (error) {
    console.error('[InboxPilot] Failed to extract email data:', error)
    return null
  }
}

export function parseFromField(
  from: string | { address: string; name: string }
): SenderInfo | null {
  if (!from) return null

  if (typeof from === 'object') {
    return {
      address: from.address.toLowerCase(),
      name: from.name || '',
      domain: from.address.split('@')[1]?.toLowerCase() || '',
    }
  }

  // Parse "Name <email@domain.com>" format
  const match = from.match(/^(?:"?(.+?)"?\s+)?<?([^\s<>]+@[^\s<>]+)>?$/)
  if (!match) return null

  const address = match[2].toLowerCase()
  return {
    address,
    name: match[1] || '',
    domain: address.split('@')[1] || '',
  }
}

/**
 * Sanitize text: remove potential PII patterns, truncate.
 */
export function sanitizeAndTruncate(
  text: string,
  maxLength: number
): string {
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
