/**
 * Centralized configuration for the Sweepy extension.
 * Single point of change when switching between dev and production.
 */
export const CONFIG = {
  /** Base URL of the Sweepy web app */
  APP_URL: 'http://localhost:3000',

  /** Base URL for API requests */
  API_BASE: 'http://localhost:3000/api/v1',

  /** Supabase project URL */
  SUPABASE_URL: 'https://gqxukcahhmrrsbmvrygy.supabase.co',

  /** Timeout for API requests (ms) */
  API_TIMEOUT_MS: 30_000,

  /** Timeout for email analysis API call (ms) — longer because it involves LLM */
  ANALYZE_TIMEOUT_MS: 120_000,

  /** Storage keys */
  STORAGE_KEYS: {
    TOKEN: 'sweepy:token',
    LAST_SCAN_RESULTS: 'sweepy:lastScanResults',
  },
} as const
