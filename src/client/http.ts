import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import fs from 'node:fs'
import https from 'node:https'
import type { ResolvedConfig } from '../config/types'

export class HttpClient {
  public readonly baseUrl: string
  private readonly config: ResolvedConfig
  private readonly axiosInstance: AxiosInstance

  constructor(config: ResolvedConfig) {
    this.config = config
    this.baseUrl = `${config.protocol}://${config.domain}${config.apiPath}`

    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      headers: this.buildAuthHeaders(),
      timeout: 30_000,
    }

    if (config.authType === 'mtls') {
      axiosConfig.httpsAgent = this.buildHttpsAgent()
    }

    this.axiosInstance = axios.create(axiosConfig)
  }

  public isCloud(): boolean {
    return this.config.domain.includes('atlassian.net') || this.config.forceCloud
  }

  public buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    switch (this.config.authType) {
      case 'basic': {
        const credentials = Buffer.from(`${this.config.email}:${this.config.token}`).toString('base64')
        headers.Authorization = `Basic ${credentials}`
        break
      }
      case 'bearer':
        headers.Authorization = `Bearer ${this.config.token}`
        break
      case 'cookie':
        headers.Cookie = this.config.cookie || ''
        break
      case 'mtls':
        if (this.config.token) {
          headers.Authorization = `Bearer ${this.config.token}`
        }
        break
    }

    return headers
  }

  public async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, { params })
    return response.data
  }

  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data, config)
    return response.data
  }

  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config)
    return response.data
  }

  public async delete<T>(url: string): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url)
    return response.data
  }

  public buildUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    return `${this.config.protocol}://${this.config.domain}${path}`
  }

  public extractPageId(input: string): string {
    const trimmed = input.trim()
    if (/^\d+$/.test(trimmed)) return trimmed

    const patterns = [/\/pages\/(\d+)/, /pageId=(\d+)/]

    for (const pattern of patterns) {
      const match = input.match(pattern)
      if (match?.[1]) return match[1]
    }

    throw new Error(
      `Cannot extract page ID from "${input}". Provide a numeric page ID or a Confluence page URL.`,
    )
  }

  private buildHttpsAgent(): https.Agent {
    const options: https.AgentOptions = {}
    if (this.config.tlsCaCert && fs.existsSync(this.config.tlsCaCert)) {
      options.ca = fs.readFileSync(this.config.tlsCaCert)
    }
    if (this.config.tlsClientCert && fs.existsSync(this.config.tlsClientCert)) {
      options.cert = fs.readFileSync(this.config.tlsClientCert)
    }
    if (this.config.tlsClientKey && fs.existsSync(this.config.tlsClientKey)) {
      options.key = fs.readFileSync(this.config.tlsClientKey)
    }
    return new https.Agent(options)
  }
}
