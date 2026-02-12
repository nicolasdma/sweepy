interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp ms
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes before expiry
const REFRESH_LOCK_KEY = 'sweepy:refresh_lock'
const TOKEN_KEY = 'sweepy:token'

export class AuthManager {
  private tokenData: TokenData | null = null

  async init(): Promise<boolean> {
    try {
      const session = await chrome.storage.session.get(TOKEN_KEY)
      const local = await chrome.storage.local.get(TOKEN_KEY)

      if (session[TOKEN_KEY]?.accessToken) {
        this.tokenData = session[TOKEN_KEY]
        return true
      }

      if (local[TOKEN_KEY]?.refreshToken) {
        return this.refresh(local[TOKEN_KEY].refreshToken)
      }

      return false
    } catch {
      return false
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.tokenData) return null

    if (Date.now() > this.tokenData.expiresAt - REFRESH_BUFFER_MS) {
      const refreshed = await this.refresh(this.tokenData.refreshToken)
      if (!refreshed) return null
    }

    return this.tokenData.accessToken
  }

  async setTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ) {
    this.tokenData = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    }

    await chrome.storage.session.set({ [TOKEN_KEY]: this.tokenData })
    await chrome.storage.local.set({
      [TOKEN_KEY]: { refreshToken },
    })
  }

  private async refresh(refreshToken: string): Promise<boolean> {
    // Mutex: prevent multi-tab race condition
    const lock = await chrome.storage.session.get(REFRESH_LOCK_KEY)
    if (
      lock[REFRESH_LOCK_KEY] &&
      Date.now() - lock[REFRESH_LOCK_KEY] < 10_000
    ) {
      // Another tab is refreshing — wait and retry
      await new Promise((r) => setTimeout(r, 2000))
      const session = await chrome.storage.session.get(TOKEN_KEY)
      if (session[TOKEN_KEY]?.accessToken) {
        this.tokenData = session[TOKEN_KEY]
        return true
      }
      return false
    }

    await chrome.storage.session.set({ [REFRESH_LOCK_KEY]: Date.now() })

    try {
      // TODO: Call backend /api/v1/auth/refresh endpoint
      void refreshToken
      return false
    } catch {
      return false
    } finally {
      await chrome.storage.session.remove(REFRESH_LOCK_KEY)
    }
  }

  async logout() {
    this.tokenData = null
    await chrome.storage.session.remove(TOKEN_KEY)
    await chrome.storage.local.remove(TOKEN_KEY)
  }

  isAuthenticated(): boolean {
    return this.tokenData !== null && Date.now() < this.tokenData.expiresAt
  }
}

export const authManager = new AuthManager()
