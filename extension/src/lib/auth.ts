interface TokenData {
  token: string
  expiresAt: number // Unix timestamp ms
}

const TOKEN_KEY = 'sweepy:token'
const APP_URL = 'http://localhost:3000' // TODO: make configurable via remote config

export class AuthManager {
  private tokenData: TokenData | null = null

  async init(): Promise<boolean> {
    try {
      const result = await chrome.storage.session.get(TOKEN_KEY)
      const data = result[TOKEN_KEY] as TokenData | undefined

      if (data?.token && Date.now() < data.expiresAt) {
        this.tokenData = data
        return true
      }

      // Token expired or missing — clear stale data
      if (data) {
        await chrome.storage.session.remove(TOKEN_KEY)
      }

      return false
    } catch {
      return false
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.tokenData) return null

    if (Date.now() >= this.tokenData.expiresAt) {
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
  }

  async logout() {
    this.tokenData = null
    await chrome.storage.session.remove(TOKEN_KEY)
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
}

export const authManager = new AuthManager()
