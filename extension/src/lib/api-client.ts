import type {
  AnalyzeRequest,
  AnalyzeResponse,
  RejectActionRequest,
  RejectActionResponse,
  ActionHistoryResponse,
  RemoteConfig,
  ApiError,
} from '@shared/types/api'
import { authManager } from './auth'

const DEFAULT_API_BASE = 'http://localhost:3000/api/v1'

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public apiError: ApiError
  ) {
    super(apiError.error)
    this.name = 'ApiRequestError'
  }
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = DEFAULT_API_BASE) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await authManager.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Extension-Version':
        typeof chrome !== 'undefined'
          ? (chrome.runtime?.getManifest?.()?.version ?? '0.0.0')
          : '0.0.0',
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    })

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Unknown error',
        code: 'UNKNOWN',
      }))
      throw new ApiRequestError(response.status, error)
    }

    return response.json()
  }

  async analyzeEmails(data: AnalyzeRequest): Promise<AnalyzeResponse> {
    return this.request<AnalyzeResponse>('/emails/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async rejectAction(
    data: RejectActionRequest
  ): Promise<RejectActionResponse> {
    return this.request<RejectActionResponse>('/actions/reject', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getActionHistory(params?: {
    page?: number
    limit?: number
    status?: string
    category?: string
  }): Promise<ActionHistoryResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    if (params?.category) searchParams.set('category', params.category)

    const query = searchParams.toString()
    return this.request<ActionHistoryResponse>(
      `/actions/history${query ? `?${query}` : ''}`
    )
  }

  async getConfig(): Promise<RemoteConfig> {
    return this.request<RemoteConfig>('/config')
  }
}

export const apiClient = new ApiClient()
