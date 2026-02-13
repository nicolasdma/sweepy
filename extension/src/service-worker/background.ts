import { MessageBus, createMessage } from '@/lib/message-bus'
import type {
  ScanState,
  SidePanelMessage,
  ContentToWorkerMessage,
  ExtensionMessage,
} from '@shared/types/messages'
import { INITIAL_SCAN_STATE } from '@shared/types/messages'

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

// ── Message handlers ─────────────────────────────────────────────

// Side panel requests a scan
messageBus.on('REQUEST_SCAN', async (message, _sender) => {
  const msg = message as Extract<SidePanelMessage, { type: 'REQUEST_SCAN' }>

  if (scanState.status === 'scanning') {
    return { error: 'A scan is already in progress' }
  }

  const gmailTabId = await findGmailTab()
  if (gmailTabId === null) {
    // Notify the side panel about the error
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
    }, 10_000) // 10s timeout for content script to acknowledge
  } catch (error) {
    scanState.status = 'error'
    scanState.error = error instanceof Error ? error.message : 'Failed to reach content script'
    await persistScanState()
    stopKeepAlive()

    await messageBus.broadcast({
      type: 'SCAN_ERROR',
      payload: { error: scanState.error },
    })
    return { error: scanState.error }
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
      phase: 'extracting',
    },
  })
})

// Content script finished extraction
messageBus.on('EXTRACTION_RESULT', async (message) => {
  const msg = message as Extract<ContentToWorkerMessage, { type: 'EXTRACTION_RESULT' }>

  if (scanState.status !== 'scanning') return

  // TODO: In the future, send emails to the API for classification.
  // For now, mark the scan as complete with the raw extraction data.
  scanState.status = 'complete'
  scanState.results = [] // Will be populated when API integration is added
  await persistScanState()
  stopKeepAlive()

  await messageBus.broadcast({
    type: 'SCAN_COMPLETE',
    payload: {
      scanId: scanState.scanId!,
      results: [],
    },
  })

  console.log(`[Sweepy:Worker] Extraction complete: ${msg.payload.emails.length} emails`)
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
messageBus.on('GMAIL_READY', async (_message, sender) => {
  console.log(
    '[Sweepy:Worker] Gmail content script ready on tab:',
    sender?.tab?.id,
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

// ── Chrome event listeners ───────────────────────────────────────

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Route all incoming messages through the bus
messageBus.listen()

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Sweepy] Extension installed')
  } else if (details.reason === 'update') {
    console.log(
      `[Sweepy] Extension updated to ${chrome.runtime.getManifest().version}`,
    )
  }
})

// ── Initialization ───────────────────────────────────────────────
restoreScanState().then(() => {
  console.log('[Sweepy] Service worker started')
})
