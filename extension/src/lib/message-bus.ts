import type {
  BaseMessage,
  MessageSource,
  ExtensionMessage,
  WorkerToContentMessage,
} from '@shared/types/messages'
import { isExtensionMessage } from '@shared/types/messages'

// Distributive Omit — preserves union discrimination
type DistributiveOmit<T, K extends string | number | symbol> =
  T extends unknown ? Omit<T, K> : never

/** Payload type for any extension message (minus the base envelope) */
type MessageData = DistributiveOmit<ExtensionMessage, keyof BaseMessage>

/** Payload type for worker-to-content messages (minus the base envelope) */
type ContentMessageData = DistributiveOmit<WorkerToContentMessage, keyof BaseMessage>

// ── Constants ────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 5_000
const MAX_RETRIES = 1
const PING_TIMEOUT_MS = 2_000

// ── Response envelope from handleIncoming ────────────────────────
interface MessageResponse<T = unknown> {
  id: string
  result?: T
  error?: string
  ack?: boolean
}

// ── Pending request tracker ──────────────────────────────────────
interface PendingRequest<T = unknown> {
  resolve: (value: T) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
  messageType: string
}

// ── Handler signature ────────────────────────────────────────────
type MessageHandler<T extends ExtensionMessage = ExtensionMessage> = (
  message: T,
  sender?: chrome.runtime.MessageSender,
) => Promise<unknown> | unknown

// ── Utility: get extension version safely ────────────────────────
function getExtensionVersion(): string {
  try {
    return chrome.runtime?.getManifest?.()?.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

// ── Factory: create a typed message with auto-generated envelope ─
export function createMessage<
  T extends MessageData,
>(
  source: MessageSource,
  data: T,
): T & BaseMessage {
  return {
    ...data,
    id: crypto.randomUUID(),
    version: getExtensionVersion(),
    source,
    timestamp: Date.now(),
  } as T & BaseMessage
}

// ── MessageBus class ─────────────────────────────────────────────
export class MessageBus {
  private source: MessageSource
  private pending = new Map<string, PendingRequest>()
  private handlers = new Map<string, MessageHandler>()
  private listenerAttached = false

  constructor(source: MessageSource) {
    this.source = source
  }

  // ── Register a handler for a specific message type ───────────
  on<T extends ExtensionMessage['type']>(
    type: T,
    handler: MessageHandler<Extract<ExtensionMessage, { type: T }>>,
  ): void {
    this.handlers.set(type, handler as MessageHandler)
  }

  // ── Remove a handler ─────────────────────────────────────────
  off(type: ExtensionMessage['type']): void {
    this.handlers.delete(type)
  }

  // ── Send a message to the service worker (from sidepanel/content) ─
  async sendToWorker<R = unknown>(
    data: MessageData,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<R> {
    const message = createMessage(this.source, data) as unknown as ExtensionMessage
    return this.sendWithRetry<R>(
      message,
      () => chrome.runtime.sendMessage(message),
      timeoutMs,
      0,
    )
  }

  // ── Send a message to a specific tab's content script ────────
  async sendToTab<R = unknown>(
    tabId: number,
    data: ContentMessageData,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<R> {
    const message = createMessage(this.source, data) as unknown as ExtensionMessage

    // Ping the content script first to detect if tab is alive
    const alive = await this.pingTab(tabId)
    if (!alive) {
      throw new Error(
        `Tab ${tabId} did not respond to ping — content script may not be loaded`,
      )
    }

    return this.sendWithRetry<R>(
      message,
      () => chrome.tabs.sendMessage(tabId, message),
      timeoutMs,
      0,
    )
  }

  // ── Broadcast to all connected contexts via runtime ──────────
  async broadcast(
    data: MessageData,
  ): Promise<void> {
    const message = createMessage(this.source, data)
    try {
      await chrome.runtime.sendMessage(message)
    } catch {
      // No listeners — that's OK for broadcasts
    }
  }

  // ── Handle an incoming message (called from onMessage listener) ─
  async handleIncoming(
    raw: unknown,
    sender?: chrome.runtime.MessageSender,
  ): Promise<MessageResponse> {
    // Validate it's one of ours
    if (!isExtensionMessage(raw)) {
      return { id: '', error: 'Not a valid Sweepy message' }
    }

    const message = raw as ExtensionMessage

    // Version mismatch detection
    const currentVersion = getExtensionVersion()
    if (message.version !== currentVersion && message.version !== '0.0.0') {
      console.warn(
        `[Sweepy:MessageBus] Version mismatch: message=${message.version} local=${currentVersion}`,
      )
    }

    // Check if this is a response to a pending request
    const pending = this.pending.get(message.id)
    if (pending) {
      clearTimeout(pending.timeout)
      this.pending.delete(message.id)
      pending.resolve(message)
      return { id: message.id, ack: true }
    }

    // Handle as a new incoming message
    const handler = this.handlers.get(message.type)
    if (handler) {
      try {
        const result = await handler(message, sender)
        return { id: message.id, result }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown handler error'
        console.error(
          `[Sweepy:MessageBus] Handler error for ${message.type}:`,
          error,
        )
        return { id: message.id, error: errorMessage }
      }
    }

    return { id: message.id, error: `No handler for message type: ${message.type}` }
  }

  // ── Attach chrome.runtime.onMessage listener (convenience) ───
  listen(): void {
    if (this.listenerAttached) return
    this.listenerAttached = true

    chrome.runtime.onMessage.addListener(
      (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
        this.handleIncoming(message, sender).then(sendResponse)
        return true // Keep channel open for async response
      },
    )
  }

  // ── Tear down ────────────────────────────────────────────────
  destroy(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('MessageBus destroyed'))
    }
    this.pending.clear()
    this.handlers.clear()
  }

  // ── Internal: send with retry logic ──────────────────────────
  private sendWithRetry<R>(
    message: ExtensionMessage,
    sendFn: () => Promise<MessageResponse>,
    timeoutMs: number,
    attempt: number,
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(message.id)
        if (attempt < MAX_RETRIES) {
          console.warn(
            `[Sweepy:MessageBus] Timeout on ${message.type} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`,
          )
          this.sendWithRetry<R>(message, sendFn, timeoutMs, attempt + 1)
            .then(resolve)
            .catch(reject)
        } else {
          reject(
            new Error(
              `Message "${message.type}" timed out after ${MAX_RETRIES + 1} attempt(s) (${timeoutMs}ms each)`,
            ),
          )
        }
      }, timeoutMs)

      this.pending.set(message.id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        messageType: message.type,
      })

      sendFn()
        .then((response) => {
          // If chrome.runtime.sendMessage returns synchronously with a response
          // (e.g. from the service worker's onMessage handler), handle it here
          if (response && typeof response === 'object' && 'id' in response) {
            const resp = response as MessageResponse
            if (resp.error) {
              clearTimeout(timeout)
              this.pending.delete(message.id)
              reject(new Error(resp.error))
            } else if (resp.result !== undefined) {
              clearTimeout(timeout)
              this.pending.delete(message.id)
              resolve(resp.result as R)
            }
            // If response is just { ack: true }, the real response will
            // come via a separate message — let the pending timeout handle it
          }
        })
        .catch((error: Error) => {
          clearTimeout(timeout)
          this.pending.delete(message.id)
          reject(error)
        })
    })
  }

  // ── Internal: ping a tab to check if content script is alive ─
  private async pingTab(tabId: number): Promise<boolean> {
    const pingMessage = createMessage(this.source, { type: 'PING' as const })
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, pingMessage),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), PING_TIMEOUT_MS),
        ),
      ])
      return response !== null
    } catch {
      return false
    }
  }
}
