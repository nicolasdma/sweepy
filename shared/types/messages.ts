// Message sources in the extension
export type MessageSource = 'main' | 'isolated' | 'worker' | 'sidepanel' | 'popup'

// Base message structure with correlation ID
export interface BaseMessage {
  id: string // crypto.randomUUID()
  version: string // Extension version
  source: MessageSource
  timestamp: number
}

// Main world → Isolated world messages
export type MainWorldMessage =
  | (BaseMessage & { type: 'READY' })
  | (BaseMessage & { type: 'HEALTH_CHECK_FAILED'; payload: { error: string } })
  | (BaseMessage & { type: 'EMAILS_EXTRACTED'; payload: { emails: import('./email').MinimalEmailData[]; batchIndex: number; totalBatches: number } })
  | (BaseMessage & { type: 'EXTRACTION_ERROR'; payload: { error: string; emailId?: string } })
  | (BaseMessage & { type: 'SCAN_PROGRESS'; payload: { processed: number; total: number } })

// Service Worker → Content Script messages
export type WorkerMessage =
  | (BaseMessage & { type: 'START_SCAN'; payload: import('./email').ScanOptions })
  | (BaseMessage & { type: 'STOP_SCAN' })
  | (BaseMessage & { type: 'AUTH_TOKEN_UPDATED'; payload: { token: string } })
  | (BaseMessage & { type: 'CONFIG_UPDATED'; payload: Record<string, unknown> })

// Side Panel → Service Worker messages
export type SidePanelMessage =
  | (BaseMessage & { type: 'REQUEST_SCAN'; payload: import('./email').ScanOptions })
  | (BaseMessage & { type: 'APPROVE_ACTIONS'; payload: { actionIds: string[] } })
  | (BaseMessage & { type: 'REJECT_ACTION'; payload: { actionId: string; userCategory?: import('./categories').EmailCategory; feedback?: string } })
  | (BaseMessage & { type: 'GET_SCAN_STATUS' })

// Service Worker → Side Panel messages
export type WorkerToSidePanelMessage =
  | (BaseMessage & { type: 'SCAN_RESULTS'; payload: { results: import('./categories').CategorizationResult[]; scanId: string } })
  | (BaseMessage & { type: 'SCAN_STATUS'; payload: { status: 'idle' | 'scanning' | 'error'; progress?: { processed: number; total: number } } })
  | (BaseMessage & { type: 'ACTION_RESULT'; payload: { actionId: string; result: 'success' | 'error'; error?: string } })
  | (BaseMessage & { type: 'VERSION_MISMATCH'; payload: { required: string; current: string } })

export type ExtensionMessage = MainWorldMessage | WorkerMessage | SidePanelMessage | WorkerToSidePanelMessage
