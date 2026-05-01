import { parseNextStart } from '../utils/pagination.js'
import type { HttpClient } from './http.js'
import type { ContentProperty, PaginatedResponse, RawPropertyResponse } from './types.js'

export interface PropertiesClient {
  list(pageId: string, options?: { limit?: number; start?: number }): Promise<PaginatedResponse<ContentProperty>>
  getAll(pageId: string, options?: { maxResults?: number; start?: number }): Promise<ContentProperty[]>
  get(pageId: string, key: string): Promise<ContentProperty>
  set(pageId: string, key: string, value: unknown): Promise<ContentProperty>
  delete(pageId: string, key: string): Promise<void>
  normalizeProperty(raw: RawPropertyResponse): ContentProperty
}

export class DefaultPropertiesClient implements PropertiesClient {
  constructor(private readonly httpClient: HttpClient) {}

  public async list(
    pageId: string,
    options?: { limit?: number; start?: number },
  ): Promise<PaginatedResponse<ContentProperty>> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const params: Record<string, unknown> = {}
    if (options?.limit !== undefined) params.limit = options.limit
    if (options?.start !== undefined) params.start = options.start

    const response = await this.httpClient.get<PaginatedResponse<RawPropertyResponse>>(
      `/content/${extractedId}/property`,
      params,
    )

    return {
      ...response,
      results: (response.results ?? []).map((r) => this.normalizeProperty(r)),
    }
  }

  public async getAll(pageId: string, options?: { maxResults?: number; start?: number }): Promise<ContentProperty[]> {
    const maxResults = options?.maxResults ?? Infinity
    const allProperties: ContentProperty[] = []
    let currentStart = options?.start ?? 0
    const limit = 25

    while (allProperties.length < maxResults) {
      const page = await this.list(pageId, { limit, start: currentStart })
      allProperties.push(...page.results)

      const nextStart = this.parseNextStart(page._links)
      if (nextStart === undefined || page.results.length === 0) break
      currentStart = nextStart
    }

    return maxResults === Infinity ? allProperties : allProperties.slice(0, maxResults)
  }

  public async get(pageId: string, key: string): Promise<ContentProperty> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const result = await this.httpClient.get<RawPropertyResponse>(`/content/${extractedId}/property/${key}`)
    return this.normalizeProperty(result)
  }

  public async set(pageId: string, key: string, value: unknown): Promise<ContentProperty> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const result = await this.httpClient.put<RawPropertyResponse>(`/content/${extractedId}/property/${key}`, {
      key,
      value,
    })
    return this.normalizeProperty(result)
  }

  public async delete(pageId: string, key: string): Promise<void> {
    const extractedId = this.httpClient.extractPageId(pageId)
    await this.httpClient.delete(`/content/${extractedId}/property/${key}`)
  }

  public normalizeProperty(raw: RawPropertyResponse): ContentProperty {
    return {
      key: raw.key,
      value: raw.value,
      version: raw.version ?? { number: 1 },
    }
  }

  private parseNextStart = parseNextStart
}
