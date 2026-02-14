/**
 * MAIN world content script -- runs in the page JS context.
 * Uses gmail.js to hook into Gmail's XHR/fetch and extract email data.
 * Communicates with ISOLATED world via window.postMessage.
 *
 * Message types sent here MUST match ContentToWorkerMessage in shared/types/messages.ts.
 * The isolated bridge forwards these to the service worker unchanged (except source/version).
 */

// gmail-js uses `exports.Gmail = Gmail` (CJS named export), but its .d.ts
// declares `Gmail` as an ambient global class. `import Gmail from 'gmail-js'`
// satisfies TS but Vite's CJS interop gives us the module object `{ Gmail: fn }`
// in production, not the constructor directly. We handle both cases.
import GmailDefault from 'gmail-js'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GmailConstructor: new (jq: any) => any =
  (GmailDefault as any).Gmail ?? GmailDefault

// gmail.js claims to work without jQuery (`new Gmail(false)`) but many
// internal methods use `$()` for DOM queries — including observe.on('load').
// We provide a minimal jQuery shim that covers what gmail.js actually needs.
import { miniJQuery } from '@/lib/jquery-shim'
import {
  extractEmailData,
  extractFromThread,
  type RawGmailEmail,
  type RawGmailThread,
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

// gmail.js instance -- typed as `any` because the Gmail class types
// expect full jQuery; we pass a minimal shim instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gmail: any = null
let isReady = false
let scanAbortController: AbortController | null = null

// Version counter to invalidate old message listeners after re-initialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-const
let _msgVersion: number = 0

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
// Listen for commands from ISOLATED world (forwarded from service worker)
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if (event.data?.source !== 'sweepy-isolated') return
  // Ignore messages if a newer script version has taken over
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).__sweepyMsgVersion !== _msgVersion) return

  const { type, payload } = event.data

  switch (type) {
    case 'START_EMAIL_EXTRACTION':
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

/**
 * Try to confirm Gmail is loaded. Prefer gmail.js user_email(), but if that
 * fails we still mark as ready when we can detect the Gmail DOM — the scan
 * strategies (DOM, tracker, etc.) don't actually need the user email.
 */
function performHealthCheck(): void {
  try {
    const userEmail: string = gmail.get.user_email()
    if (userEmail) {
      isReady = true
      sendToIsolated('GMAIL_READY', { userEmail })
      console.log(`[Sweepy:Main] Gmail.js ready for ${userEmail}`)
      return
    }
  } catch {
    // gmail.js user_email() threw — continue with fallback
  }

  // Fallback: gmail.js missed the initial XHR data load (late injection).
  // Check if the Gmail DOM is present — if so, DOM-based scan strategies
  // will still work even without gmail.js internal data.
  const isGmailDom =
    document.querySelector('[role="main"]') !== null ||
    document.querySelector('[data-legacy-thread-id]') !== null ||
    document.querySelector('[data-thread-id]') !== null ||
    document.querySelector('tr.zA') !== null

  if (isGmailDom) {
    isReady = true
    const fallbackEmail = tryExtractEmailFromDom()
    sendToIsolated('GMAIL_READY', { userEmail: fallbackEmail || 'unknown' })
    console.log(`[Sweepy:Main] Gmail DOM detected, marking ready (email: ${fallbackEmail || 'unknown'})`)
    return
  }

  sendToIsolated('GMAIL_HEALTH_CHECK_FAILED', {
    reason: 'Could not read user email and Gmail DOM not detected yet',
  })
}

/** Best-effort: try to extract user email from page DOM or URL. */
function tryExtractEmailFromDom(): string | null {
  try {
    // Gmail shows the user's email in the account switcher / profile area
    const emailEl = document.querySelector('[data-email]')
    if (emailEl) return emailEl.getAttribute('data-email')

    // aria-label on the account button often contains the email
    const accountBtn = document.querySelector('a[aria-label*="@"]')
    if (accountBtn) {
      const label = accountBtn.getAttribute('aria-label') || ''
      const match = label.match(/[\w.-]+@[\w.-]+/)
      if (match) return match[0]
    }
  } catch {
    // DOM query failed — not critical
  }
  return null
}

function initGmailJs(): void {
  try {
    // gmail.js constructor accepts jQuery or `false` (no jQuery).
    // Passing `false` disables DOM-based features (compose helpers, toolbars)
    // but keeps XHR interception and data reading -- which is all we need.
    gmail = new GmailConstructor(miniJQuery as any)

    // Normal path: gmail.js fires 'load' when it detects Gmail's initial data load.
    gmail.observe.on('load', () => {
      performHealthCheck()
    })

    // Fallback: if the script is injected AFTER Gmail has already loaded
    // (e.g., programmatic injection on extension install/update),
    // observe.on('load') won't fire because the XHR events already happened.
    // Try escalating health checks: 2s → 5s → 10s (gives Gmail DOM time to render)
    const retryDelays = [2000, 5000, 10000]
    for (const delay of retryDelays) {
      setTimeout(() => {
        if (!isReady) {
          console.log(`[Sweepy:Main] Health check retry at ${delay}ms...`)
          performHealthCheck()
        }
      }, delay)
    }
  } catch (error) {
    sendToIsolated('GMAIL_HEALTH_CHECK_FAILED', {
      reason: error instanceof Error ? error.message : 'Failed to initialize gmail.js',
    })
  }
}

// ---------------------------------------------------------------------------
// Scan logic
// ---------------------------------------------------------------------------

/**
 * Get visible email/thread IDs from Gmail.
 * gmail.js's built-in visible_emails() uses JSON.parse on Gmail's response,
 * which fails because Gmail returns single-quoted JS (not valid JSON).
 * We bypass that by using gmail.tools.parse_response (which handles the
 * proprietary format) and then gmail.tools.parse_view_data to extract IDs.
 */
function getVisibleEmailIds(): string[] {
  // Strategy 1: use gmail.js visible_emails() (may fail on newer Gmail)
  try {
    const emails = gmail.get.visible_emails()
    if (emails && emails.length > 0) {
      const ids = emails.map((e: any) => typeof e === 'string' ? e : e.id)
      console.log('[Sweepy:Main] Strategy 1 (visible_emails): found', ids.length, 'IDs')
      return ids
    }
  } catch {
    // Expected: JSON.parse fails on single-quoted Gmail responses
  }

  // Strategy 2: manually fetch + parse with gmail.js's parse_response
  try {
    const url = gmail.helper.get.visible_emails_pre()
    const rawData = gmail.tools.make_request(url)
    if (rawData) {
      const parsed = gmail.tools.parse_response(rawData)
      const ids: string[] = []

      for (const chunk of parsed) {
        try {
          const threadData = gmail.tools.parse_view_data(chunk)
          for (const thread of threadData) {
            if (thread && thread.id) ids.push(thread.id)
          }
        } catch {
          // Not all chunks contain thread data — skip
        }
      }

      if (ids.length > 0) {
        console.log('[Sweepy:Main] Strategy 2 (parse_response): found', ids.length, 'IDs')
        return ids
      }
    }
  } catch (e) {
    console.error('[Sweepy:Main] Strategy 2 failed:', e)
  }

  // Strategy 3: read thread IDs from the DOM
  try {
    const ids: string[] = []

    // Gmail uses different DOM structures; try multiple selectors
    // Modern Gmail: each thread row has data-thread-id or data-legacy-thread-id
    document.querySelectorAll('[data-legacy-thread-id]').forEach((el) => {
      const id = el.getAttribute('data-legacy-thread-id')
      if (id) ids.push(id)
    })

    if (ids.length === 0) {
      document.querySelectorAll('[data-thread-id]').forEach((el) => {
        const id = el.getAttribute('data-thread-id')
        if (id) ids.push(id)
      })
    }

    // Fallback: tr.zA rows (classic Gmail) with thread ID in various attributes
    if (ids.length === 0) {
      document.querySelectorAll('tr.zA').forEach((row) => {
        // Try multiple attribute patterns
        const id = row.getAttribute('data-legacy-thread-id')
          || row.getAttribute('data-thread-id')
          || row.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id')
          || row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
        if (id) ids.push(id)
      })
    }

    // Last fallback: look for thread IDs in Gmail's specific span elements
    if (ids.length === 0) {
      // Gmail thread list rows have spans with data-thread-id
      document.querySelectorAll('span[data-thread-id]').forEach((el) => {
        const id = el.getAttribute('data-thread-id')
        if (id) ids.push(id)
      })
    }

    console.log('[Sweepy:Main] Strategy 3 (DOM): found', ids.length, 'IDs')
    if (ids.length > 0) return ids
  } catch (e) {
    console.error('[Sweepy:Main] Strategy 3 failed:', e)
  }

  // Strategy 4: use gmail.js's cached tracker data from XHR interception
  try {
    if (gmail.tracker && gmail.tracker.view_data) {
      const ids: string[] = []
      for (const chunk of gmail.tracker.view_data) {
        try {
          const threadData = gmail.tools.parse_view_data(Array.isArray(chunk) ? chunk : [chunk])
          for (const thread of threadData) {
            if (thread && thread.id) ids.push(thread.id)
          }
        } catch { /* skip */ }
      }
      console.log('[Sweepy:Main] Strategy 4 (tracker cache): found', ids.length, 'IDs')
      if (ids.length > 0) return ids
    }
  } catch (e) {
    console.error('[Sweepy:Main] Strategy 4 failed:', e)
  }

  console.warn('[Sweepy:Main] All strategies failed to find email IDs')
  return []
}

const BATCH_SIZE = 50

async function handleStartScan(options: ScanOptions): Promise<void> {
  console.log('[Sweepy:Main] handleStartScan called, isReady:', isReady, 'gmail:', !!gmail)

  if (!gmail) {
    sendToIsolated('EXTRACTION_ERROR', { error: 'Gmail.js not initialized' })
    return
  }

  // If not yet marked ready, try one more health check — the DOM may have
  // loaded since the initial check failed (late injection scenario).
  if (!isReady) {
    console.log('[Sweepy:Main] Not ready yet, running on-demand health check...')
    performHealthCheck()
    if (!isReady) {
      // Still not ready — give Gmail DOM a moment to settle and try once more
      await sleep(2000)
      performHealthCheck()
    }
    if (!isReady) {
      sendToIsolated('EXTRACTION_ERROR', {
        error: 'Gmail not ready. Please reload the Gmail tab and try again.',
      })
      return
    }
    console.log('[Sweepy:Main] On-demand health check succeeded, proceeding with scan')
  }

  // Abort any running scan
  scanAbortController?.abort()
  scanAbortController = new AbortController()
  const signal = scanAbortController.signal

  try {
    // Get visible email thread IDs
    const visibleEmailIds = getVisibleEmailIds()
    console.log('[Sweepy:Main] Found', visibleEmailIds.length, 'visible emails')
    if (visibleEmailIds.length === 0) {
      sendToIsolated('EXTRACTION_RESULT', { emails: [] })
      return
    }

    // Apply maxEmails limit
    const maxEmails = options?.maxEmails ?? 1000
    const emailIds = visibleEmailIds.slice(0, maxEmails)
    const totalBatches = Math.ceil(emailIds.length / BATCH_SIZE)
    const maxDays = options?.maxDays ?? 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - maxDays)

    // Accumulate all extracted emails across batches
    const allEmails: MinimalEmailData[] = []
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

      for (const emailId of batchIds) {
        if (signal.aborted) return

        try {
          const emailData = extractSingleEmail(emailId, cutoffDate)
          if (emailData) {
            allEmails.push(emailData)
          }
        } catch (error) {
          console.warn(
            `[Sweepy:Main] Failed to extract email ${emailId}:`,
            error
          )
        }

        processed++
      }

      // Report progress after each batch
      sendToIsolated('EXTRACTION_PROGRESS', {
        processed,
        total: emailIds.length,
      })

      // Yield to the main thread between batches to avoid jank
      if (batchIdx < totalBatches - 1) {
        await sleep(100)
      }
    }

    // Send all extracted emails as a single result
    sendToIsolated('EXTRACTION_RESULT', { emails: allEmails })
    console.log(`[Sweepy:Main] Extraction complete: ${allEmails.length} emails`)
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// Invalidate any previous message listener from a prior script execution
// so old closures (with stale gmail/isReady) don't process messages.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__sweepyMsgVersion = ((window as any).__sweepyMsgVersion || 0) + 1
_msgVersion = (window as any).__sweepyMsgVersion

// When the extension is reloaded/updated while Gmail is open, programmatic
// injection re-runs this script. gmail.js modifies XMLHttpRequest.prototype,
// so we must restore the originals before re-creating the gmail instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((window as any).__sweepyMainWorldLoaded) {
  console.log('[Sweepy:Main] Re-initializing (extension was updated)')
  // Restore original XHR methods so gmail.js doesn't double-wrap them
  if ((window as any).__sweepyOrigXhrOpen) {
    XMLHttpRequest.prototype.open = (window as any).__sweepyOrigXhrOpen
  }
  if ((window as any).__sweepyOrigXhrSend) {
    XMLHttpRequest.prototype.send = (window as any).__sweepyOrigXhrSend
  }
  // Reset state
  gmail = null
  isReady = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(scanAbortController as any)?.abort()
  scanAbortController = null
}

// Save original XHR methods before gmail.js wraps them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__sweepyOrigXhrOpen = (window as any).__sweepyOrigXhrOpen || XMLHttpRequest.prototype.open
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__sweepyOrigXhrSend = (window as any).__sweepyOrigXhrSend || XMLHttpRequest.prototype.send
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__sweepyMainWorldLoaded = true

initGmailJs()
console.log('[Sweepy:Main] Main world script loaded')
