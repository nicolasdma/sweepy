import PostalMime from 'postal-mime'
import type { EmailHeaders } from '@shared/types/email'

/**
 * Parse MIME source to extract email headers.
 * Uses PostalMime for RFC-compliant parsing.
 */
export async function parseMimeHeaders(
  mimeSource: string
): Promise<Partial<EmailHeaders>> {
  try {
    const parser = new PostalMime()
    const parsed = await parser.parse(mimeSource)

    const headers: Record<string, string> = {}
    if (parsed.headers) {
      for (const header of parsed.headers) {
        headers[header.key.toLowerCase()] = header.value
      }
    }

    const listUnsubscribe = headers['list-unsubscribe'] || null
    const listUnsubscribePost = headers['list-unsubscribe-post'] || null
    const precedence = headers['precedence'] || null
    const xCampaign =
      headers['x-campaign'] || headers['x-campaignid'] || null
    const returnPath = headers['return-path'] || null

    const hasListUnsubscribe = !!listUnsubscribe
    const hasPrecedenceBulk = precedence?.toLowerCase() === 'bulk'

    const fromHeader = headers['from'] || ''
    const fromDomain = extractDomain(fromHeader)
    const returnPathDomain = returnPath ? extractDomain(returnPath) : null
    const hasReturnPathMismatch = !!(
      returnPathDomain &&
      fromDomain &&
      returnPathDomain !== fromDomain
    )

    const bodyText = parsed.text || ''
    const bodyHtml = parsed.html || ''

    return {
      listUnsubscribe,
      listUnsubscribePost,
      precedence,
      xCampaign,
      returnPath,
      hasListUnsubscribe,
      hasPrecedenceBulk,
      isNoreply: false, // Determined from "from" field, not MIME
      hasReturnPathMismatch,
    }
  } catch (error) {
    console.error('[Sweepy] MIME parse error:', error)
    return {}
  }
}

export function extractDomain(headerValue: string): string | null {
  const match = headerValue.match(/@([a-zA-Z0-9.-]+)/)
  return match ? match[1].toLowerCase() : null
}
