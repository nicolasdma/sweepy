interface TokenData {
  token: string
  expiresAt: number // Unix timestamp ms
}

const TOKEN_KEY = 'sweepy:token'
const APP_URL = 'http://localhost:3000' // TODO: make configurable via remote config

// Supabase config for chrome.identity OAuth flow
const SUPABASE_URL = 'https://gqxukcahhmrrsbmvrygy.supabase.co'

export class AuthManager {
  private tokenData: TokenData | null = null

  async init(): Promise<boolean> {
    try {
      const result = await chrome.storage.session.get(TOKEN_KEY)
      const data = result[TOKEN_KEY] as TokenData | undefined

      if (data?.token && Date.now() < data.expiresAt) {
        this.tokenData = data
        console.log('[Sweepy:Auth] Token loaded from storage (valid)')
        return true
      }

      // Token expired or missing — clear stale data
      if (data) {
        console.log('[Sweepy:Auth] Token expired, clearing')
        await chrome.storage.session.remove(TOKEN_KEY)
      } else {
        console.log('[Sweepy:Auth] No token in storage')
      }

      return false
    } catch (err) {
      console.error('[Sweepy:Auth] init() failed:', err)
      return false
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.tokenData) {
      console.log('[Sweepy:Auth] getToken() — no token data')
      return null
    }

    if (Date.now() >= this.tokenData.expiresAt) {
      console.log('[Sweepy:Auth] getToken() — token expired')
      await this.logout()
      return null
    }

    return this.tokenData.token
  }

  async setToken(token: string, expiresIn: number) {
    this.tokenData = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    }

    await chrome.storage.session.set({ [TOKEN_KEY]: this.tokenData })
    console.log('[Sweepy:Auth] Token stored (expires in', expiresIn, 'seconds)')
  }

  async logout() {
    this.tokenData = null
    await chrome.storage.session.remove(TOKEN_KEY)
    console.log('[Sweepy:Auth] Logged out, token cleared')
  }

  isAuthenticated(): boolean {
    return this.tokenData !== null && Date.now() < this.tokenData.expiresAt
  }

  getLoginUrl(): string {
    return `${APP_URL}/login?from=extension`
  }

  getAppUrl(): string {
    return APP_URL
  }

  /**
   * Login using chrome.identity.launchWebAuthFlow.
   * Opens an OAuth popup within Chrome (no separate tab).
   * The flow:
   *   1. Build Supabase OAuth URL with redirect to chrome.identity callback
   *   2. Chrome shows the OAuth popup
   *   3. After Google sign-in, Supabase redirects to our /auth/callback
   *   4. Our callback generates extension token and redirects to chrome.identity callback URL
   *   5. We parse the token from the redirect URL
   */
  /**
   * Login using chrome.identity.launchWebAuthFlow.
   * Only works when APP_URL is HTTPS (production).
   * On localhost (HTTP), throws so callers can fall back to tab-based login.
   */
  async loginWithIdentity(): Promise<boolean> {
    // launchWebAuthFlow can't load HTTP pages — skip on localhost
    if (APP_URL.startsWith('http://')) {
      console.log('[Sweepy:Auth] Skipping launchWebAuthFlow (HTTP not supported), using tab-based login')
      throw new Error('launchWebAuthFlow requires HTTPS — falling back to tab login')
    }

    console.log('[Sweepy:Auth] Starting chrome.identity.launchWebAuthFlow')

    const callbackUrl = chrome.identity.getRedirectURL('callback')
    console.log('[Sweepy:Auth] Callback URL:', callbackUrl)

    const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`)
    authUrl.searchParams.set('provider', 'google')
    authUrl.searchParams.set(
      'redirect_to',
      `${APP_URL}/auth/callback?from=extension&redirect_uri=${encodeURIComponent(callbackUrl)}`
    )

    console.log('[Sweepy:Auth] Opening OAuth URL:', authUrl.toString())

    try {
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      })

      if (!responseUrl) {
        console.error('[Sweepy:Auth] launchWebAuthFlow returned no URL')
        return false
      }

      console.log('[Sweepy:Auth] Got response URL:', responseUrl)

      const url = new URL(responseUrl)
      const hash = url.hash.slice(1)
      const params = new URLSearchParams(hash)
      const token = params.get('token')
      const expiresIn = parseInt(params.get('expiresIn') ?? '86400', 10)
      const error = params.get('error')

      if (error) {
        console.error('[Sweepy:Auth] OAuth returned error:', error)
        return false
      }

      if (!token) {
        console.error('[Sweepy:Auth] No token in response URL hash')
        return false
      }

      await this.setToken(token, expiresIn)
      console.log('[Sweepy:Auth] loginWithIdentity succeeded')
      return true
    } catch (err) {
      console.error('[Sweepy:Auth] launchWebAuthFlow failed:', err)
      throw err
    }
  }
}

export const authManager = new AuthManager()
