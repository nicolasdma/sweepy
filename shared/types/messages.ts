import type { MinimalEmailData } from './email'
import type { ClassifiedEmail, EmailCategory } from './categories'

// ── Message sources ──────────────────────────────────────────────
export type MessageSource = 'main' | 'isolated' | 'worker' | 'sidepanel' | 'popup'

// ── Base envelope ────────────────────────────────────────────────
export interface BaseMessage {
  id: string              // crypto.randomUUID() — correlation ID
  version: string         // Extension version for desync detection
  source: MessageSource
  timestamp: number
}

// ── Side Panel / Popup → Service Worker ──────────────────────────
export type SidePanelMessage = BaseMessage & (
  | { type: 'REQUEST_SCAN'; payload: { maxEmails: number; maxDays: number } }
  | { type: 'CANCEL_SCAN' }
  | { type: 'GET_SCAN_STATUS' }
  | { type: 'APPROVE_ACTIONS'; payload: { actionIds: string[] } }
  | { type: 'REJECT_ACTION'; payload: { actionId: string; userCategory?: EmailCategory; feedback?: string } }
)

// ── Service Worker → Content Script (via chrome.tabs.sendMessage) ─
export type WorkerToContentMessage = BaseMessage & (
  | { type: 'START_EMAIL_EXTRACTION'; payload: { maxEmails: number; maxDays: number }; target?: 'main' }
  | { type: 'PING' }
  | { type: 'STOP_SCAN'; target?: 'main' }
  | { type: 'AUTH_TOKEN_UPDATED'; payload: { token: string }; target?: 'main' }
  | { type: 'CONFIG_UPDATED'; payload: Record<string, unknown>; target?: 'main' }
)

// ── Content Script (MAIN world via isolated bridge) → Service Worker ─
export type ContentToWorkerMessage = BaseMessage & (
  | { type: 'EXTRACTION_RESULT'; payload: { emails: MinimalEmailData[] } }
  | { type: 'EXTRACTION_ERROR'; payload: { error: string } }
  | { type: 'EXTRACTION_PROGRESS'; payload: { processed: number; total: number } }
  | { type: 'GMAIL_READY'; payload: { userEmail: string } }
  | { type: 'GMAIL_HEALTH_CHECK_FAILED'; payload: { reason: string } }
  | { type: 'PONG' }
)

// ── Service Worker → Side Panel (via chrome.runtime messaging) ───
export type WorkerToSidePanelMessage = BaseMessage & (
  | { type: 'SCAN_PROGRESS'; payload: { processed: number; total: number; phase: 'extracting' | 'analyzing' } }
  | { type: 'SCAN_COMPLETE'; payload: { scanId: string; results: ClassifiedEmail[]; stats: ScanStats } }
  | { type: 'SCAN_ERROR'; payload: { error: string } }
  | { type: 'SCAN_STATUS'; payload: { status: ScanStatus; progress?: { processed: number; total: number } } }
  | { type: 'ACTION_RESULT'; payload: { actionId: string; result: 'success' | 'error'; error?: string } }
  | { type: 'VERSION_MISMATCH'; payload: { required: string; current: string } }
)

// ── Scan stats for display ───────────────────────────────────────
export interface ScanStats {
  total: number
  resolvedByHeuristic: number
  resolvedByCache: number
  resolvedByLlm: number
}

// ── Scan status ──────────────────────────────────────────────────
export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error'

// ── Scan state (persisted to chrome.storage.session) ─────────────
export interface ScanState {
  status: ScanStatus
  scanId: string | null
  progress: { processed: number; total: number } | null
  results: ClassifiedEmail[] | null
  error: string | null
  startedAt: number | null
}

export const INITIAL_SCAN_STATE: ScanState = {
  status: 'idle',
  scanId: null,
  progress: null,
  results: null,
  error: null,
  startedAt: null,
}

// ── Union of every message the extension can produce ─────────────
export type ExtensionMessage =
  | SidePanelMessage
  | WorkerToContentMessage
  | ContentToWorkerMessage
  | WorkerToSidePanelMessage

// ── Helper to extract a specific message by type ─────────────────
export type MessageOfType<T extends ExtensionMessage['type']> =
  Extract<ExtensionMessage, { type: T }>

// ── Type guard ───────────────────────────────────────────────────
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'version' in value &&
    'source' in value &&
    'timestamp' in value
  )
}
