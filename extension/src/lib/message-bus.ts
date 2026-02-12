type MessageSource =
  | 'main'
  | 'isolated'
  | 'worker'
  | 'sidepanel'
  | 'popup'

interface Message {
  id: string
  type: string
  payload?: unknown
  version: string
  source: MessageSource
  timestamp: number
  target?: MessageSource
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const MESSAGE_TIMEOUT_MS = 5_000
const MAX_RETRIES = 1

export class MessageBus {
  private source: MessageSource
  private pending = new Map<string, PendingRequest>()
  private handlers = new Map<
    string,
    (
      payload: unknown,
      sender?: chrome.runtime.MessageSender
    ) => Promise<unknown>
  >()

  constructor(source: MessageSource) {
    this.source = source
  }

  on(
    type: string,
    handler: (
      payload: unknown,
      sender?: chrome.runtime.MessageSender
    ) => Promise<unknown>
  ) {
    this.handlers.set(type, handler)
  }

  async send(
    type: string,
    payload?: unknown,
    target?: MessageSource
  ): Promise<unknown> {
    const message: Message = {
      id: crypto.randomUUID(),
      type,
      payload,
      version:
        typeof chrome !== 'undefined'
          ? (chrome.runtime?.getManifest?.()?.version ?? '0.0.0')
          : '0.0.0',
      source: this.source,
      timestamp: Date.now(),
      target,
    }

    return this.sendWithRetry(message, 0)
  }

  private sendWithRetry(message: Message, attempt: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(message.id)
        if (attempt < MAX_RETRIES) {
          this.sendWithRetry(message, attempt + 1)
            .then(resolve)
            .catch(reject)
        } else {
          reject(
            new Error(
              `Message ${message.type} timed out after ${MAX_RETRIES + 1} attempts`
            )
          )
        }
      }, MESSAGE_TIMEOUT_MS)

      this.pending.set(message.id, { resolve, reject, timeout })

      chrome.runtime.sendMessage(message).catch((error) => {
        clearTimeout(timeout)
        this.pending.delete(message.id)
        reject(error)
      })
    })
  }

  async handleIncoming(
    message: Message,
    sender?: chrome.runtime.MessageSender
  ): Promise<unknown> {
    // Check if this is a response to a pending request
    if (this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!
      clearTimeout(pending.timeout)
      this.pending.delete(message.id)
      pending.resolve(message.payload)
      return { ack: true }
    }

    // Handle as new message
    const handler = this.handlers.get(message.type)
    if (handler) {
      try {
        const result = await handler(message.payload, sender)
        return { id: message.id, result }
      } catch (error) {
        return {
          id: message.id,
          error:
            error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    return { error: `No handler for message type: ${message.type}` }
  }

  destroy() {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('MessageBus destroyed'))
    }
    this.pending.clear()
    this.handlers.clear()
  }
}
