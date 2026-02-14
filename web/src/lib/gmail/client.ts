import { getValidToken } from './auth'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const CONCURRENCY = 10

// Headers we request from Gmail API to feed the pipeline
export const METADATA_HEADERS = [
  'From',
  'Subject',
  'Date',
  'List-Unsubscribe',
  'List-Unsubscribe-Post',
  'Precedence',
  'X-Campaign',
  'X-Mailer',
  'Return-Path',
]

export interface GmailMessageHeader {
  name: string
  value: string
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  sizeEstimate: number
  payload: {
    headers: GmailMessageHeader[]
  }
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
}

/**
 * Authenticated fetch to Gmail API. Auto-refreshes token on 401.
 */
async function gmailFetch(
  userId: string,
  path: string,
  options: RequestInit = {},
  _retried = false
): Promise<Response> {
  const token = await getValidToken(userId)

  const res = await fetch(`${GMAIL_API_BASE}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Retry once on 401 (token might have just expired)
  if (res.status === 401 && !_retried) {
    console.warn('[Sweepy:Gmail] Got 401, retrying with fresh token')
    return gmailFetch(userId, path, options, true)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail API error ${res.status}: ${text}`)
  }

  return res
}

/**
 * List all message IDs matching a query, with automatic pagination.
 */
export async function listMessageIds(
  userId: string,
  query = 'in:inbox',
  maxResults = 500,
  onProgress?: (fetched: number) => void
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  while (ids.length < maxResults) {
    const batchSize = Math.min(100, maxResults - ids.length) // Gmail max per page = 100
    const params = new URLSearchParams({
      q: query,
      maxResults: String(batchSize),
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await gmailFetch(userId, `messages?${params}`)
    const data = await res.json()

    if (data.messages) {
      for (const msg of data.messages) {
        ids.push(msg.id)
      }
    }

    onProgress?.(ids.length)

    if (!data.nextPageToken || ids.length >= maxResults) break
    pageToken = data.nextPageToken
  }

  return ids.slice(0, maxResults)
}

/**
 * Get a single message with metadata-only format.
 */
export async function getMessageMetadata(
  userId: string,
  messageId: string
): Promise<GmailMessage> {
  const headerParams = METADATA_HEADERS.map(
    (h) => `metadataHeaders=${encodeURIComponent(h)}`
  ).join('&')
  const res = await gmailFetch(
    userId,
    `messages/${messageId}?format=metadata&${headerParams}`
  )
  return res.json()
}

/**
 * Fetch multiple messages in parallel with limited concurrency.
 */
export async function batchGetMessages(
  userId: string,
  ids: string[],
  onProgress?: (fetched: number, total: number) => void
): Promise<GmailMessage[]> {
  const results: GmailMessage[] = []
  let completed = 0

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY)

    const settled = await Promise.allSettled(
      chunk.map((id) => getMessageMetadata(userId, id))
    )

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        console.warn(`[Sweepy:Gmail] Failed to fetch message: ${result.reason}`)
      }
    }

    completed += chunk.length
    onProgress?.(completed, ids.length)
  }

  return results
}

/**
 * Modify labels on multiple messages (max 1000 per call).
 * To archive: removeLabelIds=['INBOX']
 * To mark read: removeLabelIds=['UNREAD']
 */
export async function batchModifyMessages(
  userId: string,
  ids: string[],
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<void> {
  // Gmail limit: 1000 IDs per batchModify
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000)
    await gmailFetch(userId, 'messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({ ids: chunk, addLabelIds, removeLabelIds }),
    })
  }
}

/**
 * Move a single message to trash.
 */
export async function trashMessage(
  userId: string,
  messageId: string
): Promise<void> {
  await gmailFetch(userId, `messages/${messageId}/trash`, { method: 'POST' })
}

/**
 * List all labels for the user.
 */
export async function listLabels(userId: string): Promise<GmailLabel[]> {
  const res = await gmailFetch(userId, 'labels')
  const data = await res.json()
  return data.labels || []
}

/**
 * Create a new label.
 */
export async function createLabel(
  userId: string,
  name: string
): Promise<GmailLabel> {
  const res = await gmailFetch(userId, 'labels', {
    method: 'POST',
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  })
  return res.json()
}

/**
 * Get or create a label by name.
 */
export async function getOrCreateLabel(
  userId: string,
  name: string
): Promise<GmailLabel> {
  const labels = await listLabels(userId)
  const existing = labels.find(
    (l) => l.name.toLowerCase() === name.toLowerCase()
  )
  if (existing) return existing
  return createLabel(userId, name)
}
