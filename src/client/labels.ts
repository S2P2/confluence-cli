import { HttpClient } from './http.js'
import type { LabelInfo, RawLabelResponse } from './types.js'

export interface LabelsClient {
  list(pageId: string): Promise<LabelInfo[]>
  add(pageId: string, label: string): Promise<void>
  remove(pageId: string, label: string): Promise<void>
  normalizeLabel(raw: RawLabelResponse): LabelInfo
}

export class DefaultLabelsClient implements LabelsClient {
  constructor(private readonly httpClient: HttpClient) {}

  public async list(pageId: string): Promise<LabelInfo[]> {
    const extractedPageId = this.httpClient.extractPageId(pageId)
    const response = await this.httpClient.get<{ results?: RawLabelResponse[] }>(`/content/${extractedPageId}/label`)
    return (response.results ?? []).map((label) => this.normalizeLabel(label))
  }

  public async add(pageId: string, label: string): Promise<void> {
    const extractedPageId = this.httpClient.extractPageId(pageId)
    await this.httpClient.post(`/content/${extractedPageId}/label`, [
      { prefix: 'global', name: label }
    ])
  }

  public async remove(pageId: string, label: string): Promise<void> {
    const extractedPageId = this.httpClient.extractPageId(pageId)
    await this.httpClient.delete(`/content/${extractedPageId}/label?name=${encodeURIComponent(label)}`)
  }

  public normalizeLabel(raw: RawLabelResponse): LabelInfo {
    return {
      id: raw.id,
      name: raw.name,
      prefix: raw.prefix ?? 'global'
    }
  }
}