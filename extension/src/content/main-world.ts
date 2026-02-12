/**
 * MAIN world script — has access to page JS context.
 * Uses gmail.js to read email data.
 * Communicates with ISOLATED world via window.postMessage.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gmail: any = null
let isReady = false

function sendToIsolated(type: string, payload?: unknown) {
  window.postMessage(
    {
      id: crypto.randomUUID(),
      type,
      payload,
      source: 'inboxpilot-main',
      timestamp: Date.now(),
    },
    '*'
  )
}

// Listen for commands from ISOLATED world
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.source !== 'inboxpilot-isolated') return

  const { type, payload } = event.data

  switch (type) {
    case 'START_SCAN':
      handleStartScan(payload)
      break
    case 'STOP_SCAN':
      // TODO: implement scan cancellation
      break
  }
})

async function initGmailJs() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GmailFactory = (window as any).Gmail
    if (!GmailFactory) {
      console.error('[InboxPilot:Main] Gmail factory not found on window')
      sendToIsolated('HEALTH_CHECK_FAILED', {
        error: 'Gmail factory not available',
      })
      return
    }

    gmail = new GmailFactory()

    gmail.observe.on('load', () => {
      try {
        const userEmail = gmail.get.user_email()
        if (userEmail) {
          isReady = true
          sendToIsolated('READY')
          console.log(`[InboxPilot:Main] Gmail.js ready for ${userEmail}`)
        } else {
          sendToIsolated('HEALTH_CHECK_FAILED', {
            error: 'Could not read user email',
          })
        }
      } catch (error) {
        sendToIsolated('HEALTH_CHECK_FAILED', {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown health check error',
        })
      }
    })
  } catch (error) {
    sendToIsolated('HEALTH_CHECK_FAILED', {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to initialize gmail.js',
    })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStartScan(_options: any) {
  if (!isReady || !gmail) {
    sendToIsolated('EXTRACTION_ERROR', { error: 'Gmail.js not ready' })
    return
  }

  // TODO: Implement email extraction in batches using email-extractor module
  sendToIsolated('SCAN_PROGRESS', { processed: 0, total: 0 })
}

initGmailJs()
