import { HttpClient } from './http.js'
import type { SpaceSummary } from './types.js'

export interface SpacesClient {
  list(limit?: number): Promise<SpaceSummary[]>
  get(spaceKey: string): Promise<SpaceSummary>
  normalizeSpace(raw: any): SpaceSummary
}

export class DefaultSpacesClient implements SpacesClient {
  constructor(private readonly httpClient: HttpClient) {}

  public async list(limit?: number): Promise<SpaceSummary[]> {
    const params: Record<string, unknown> = {}
    if (limit !== undefined) params.limit = limit

    const response = await this.httpClient.get<{ results: any[] }>('/space', params)
    return (response.results ?? []).map((r: any) => this.normalizeSpace(r))
  }

  public async get(spaceKey: string): Promise<SpaceSummary> {
    const result = await this.httpClient.get<any>(`/space/${spaceKey}`)
    return this.normalizeSpace(result)
  }

  public normalizeSpace(raw: any): SpaceSummary {
    return {
      id: String(raw.id ?? ''),
      key: raw.key,
      name: raw.name,
      type: raw.type,
      status: raw.status?.name ?? raw.status ?? '',
      _links: raw._links,
    }
  }
}
