import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Writable } from 'node:stream'
import { HttpClient } from './http.js'
import type { AttachmentInfo, PaginatedResponse, RawAttachmentResponse } from './types.js'

export interface AttachmentsClient {
  list(
    pageId: string,
    options?: { limit?: number; start?: number },
  ): Promise<PaginatedResponse<AttachmentInfo>>
  getAll(pageId: string, options?: { maxResults?: number }): Promise<AttachmentInfo[]>
  upload(
    pageId: string,
    filePath: string,
    options?: { comment?: string; replace?: boolean; minorEdit?: boolean },
  ): Promise<AttachmentInfo>
  download(pageId: string, attachment: string, destPath: string): Promise<void>
  delete(pageId: string, attachmentId: string): Promise<void>
  matchesPattern(value: string, pattern: string): boolean
  normalizeAttachment(raw: RawAttachmentResponse): AttachmentInfo
}

export class DefaultAttachmentsClient implements AttachmentsClient {
  constructor(private readonly httpClient: HttpClient) {}

  public async list(
    pageId: string,
    options?: { limit?: number; start?: number },
  ): Promise<PaginatedResponse<AttachmentInfo>> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const params: Record<string, unknown> = {}
    if (options?.limit !== undefined) params.limit = options.limit
    if (options?.start !== undefined) params.start = options.start

    const response = await this.httpClient.get<PaginatedResponse<RawAttachmentResponse>>(
      `/content/${extractedId}/child/attachment`,
      params,
    )

    return {
      ...response,
      results: (response.results ?? []).map((r) => this.normalizeAttachment(r)),
    }
  }

  public async getAll(
    pageId: string,
    options?: { maxResults?: number },
  ): Promise<AttachmentInfo[]> {
    const maxResults = options?.maxResults ?? Infinity
    const allAttachments: AttachmentInfo[] = []
    let start = 0
    const limit = 25

    while (allAttachments.length < maxResults) {
      const page = await this.list(pageId, { limit, start })
      allAttachments.push(...page.results)

      const nextStart = this.parseNextStart(page._links)
      if (nextStart === undefined || page.results.length === 0) break
      start = nextStart
    }

    return maxResults === Infinity ? allAttachments : allAttachments.slice(0, maxResults)
  }

  public async upload(
    pageId: string,
    filePath: string,
    options?: { comment?: string; replace?: boolean; minorEdit?: boolean },
  ): Promise<AttachmentInfo> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const basename = path.basename(filePath)

    let url = `/content/${extractedId}/child/attachment`
    if (options?.replace) {
      url += `?filename=${encodeURIComponent(basename)}`
    }

    const fileBuffer = fs.readFileSync(filePath)
    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer]), basename)
    formData.append('minorEdit', String(options?.minorEdit ?? 'true'))

    if (options?.comment) {
      formData.append('comment', options.comment)
    }

    const result = await this.httpClient.post<RawAttachmentResponse | { results?: RawAttachmentResponse[] }>(url, formData, {
      headers: { 'X-Atlassian-Token': 'no-check' },
    })

    const hasResults = (val: unknown): val is { results?: RawAttachmentResponse[] } =>
      typeof val === 'object' && val !== null && 'results' in val
    const attachment: RawAttachmentResponse = hasResults(result) && result.results?.[0]
      ? result.results[0]
      : result as RawAttachmentResponse
    return this.normalizeAttachment(attachment)
  }

  public async download(pageId: string, attachment: string, destPath: string): Promise<void> {
    const extractedId = this.httpClient.extractPageId(pageId)
    let downloadUrl = attachment

    if (!attachment.startsWith('http')) {
      const attachments = await this.list(extractedId, { limit: 100 })
      const found = attachments.results.find(
        (a) => a.id === attachment || a.title === attachment,
      )
      if (!found) {
        throw new Error(`Attachment "${attachment}" not found on page ${extractedId}`)
      }
      downloadUrl = found.downloadLink
    }

    const fullUrl = this.httpClient.buildUrl(downloadUrl)
    const authHeaders = this.httpClient.buildAuthHeaders()

    const response = await axios.get(fullUrl, {
      responseType: 'stream',
      headers: authHeaders,
    })

    const writeStream = fs.createWriteStream(destPath) as Writable
    await pipeline(response.data, writeStream)
  }

  public async delete(pageId: string, attachmentId: string): Promise<void> {
    await this.httpClient.delete(`/content/${attachmentId}`)
  }

  public matchesPattern(value: string, pattern: string): boolean {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${regexStr}$`).test(value)
  }

  public normalizeAttachment(raw: RawAttachmentResponse): AttachmentInfo {
    const downloadLink =
      raw._links?.download ?? raw.extensions?.downloadLink ?? ''
    const base = raw._links?.base ?? ''

    return {
      id: String(raw.id),
      title: raw.title,
      mediaType: raw.extensions?.mediaType ?? raw.metadata?.mediaType,
      fileSize: raw.extensions?.fileSize ?? raw.metadata?.fileSize,
      version: raw.version?.number ?? 1,
      downloadLink: downloadLink.startsWith('http')
        ? downloadLink
        : `${base}${downloadLink}`,
    }
  }

  private parseNextStart(links: { next?: string } | undefined): number | undefined {
    if (!links?.next) return undefined
    const url = typeof links.next === 'string' ? links.next : ''
    const match = url.match(/[?&]start=(\d+)/)
    return match?.[1] ? Number(match[1]) : undefined
  }
}
