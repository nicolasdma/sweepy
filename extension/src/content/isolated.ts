/**
 * ISOLATED world content script.
 * Bridge between MAIN world (gmail.js) and Service Worker.
 * Cannot access page JS context but can use chrome.runtime.
 */

const EXTENSION_VERSION = chrome.runtime.getManifest().version

// Listen for messages from MAIN world (via window.postMessage)
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.source !== 'inboxpilot-main') return

  const message = event.data

  // Forward to service worker with correlation ID preserved
  chrome.runtime
    .sendMessage({
      ...message,
      source: 'isolated',
      version: EXTENSION_VERSION,
    })
    .catch((error) => {
      console.error('[InboxPilot:Isolated] Failed to forward message:', error)
    })
})

// Listen for messages from Service Worker → forward to MAIN world
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target === 'main') {
    window.postMessage(
      {
        ...message,
        source: 'inboxpilot-isolated',
      },
      '*'
    )
    sendResponse({ received: true })
  }
  return false
})

// Inject MAIN world script
function injectMainWorldScript() {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('src/content/main-world.ts')
  script.type = 'module'
  document.documentElement.appendChild(script)
  script.onload = () => script.remove()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectMainWorldScript)
} else {
  injectMainWorldScript()
}

console.log('[InboxPilot:Isolated] Content script loaded')
