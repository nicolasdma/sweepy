/**
 * ISOLATED world content script.
 * Bridge between MAIN world (gmail.js) and Service Worker.
 * Cannot access page JS context but can use chrome.runtime APIs.
 *
 * Responsibilities:
 * 1. Inject the MAIN world script into the page
 * 2. Forward messages from MAIN world -> Service Worker
 * 3. Forward messages from Service Worker -> MAIN world
 * 4. Validate message origins
 */

// After extension reload/update, old content scripts lose their chrome.runtime
// context. Detect this early so we can bail out silently instead of throwing.
function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id
  } catch {
    return false
  }
}

if (!isContextValid()) {
  // Old content script from a previous extension version — nothing to do.
  // The page needs a reload to get fresh content scripts.
  console.warn('[Sweepy:Isolated] Extension context invalidated (extension was reloaded). Reload Gmail to reconnect.')
} else {

const EXTENSION_VERSION = chrome.runtime.getManifest().version

// Track whether main world script has reported ready
let mainWorldReady = false

// ---------------------------------------------------------------------------
// Message forwarding: MAIN world -> Service Worker
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent) => {
  // Origin validation: only accept messages from the same window
  if (event.source !== window) return
  // Source validation: only accept messages from our main world script
  if (event.data?.source !== 'sweepy-main') return

  // Re-check context validity (extension may have reloaded while page stayed open)
  if (!isContextValid()) return

  const message = event.data

  // Track readiness
  if (message.type === 'GMAIL_READY') {
    mainWorldReady = true
    console.log('[Sweepy:Isolated] Main world script is ready')
  }

  if (message.type === 'GMAIL_HEALTH_CHECK_FAILED') {
    console.warn('[Sweepy:Isolated] Main world health check failed:', message.payload?.reason)
  }

  // Forward to service worker with isolated metadata
  console.log('[Sweepy:Isolated] Forwarding to worker:', message.type)
  chrome.runtime
    .sendMessage({
      ...message,
      source: 'isolated',
      version: EXTENSION_VERSION,
    })
    .catch((error: Error) => {
      if (!isContextValid()) return // Silently ignore if context was invalidated
      console.error('[Sweepy:Isolated] Failed to forward message to worker:', error)
    })
})

// ---------------------------------------------------------------------------
// Message forwarding: Service Worker -> MAIN world
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: Record<string, unknown>,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Only forward messages targeted at the main world
    if (message.target === 'main') {
      const msgId = message.id as string | undefined
      console.log('[Sweepy:Isolated] Forwarding to main world:', message.type)

      if (!mainWorldReady) {
        console.warn(
          '[Sweepy:Isolated] Main world not confirmed ready yet — forwarding anyway:',
          message.type
        )
      }

      window.postMessage(
        {
          ...message,
          source: 'sweepy-isolated',
        },
        '*'
      )
      sendResponse({ id: msgId, result: { received: true } })
    }

    return false
  }
)

// MAIN world script is injected automatically by Chrome via manifest content_scripts.
// No manual injection needed.

console.log(`[Sweepy:Isolated] Content script loaded (v${EXTENSION_VERSION})`)

} // end isContextValid() else block
