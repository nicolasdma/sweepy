/**
 * MAIN world content script -- runs in the page JS context.
 * Uses gmail.js to hook into Gmail's XHR/fetch and extract email data.
 * Communicates with ISOLATED world via window.postMessage.
 *
 * gmail.js is a CommonJS module that attaches `Gmail` to `exports`.
 * In the MAIN world bundle (processed by Vite), we import it as an ES module.
 */

import Gmail from 'gmail-js'
import {
  extractEmailData,
  extractFromThread,
  type RawGmailEmail,
  type RawGmailThread,
  type RawMimeHeaders,
} from '@/lib/email-extractor'
import type { MinimalEmailData, ScanOptions } from '@shared/types/email'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MainWorldPostMessage {
  id: string
  type: string
  payload?: unknown
  source: 'sweepy-main'
  timestamp: number
}

// gmail.js instance -- typed as `any` because the Gmail class types expect
// jQuery which we don't ship; the runtime works fine with `false`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gmail: any = null
let isReady = false
let scanAbortController: AbortController | null = null

// ---------------------------------------------------------------------------
// PostMessage helpers
// ---------------------------------------------------------------------------

function sendToIsolated(type: string, payload?: unknown): void {
  const message: MainWorldPostMessage = {
    id: crypto.randomUUID(),
    type,
    payload,
    source: 'sweepy-main',
    timestamp: Date.now(),
  }
  window.postMessage(message, '*')
}

// ---------------------------------------------------------------------------
// Listen for commands from ISOLATED world
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if (event.data?.source !== 'sweepy-isolated') return

  const { type, payload } = event.data

  switch (type) {
    case 'START_SCAN':
      handleStartScan(payload as ScanOptions)
      break
    case 'STOP_SCAN':
      handleStopScan()
      break
  }
})

// ---------------------------------------------------------------------------
// Gmail.js initialization
// ---------------------------------------------------------------------------

function initGmailJs(): void {
  try {
    // gmail.js constructor accepts jQuery or `false` (no jQuery).
    // Passing `false` disables DOM-based features (compose helpers, toolbars)
    // but keeps XHR interception and data reading -- which is all we need.
    gmail = new Gmail(false)

    gmail.observe.on('load', () => {
      try {
        // Health check: can we read the user's email address?
        const userEmail: string = gmail.get.user_email()
        if (userEmail) {
          isReady = true
          sendToIsolated('READY', { userEmail })
          console.log(`[Sweepy:Main] Gmail.js ready for ${userEmail}`)
        } else {
          sendToIsolated('HEALTH_CHECK_FAILED', {
            error: 'Could not read user email -- gmail.js loaded but no user data',
          })
        }
      } catch (error) {
        sendToIsolated('HEALTH_CHECK_FAILED', {
          error: error instanceof Error ? error.message : 'Unknown health check error',
        })
      }
    })
  } catch (error) {
    sendToIsolated('HEALTH_CHECK_FAILED', {
      error: error instanceof Error ? error.message : 'Failed to initialize gmail.js',
    })
  }
}

// ---------------------------------------------------------------------------
// Scan logic
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50

async function handleStartScan(options: ScanOptions): Promise<void> {
  if (!isReady || !gmail) {
    sendToIsolated('EXTRACTION_ERROR', { error: 'Gmail.js not ready' })
    return
  }

  // Abort any running scan
  scanAbortController?.abort()
  scanAbortController = new AbortController()
  const signal = scanAbortController.signal

  try {
    // Get visible email thread IDs from gmail.js
    const visibleEmailIds: string[] = gmail.get.visible_emails() || []
    if (visibleEmailIds.length === 0) {
      sendToIsolated('EMAILS_EXTRACTED', {
        emails: [],
        batchIndex: 0,
        totalBatches: 0,
      })
      return
    }

    // Apply maxEmails limit
    const maxEmails = options?.maxEmails ?? 1000
    const emailIds = visibleEmailIds.slice(0, maxEmails)
    const totalBatches = Math.ceil(emailIds.length / BATCH_SIZE)
    const maxDays = options?.maxDays ?? 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - maxDays)

    let processed = 0

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (signal.aborted) {
        console.log('[Sweepy:Main] Scan aborted')
        return
      }

      const batchIds = emailIds.slice(
        batchIdx * BATCH_SIZE,
        (batchIdx + 1) * BATCH_SIZE
      )
      const batchResults: MinimalEmailData[] = []

      for (const emailId of batchIds) {
        if (signal.aborted) return

        try {
          const emailData = extractSingleEmail(emailId, cutoffDate)
          if (emailData) {
            batchResults.push(emailData)
          }
        } catch (error) {
          console.warn(
            `[Sweepy:Main] Failed to extract email ${emailId}:`,
            error
          )
          sendToIsolated('EXTRACTION_ERROR', {
            error: error instanceof Error ? error.message : 'Extraction failed',
            emailId,
          })
        }

        processed++
      }

      // Send this batch to the isolated world
      if (batchResults.length > 0) {
        sendToIsolated('EMAILS_EXTRACTED', {
          emails: batchResults,
          batchIndex: batchIdx,
          totalBatches,
        })
      }

      // Report progress
      sendToIsolated('SCAN_PROGRESS', {
        processed,
        total: emailIds.length,
      })

      // Yield to the main thread between batches to avoid jank
      if (batchIdx < totalBatches - 1) {
        await sleep(100)
      }
    }
  } catch (error) {
    sendToIsolated('EXTRACTION_ERROR', {
      error: error instanceof Error ? error.message : 'Scan failed',
    })
  } finally {
    scanAbortController = null
  }
}

function handleStopScan(): void {
  if (scanAbortController) {
    scanAbortController.abort()
    scanAbortController = null
    console.log('[Sweepy:Main] Scan stopped by user')
  }
}

/**
 * Extract a single email by ID using gmail.js APIs.
 * Tries `gmail.new.get.email_data()` first (new data layer),
 * then falls back to `gmail.get.email_data()` (legacy).
 */
function extractSingleEmail(
  emailId: string,
  cutoffDate: Date
): MinimalEmailData | null {
  // Try new data layer first (returns GmailNewEmailData)
  const newEmailData = gmail.new.get.email_data(emailId) as RawGmailEmail | null
  if (newEmailData) {
    // Check date cutoff
    const emailDate = newEmailData.date
      ? new Date(newEmailData.date)
      : newEmailData.timestamp
        ? new Date(
            newEmailData.timestamp > 1e12
              ? newEmailData.timestamp
              : newEmailData.timestamp * 1000
          )
        : null
    if (emailDate && emailDate < cutoffDate) return null

    // Try to get MIME headers via email source (async in gmail.js, but we
    // do a best-effort extraction without blocking). Headers from the new
    // data layer don't include List-Unsubscribe etc., so we leave those
    // fields empty and let the MIME parser in the service worker enrich later.
    return extractEmailData(newEmailData)
  }

  // Fallback: try thread data from new API
  const threadData = gmail.new.get.thread_data(emailId) as RawGmailThread | null
  if (threadData) {
    return extractFromThread(threadData)
  }

  // Fallback: legacy email_data (returns GmailEmailData with nested threads)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyData: any = gmail.get.email_data(emailId)
    if (legacyData && legacyData.threads) {
      const threadIds = Object.keys(legacyData.threads)
      if (threadIds.length === 0) return null

      // Get the last thread entry (most recent email)
      const lastThreadId = threadIds[threadIds.length - 1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailDetail: any = legacyData.threads[lastThreadId]
      if (!emailDetail) return null

      // Map legacy format to our RawGmailEmail
      const rawEmail: RawGmailEmail = {
        id: lastThreadId,
        thread_id: legacyData.thread_id || emailId,
        subject: legacyData.subject || emailDetail.subject || '',
        timestamp: emailDetail.timestamp || 0,
        date: emailDetail.datetime || '',
        from: emailDetail.from_email || emailDetail.from || '',
        content_html: emailDetail.content_html || '',
        content_plain: emailDetail.content_plain || '',
      }

      return extractEmailData(rawEmail)
    }
  } catch {
    // Legacy API may not be available
  }

  return null
}

/**
 * Fetch MIME headers for an email asynchronously.
 * Returns parsed headers or undefined if fetch fails/times out.
 */
export async function fetchMimeHeaders(
  emailId: string
): Promise<RawMimeHeaders | undefined> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(undefined), 5000)

    try {
      gmail.get.email_source_async(
        emailId,
        (source: string) => {
          clearTimeout(timeout)
          if (!source) {
            resolve(undefined)
            return
          }
          // Parse only the headers (before the first empty line)
          const headerEnd = source.indexOf('\r\n\r\n')
          const headerSection =
            headerEnd > 0 ? source.substring(0, headerEnd) : source.substring(0, 4096)
          resolve(parseMimeHeadersRaw(headerSection))
        },
        () => {
          clearTimeout(timeout)
          resolve(undefined)
        }
      )
    } catch {
      clearTimeout(timeout)
      resolve(undefined)
    }
  })
}

/**
 * Parse raw MIME header text into a key-value map.
 */
function parseMimeHeadersRaw(headerText: string): RawMimeHeaders {
  const headers: RawMimeHeaders = {}
  // Unfold continuation lines (RFC 2822)
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ')
  const lines = unfolded.split(/\r?\n/)

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx <= 0) continue
    const key = line.substring(0, colonIdx).trim().toLowerCase()
    const value = line.substring(colonIdx + 1).trim()

    // Only keep headers we care about
    if (
      key === 'list-unsubscribe' ||
      key === 'list-unsubscribe-post' ||
      key === 'precedence' ||
      key === 'x-campaign' ||
      key === 'x-campaignid' ||
      key === 'x-mailer' ||
      key === 'return-path'
    ) {
      headers[key] = value
    }
  }

  return headers
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

initGmailJs()

console.log('[Sweepy:Main] Main world script loaded')
