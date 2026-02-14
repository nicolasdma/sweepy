import type { MinimalEmailData, SenderInfo, EmailHeaders } from '@shared/types/email'
import type { GmailMessage } from './client'

/**
 * Parse a "From" header into structured sender info.
 * Handles: "Name <email@domain.com>", "email@domain.com", "<email@domain.com>"
 */
function parseFrom(raw: string): SenderInfo {
  const match = raw.match(/^(?:"?([^"<]*)"?\s*)?<?([^\s>]+@[^\s>]+)>?$/)
  if (!match) {
    return { address: raw.trim(), name: '', domain: '' }
  }

  const name = (match[1] || '').trim()
  const address = match[2].toLowerCase().trim()
  const domain = address.split('@')[1] || ''

  return { address, name, domain }
}

/**
 * Get a header value from a Gmail message by name (case-insensitive).
 */
function getHeader(msg: GmailMessage, name: string): string | null {
  const header = msg.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value ?? null
}

/**
 * Convert a Gmail API message (metadata format) to MinimalEmailData
 * for the classification pipeline.
 */
export function extractMinimalEmailData(msg: GmailMessage): MinimalEmailData | null {
  const fromRaw = getHeader(msg, 'From')
  if (!fromRaw) return null

  const from = parseFrom(fromRaw)
  const subject = (getHeader(msg, 'Subject') || '').slice(0, 200)
  const snippet = (msg.snippet || '').slice(0, 100)
  const dateRaw = getHeader(msg, 'Date')
  const date = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString()
  const isRead = !msg.labelIds?.includes('UNREAD')
  const labels = msg.labelIds ?? []

  const listUnsubscribe = getHeader(msg, 'List-Unsubscribe')
  const listUnsubscribePost = getHeader(msg, 'List-Unsubscribe-Post')
  const precedence = getHeader(msg, 'Precedence')
  const xCampaign = getHeader(msg, 'X-Campaign')
  const returnPath = getHeader(msg, 'Return-Path')

  const returnPathDomain = returnPath
    ? (returnPath.match(/@([^\s>]+)/)?.[1] || '').toLowerCase()
    : ''
  const hasReturnPathMismatch =
    !!returnPathDomain && returnPathDomain !== from.domain

  const headers: EmailHeaders = {
    listUnsubscribe,
    listUnsubscribePost,
    precedence,
    xCampaign,
    returnPath,
    hasListUnsubscribe: !!listUnsubscribe,
    hasPrecedenceBulk:
      precedence?.toLowerCase() === 'bulk' ||
      precedence?.toLowerCase() === 'list',
    isNoreply: /^(no-?reply|do-?not-?reply|notifications?|alerts?|mailer-?daemon|postmaster)@/i.test(from.address),
    hasReturnPathMismatch,
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    from,
    subject,
    snippet,
    date,
    isRead,
    labels,
    headers,
    bodyLength: msg.sizeEstimate || 0,
    linkCount: 0, // Not available in metadata-only format
    imageCount: 0,
    hasUnsubscribeText: !!listUnsubscribe,
  }
}
