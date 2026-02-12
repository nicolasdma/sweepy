import { MessageBus } from '@/lib/message-bus'

const messageBus = new MessageBus('worker')

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageBus.handleIncoming(message, sender).then(sendResponse)
  return true // Keep channel open for async response
})

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Sweepy] Extension installed')
  } else if (details.reason === 'update') {
    console.log(
      `[Sweepy] Extension updated to ${chrome.runtime.getManifest().version}`
    )
  }
})

// Keep service worker alive during critical operations
let keepAliveInterval: ReturnType<typeof setInterval> | null = null

export function startKeepAlive() {
  if (keepAliveInterval) return
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {})
  }, 20_000)
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

console.log('[Sweepy] Service worker started')
