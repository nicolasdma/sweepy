import { MessageBus } from '@/lib/message-bus'
import { apiClient, ApiRequestError } from '@/lib/api-client'
import { authManager } from '@/lib/auth'
import type {
  ScanState,
  SidePanelMessage,
  ContentToWorkerMessage,
  ScanStats,
} from '@shared/types/messages'
import { INITIAL_SCAN_STATE } from '@shared/types/messages'
import type { ClassifiedEmail } from '@shared/types/categories'
import type { MinimalEmailData } from '@shared/types/email'
import type { AnalyzeResponse } from '@shared/types/api'

// ── Message bus instance ─────────────────────────────────────────
const messageBus = new MessageBus('worker')

// ── In-memory scan state ─────────────────────────────────────────
let scanState: ScanState = { ...INITIAL_SCAN_STATE }

// ── Persist scan state to chrome.storage.session ─────────────────
async function persistScanState(): Promise<void> {
  try {
    await chrome.storage.session.set({ scanState })
  } catch (error) {
    console.error('[Sweepy:Worker] Failed to persist scan state:', error)
  }
}

// ── Restore scan state from chrome.storage.session on wake-up ────
async function restoreScanState(): Promise<void> {
  try {
    const stored = await chrome.storage.session.get('scanState')
    if (stored.scanState) {
      scanState = stored.scanState as ScanState
      console.log('[Sweepy:Worker] Restored scan state:', scanState.status)

      // If the worker died mid-scan, mark it as errored
      if (scanState.status === 'scanning') {
        scanState.status = 'error'
        scanState.error = 'Service worker restarted during scan'
        await persistScanState()
        console.warn('[Sweepy:Worker] Scan was in progress when worker died — marked as error')
      }
    }
  } catch (error) {
    console.error('[Sweepy:Worker] Failed to restore scan state:', error)
  }
}

// ── Find the active Gmail tab ────────────────────────────────────
async function findGmailTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({
    url: 'https://mail.google.com/*',
    active: true,
    currentWindow: true,
  })
  // Fall back to any Gmail tab if the active one isn't Gmail
  if (tabs.length === 0) {
    const allGmailTabs = await chrome.tabs.query({
      url: 'https://mail.google.com/*',
    })
    return allGmailTabs[0]?.id ?? null
  }
  return tabs[0]?.id ?? null
}

// ── Broadcast scan state to side panel ───────────────────────────
async function broadcastScanStatus(): Promise<void> {
  await messageBus.broadcast({
    type: 'SCAN_STATUS',
    payload: {
      status: scanState.status,
      progress: scanState.progress ?? undefined,
    },
  })
}

// ── Keep-alive for long operations ───────────────────────────────
let keepAliveInterval: ReturnType<typeof setInterval> | null = null

function startKeepAlive(): void {
  if (keepAliveInterval) return
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {})
  }, 20_000)
}

function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

// ── API batch size (matches backend limit of 50 emails per request) ─
const API_BATCH_SIZE = 50

// ── Send emails to backend API for classification ────────────────
async function analyzeEmails(emails: MinimalEmailData[]): Promise<{
  classified: ClassifiedEmail[]
  stats: ScanStats
}> {
  if (emails.length === 0) {
    return {
      classified: [],
      stats: { total: 0, resolvedByHeuristic: 0, resolvedByCache: 0, resolvedByLlm: 0 },
    }
  }

  // Build a lookup map for email metadata (needed to merge with categorization results)
  const emailMap = new Map<string, MinimalEmailData>()
  for (const email of emails) {
    emailMap.set(email.id, email)
  }

  const allClassified: ClassifiedEmail[] = []
  const aggregateStats: ScanStats = {
    total: 0,
    resolvedByHeuristic: 0,
    resolvedByCache: 0,
    resolvedByLlm: 0,
  }

  // Send to API in batches of API_BATCH_SIZE
  const totalBatches = Math.ceil(emails.length / API_BATCH_SIZE)

  for (let i = 0; i < totalBatches; i++) {
    const batch = emails.slice(i * API_BATCH_SIZE, (i + 1) * API_BATCH_SIZE)

    // Broadcast analyzing progress
    await messageBus.broadcast({
      type: 'SCAN_PROGRESS',
      payload: {
        processed: i * API_BATCH_SIZE,
        total: emails.length,
        phase: 'analyzing' as const,
      },
    })

    const response: AnalyzeResponse = await apiClient.analyzeEmails({
      emails: batch,
    })

    // Merge categorization results with email metadata
    for (const result of response.results) {
      const email = emailMap.get(result.emailId)
      if (!email) continue

      allClassified.push({
        emailId: result.emailId,
        threadId: email.threadId,
        sender: email.from,
        subject: email.subject,
        snippet: email.snippet,
        date: email.date,
        isRead: email.isRead,
        category: result.category,
        confidence: result.confidence,
        categorizedBy: result.source,
        reasoning: result.reasoning,
        suggestedActions: result.suggestedActions,
      })
    }

    // Aggregate stats
    aggregateStats.total += response.stats.total
    aggregateStats.resolvedByHeuristic += response.stats.resolvedByHeuristic
    aggregateStats.resolvedByCache += response.stats.resolvedByCache
    aggregateStats.resolvedByLlm += response.stats.resolvedByLlm
  }

  return { classified: allClassified, stats: aggregateStats }
}

// ── Message handlers ─────────────────────────────────────────────

// Side panel requests a scan
messageBus.on('REQUEST_SCAN', async (message, _sender) => {
  const msg = message as Extract<SidePanelMessage, { type: 'REQUEST_SCAN' }>

  if (scanState.status === 'scanning') {
    return { error: 'A scan is already in progress' }
  }

  const gmailTabId = await findGmailTab()
  if (gmailTabId === null) {
    await messageBus.broadcast({
      type: 'SCAN_ERROR',
      payload: { error: 'No Gmail tab found. Please open Gmail and try again.' },
    })
    return { error: 'No Gmail tab found' }
  }

  // Update state
  scanState = {
    status: 'scanning',
    scanId: crypto.randomUUID(),
    progress: { processed: 0, total: 0 },
    results: null,
    error: null,
    startedAt: Date.now(),
  }
  await persistScanState()
  startKeepAlive()

  // Notify side panel that scan has started
  await broadcastScanStatus()

  // Forward extraction request to the content script on the Gmail tab
  try {
    await messageBus.sendToTab(gmailTabId, {
      type: 'START_EMAIL_EXTRACTION',
      payload: {
        maxEmails: msg.payload.maxEmails,
        maxDays: msg.payload.maxDays,
      },
      target: 'main',
    }, 10_000)
  } catch {
    // Content script not loaded — try injecting and retrying once
    console.warn('[Sweepy:Worker] Content script not responding, injecting...')
    try {
      await injectContentScriptsIntoGmailTabs()
      // Wait for gmail.js to initialize
      await new Promise((r) => setTimeout(r, 3000))

      await messageBus.sendToTab(gmailTabId, {
        type: 'START_EMAIL_EXTRACTION',
        payload: {
          maxEmails: msg.payload.maxEmails,
          maxDays: msg.payload.maxDays,
        },
        target: 'main',
      }, 10_000)
    } catch (retryError) {
      scanState.status = 'error'
      scanState.error = 'Gmail content script not ready. Please reload the Gmail tab and try again.'
      await persistScanState()
      stopKeepAlive()

      await messageBus.broadcast({
        type: 'SCAN_ERROR',
        payload: { error: scanState.error },
      })
      return { error: scanState.error }
    }
  }

  return { started: true, scanId: scanState.scanId }
})

// Side panel requests scan cancellation
messageBus.on('CANCEL_SCAN', async (_message, _sender) => {
  if (scanState.status !== 'scanning') {
    return { error: 'No scan in progress' }
  }

  const gmailTabId = await findGmailTab()
  if (gmailTabId !== null) {
    try {
      await messageBus.sendToTab(gmailTabId, {
        type: 'STOP_SCAN',
        target: 'main',
      })
    } catch {
      // Best effort — tab may have been closed
    }
  }

  scanState.status = 'idle'
  scanState.error = null
  scanState.progress = null
  await persistScanState()
  stopKeepAlive()

  await broadcastScanStatus()
  return { cancelled: true }
})

// Side panel asks for current scan status
messageBus.on('GET_SCAN_STATUS', async () => {
  return {
    status: scanState.status,
    progress: scanState.progress,
    scanId: scanState.scanId,
    results: scanState.results,
    error: scanState.error,
  }
})

// Content script reports extraction progress
messageBus.on('EXTRACTION_PROGRESS', async (message) => {
  const msg = message as Extract<ContentToWorkerMessage, { type: 'EXTRACTION_PROGRESS' }>

  if (scanState.status !== 'scanning') return

  scanState.progress = {
    processed: msg.payload.processed,
    total: msg.payload.total,
  }
  await persistScanState()

  // Forward progress to side panel
  await messageBus.broadcast({
    type: 'SCAN_PROGRESS',
    payload: {
      processed: msg.payload.processed,
      total: msg.payload.total,
      phase: 'extracting' as const,
    },
  })
})

// Content script finished extraction — now send to API for classification
messageBus.on('EXTRACTION_RESULT', async (message) => {
  const msg = message as Extract<ContentToWorkerMessage, { type: 'EXTRACTION_RESULT' }>

  if (scanState.status !== 'scanning') return

  const emails = msg.payload.emails
  console.log(`[Sweepy:Worker] Extraction complete: ${emails.length} emails. Starting analysis...`)

  // Check if user is authenticated before calling API
  const isAuth = await authManager.init()
  if (!isAuth) {
    // No auth — still complete the scan but with empty results
    // The side panel will show a message about needing to log in
    scanState.status = 'error'
    scanState.error = 'Please log in to analyze emails. Open the Sweepy popup to sign in.'
    await persistScanState()
    stopKeepAlive()

    await messageBus.broadcast({
      type: 'SCAN_ERROR',
      payload: { error: scanState.error },
    })
    return
  }

  try {
    const { classified, stats } = await analyzeEmails(emails)

    scanState.status = 'complete'
    scanState.results = classified
    await persistScanState()
    stopKeepAlive()

    await messageBus.broadcast({
      type: 'SCAN_COMPLETE',
      payload: {
        scanId: scanState.scanId!,
        results: classified,
        stats,
      },
    })

    console.log(`[Sweepy:Worker] Analysis complete: ${classified.length} emails classified`)
  } catch (error) {
    console.error('[Sweepy:Worker] API analysis failed:', error)

    let errorMsg = 'Failed to analyze emails'
    if (error instanceof ApiRequestError) {
      if (error.status === 401) {
        errorMsg = 'Session expired. Please log in again from the Sweepy popup.'
      } else if (error.status === 429) {
        errorMsg = 'Rate limit exceeded. Please wait a few minutes and try again.'
      } else {
        errorMsg = `Analysis failed: ${error.apiError.error}`
      }
    } else if (error instanceof Error) {
      errorMsg = error.message
    }

    scanState.status = 'error'
    scanState.error = errorMsg
    await persistScanState()
    stopKeepAlive()

    await messageBus.broadcast({
      type: 'SCAN_ERROR',
      payload: { error: errorMsg },
    })
  }
})

// Content script reports extraction error
messageBus.on('EXTRACTION_ERROR', async (message) => {
  const msg = message as Extract<ContentToWorkerMessage, { type: 'EXTRACTION_ERROR' }>

  scanState.status = 'error'
  scanState.error = msg.payload.error
  await persistScanState()
  stopKeepAlive()

  await messageBus.broadcast({
    type: 'SCAN_ERROR',
    payload: { error: msg.payload.error },
  })
})

// Gmail content script is ready
messageBus.on('GMAIL_READY', async (message, sender) => {
  const msg = message as Extract<ContentToWorkerMessage, { type: 'GMAIL_READY' }>
  console.log(
    `[Sweepy:Worker] Gmail content script ready on tab ${sender?.tab?.id} for ${msg.payload.userEmail}`,
  )
})

// Gmail health check failed
messageBus.on('GMAIL_HEALTH_CHECK_FAILED', async (message) => {
  const msg = message as Extract<ContentToWorkerMessage, { type: 'GMAIL_HEALTH_CHECK_FAILED' }>
  console.warn('[Sweepy:Worker] Gmail health check failed:', msg.payload.reason)
})

// Respond to PONG (from content script ping response)
messageBus.on('PONG', async () => {
  return { alive: true }
})

// ── Inject content scripts into existing Gmail tabs ──────────────
async function injectContentScriptsIntoGmailTabs(): Promise<void> {
  const gmailTabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' })
  const manifest = chrome.runtime.getManifest()

  for (const tab of gmailTabs) {
    if (!tab.id) continue
    try {
      // Inject each content script defined in the manifest
      for (const cs of manifest.content_scripts ?? []) {
        const world = ((cs as Record<string, unknown>).world as 'MAIN' | 'ISOLATED') ?? 'ISOLATED'
        for (const jsFile of cs.js ?? []) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [jsFile],
            world,
          })
        }
      }
      console.log(`[Sweepy] Injected content scripts into tab ${tab.id}`)
    } catch (error) {
      // Tab might not be ready or permission denied — that's OK
      console.warn(`[Sweepy] Could not inject into tab ${tab.id}:`, error)
    }
  }
}

// ── Chrome event listeners ───────────────────────────────────────

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Capture auth token from extension-callback page URL hash
chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  if (!tab.url) return
  if (!tab.url.includes('/extension-callback#')) return

  try {
    const url = new URL(tab.url)
    const hash = url.hash.slice(1) // Remove leading #
    const params = new URLSearchParams(hash)
    const token = params.get('token')
    const expiresIn = parseInt(params.get('expiresIn') ?? '86400', 10)

    if (token) {
      authManager.setToken(token, expiresIn).then(async () => {
        console.log('[Sweepy] Auth token received from web app')
        // Close the callback tab
        chrome.tabs.remove(tabId).catch(() => {})

        // Open side panel on Gmail tab automatically
        const gmailTabId = await findGmailTab()
        if (gmailTabId) {
          // Focus the Gmail tab first
          chrome.tabs.update(gmailTabId, { active: true }).catch(() => {})
          chrome.sidePanel.open({ tabId: gmailTabId }).catch(() => {})
        }
      })
    }
  } catch (error) {
    console.error('[Sweepy] Failed to parse auth callback URL:', error)
  }
})

// Route all incoming messages through the bus
messageBus.listen()

// Handle extension install/update — inject content scripts into existing tabs
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Sweepy] Extension installed')
  } else if (details.reason === 'update') {
    console.log(
      `[Sweepy] Extension updated to ${chrome.runtime.getManifest().version}`,
    )
  }

  // Inject content scripts into Gmail tabs that were open before install/update
  injectContentScriptsIntoGmailTabs()
})

// ── Initialization ───────────────────────────────────────────────
restoreScanState().then(() => {
  authManager.init().then((isAuth) => {
    console.log(`[Sweepy] Service worker started (authenticated: ${isAuth})`)
  })
})
