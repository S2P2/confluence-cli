import type { HttpClient } from './http.js'
import type { ContentKind, RawSearchResultResponse, SearchResult } from './types.js'

export interface SearchOptions {
  limit?: number
  space?: string
  type?: string
  rawCql?: boolean
}

export interface SearchClient {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  escapeCql(str: string): string
  normalizeResult(raw: RawSearchResultResponse): SearchResult
}

export class DefaultSearchClient implements SearchClient {
  constructor(private readonly httpClient: HttpClient) {}

  public async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const cql = this.buildCql(query, options)
    const params: Record<string, unknown> = { cql }
    if (options?.limit !== undefined) params.limit = options.limit

    const response = await this.httpClient.get<{ results: RawSearchResultResponse[] }>('/content/search', params)
    return (response.results ?? []).map((r) => this.normalizeResult(r))
  }

  public escapeCql(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  }

  public normalizeResult(raw: RawSearchResultResponse): SearchResult {
    const baseUrl = raw._links?.base ?? ''
    const webui = raw._links?.webui ?? ''
    const webUrl = webui.startsWith('http') ? webui : `${baseUrl}${webui}`

    return {
      id: String(raw.id),
      title: raw.title,
      excerpt: raw.excerpt,
      kind: (raw.type as ContentKind) ?? 'page',
      space_key: raw.space?.key ?? '',
      web_url: webUrl,
    }
  }

  private buildCql(query: string, options?: SearchOptions): string {
    if (options?.rawCql) return query

    let cql = `siteSearch ~ "${this.escapeCql(query)}"`

    if (options?.space) {
      cql += ` AND space = "${this.escapeCql(options.space)}"`
    }

    if (options?.type) {
      const mappedType = options.type === 'blog' ? 'blogpost' : options.type
      cql += ` AND type = "${mappedType}"`
    }

    return cql
  }
}
